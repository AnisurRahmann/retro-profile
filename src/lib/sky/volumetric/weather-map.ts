/**
 * The weather map (owner T2): a pure, seeded CPU generator and its WebGL wrapper, typed in
 * src/components/sky/volumetric/types.ts (WeatherMapParams → WeatherMap).
 *
 * Channels (128×128 RGBA8): R coverage · G type (0 stratus, 0.5 cumulus, 1 cumulonimbus) ·
 * B precipitation · A unused. The noise lattices wrap and the cells wrap, so the map tiles with
 * no seam under REPEAT.
 *
 * Coverage follows the brief's formula: cov = clamp(n·1.4 − (1 − coverage)·1.1, 0, 1), where n is
 * seeded, wrapped, low-frequency value noise shaped per type:
 * - stratus: one very low octave, levelled around a high mean → a smooth, near-uniform deck;
 * - cumulus: two octaves' product (clusters where both are high), turned into per-map percentiles
 *   and lifted into clear holes + dense clusters. The percentile step pins the histogram, so
 *   `coverage` is what types.ts says it is — the map's mean target — for every seed;
 * - cumulonimbus: the cumulus field with 1–2 seeded gaussian cells (radius 0.12–0.2 of the map)
 *   that raise coverage to 1 and stamp the cumulonimbus type; the patchy field stays cumulus-grade.
 * A forcedCell overrides coverage (≥ 0.95 at its centre) and type (0.5) at a map uv, wrapped across
 * the edges. Precipitation follows the params, concentrated under high-coverage cells.
 */
import {
  CLOUD_TYPE_VALUE,
  GEOMETRY,
  WEATHER_MAP_SIZE,
  type CloudType,
  type CreateWeatherMap,
  type GenerateWeatherMap,
  type Vec2,
  type WeatherMapParams,
} from "@/components/sky/volumetric/types";

/**
 * The wind is time-lapsed so drift is visible in the lab: 15 km/h becomes 0.0625 km/s apparent,
 * crossing the 40-km tile in ~10.7 min (two frames 10 s apart differ by ~2 texels). T8 may retune.
 */
export const WIND_TIMELAPSE = 15;

// ── The generator's constants (tuned over seeds 1–64; see the hand-off) ──────────────────────────

/** Patchy octaves: a broad envelope (freq 4 → ~10 km features) times finer patches (freq 11 → ~3.6 km). */
const PATCHY_FREQ_LO = 4;
const PATCHY_FREQ_HI = 11;
/** n = 1 − LIFT·(1 − percentile)^POW, high-skewed with clear holes: at coverage 0.38 the field is 24% clear, 44% dense (> 0.5), mean 0.377. */
const PATCHY_LIFT = 0.9;
const PATCHY_POW = 2.15;
/** The stratus deck: one smooth swell (freq 3), z-scored to level 0.75 with a ±0.09 σ swing → near-uniform. */
const STRATUS_FREQ = 3;
const STRATUS_LEVEL = 0.75;
const STRATUS_SWING = 0.09;
/** Cell falloff: s = exp(−3·(d/r)²) falls to 5% at the cell's radius. */
const CELL_FALLOFF = 3;
/** Cumulonimbus cells: radius in map uv (the brief: 0.12–0.2 of the map). */
const CELL_MIN_RADIUS = 0.12;
const CELL_RADIUS_SPAN = 0.08;
/** The type channel blends from the field's type to the cell's across this band of cell strength. */
const CELL_TYPE_LO = 0.15;
const CELL_TYPE_HI = 0.6;
/** Precipitation ramps in over this coverage band, so it sits under the dense cells. */
const PRECIP_COVERAGE_LO = 0.45;
const PRECIP_COVERAGE_HI = 0.95;

const SIZE = WEATHER_MAP_SIZE;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const byte = (v: number) => Math.round(clamp01(v) * 255);
const smoothstep = (lo: number, hi: number, x: number) => {
  const t = clamp01((x - lo) / (hi - lo));
  return t * t * (3 - 2 * t);
};

/** A 32-bit mix of (seed, x, y) → [0, 1). x and y fold in multiplicatively, so seed⊕x can't collide. */
function hash01(seed: number, x: number, y: number): number {
  let h = (seed | 0) ^ Math.imul(x | 0, 0x9e3779b1) ^ Math.imul(y | 0, 0x85ebca77);
  h = Math.imul(h ^ (h >>> 16), 0x27d4eb2f);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2545f491);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

/** A derived 32-bit lattice seed, so each octave sees a different shuffle of the same weather seed. */
const latticeSeed = (seed: number, salt: number) => (hash01(seed, salt, 0) * 4294967296) | 0;

/** A wrapped lattice of hash values: sampling it with mod-freq indices tiles the map seamlessly. */
function lattice(seed: number, freq: number): Float32Array {
  const a = new Float32Array(freq * freq);
  for (let j = 0; j < freq; j++) for (let i = 0; i < freq; i++) a[j * freq + i] = hash01(seed, i, j);
  return a;
}

/** Smoothstep-bilinear value noise on the wrapped lattice; u, v and u+1, v+1 give the same value. */
function sampleLattice(a: Float32Array, freq: number, u: number, v: number): number {
  const x = u * freq;
  const y = v * freq;
  const i = Math.floor(x);
  const j = Math.floor(y);
  const fx = x - i;
  const fy = y - j;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const i0 = ((i % freq) + freq) % freq;
  const j0 = ((j % freq) + freq) % freq;
  const i1 = (i0 + 1) % freq;
  const j1 = (j0 + 1) % freq;
  const a00 = a[j0 * freq + i0]!;
  const a10 = a[j0 * freq + i1]!;
  const a01 = a[j1 * freq + i0]!;
  const a11 = a[j1 * freq + i1]!;
  return (a00 + (a10 - a00) * sx) * (1 - sy) + (a01 + (a11 - a01) * sx) * sy;
}

/** Each texel's percentile in the map (0..1). The pattern stays the seed's; the histogram is pinned. */
function percentiles(v: Float32Array): Float32Array {
  const sorted = Float32Array.from(v).sort();
  return Float32Array.from(v, (x) => {
    let lo = 0;
    let hi = sorted.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (sorted[mid]! < x) lo = mid + 1;
      else hi = mid;
    }
    return (lo + 0.5) / sorted.length;
  });
}

/** The patchy field (cumulus and the cumulonimbus base): the two octaves' product, ranked, lifted. */
function patchyField(seed: number): Float32Array {
  const a = lattice(latticeSeed(seed, 101), PATCHY_FREQ_LO);
  const b = lattice(latticeSeed(seed, 102), PATCHY_FREQ_HI);
  const raw = new Float32Array(SIZE * SIZE);
  for (let y = 0; y < SIZE; y++) {
    const v0 = (y + 0.5) / SIZE;
    const row = y * SIZE;
    for (let x = 0; x < SIZE; x++) {
      const u0 = (x + 0.5) / SIZE;
      raw[row + x] = 2 * sampleLattice(a, PATCHY_FREQ_LO, u0, v0) * sampleLattice(b, PATCHY_FREQ_HI, u0, v0);
    }
  }
  return Float32Array.from(percentiles(raw), (u) => 1 - PATCHY_LIFT * Math.pow(Math.max(0, 1 - u), PATCHY_POW));
}

/** The stratus deck: one very low octave, z-scored to the same level and width for every seed. */
function stratusField(seed: number): Float32Array {
  const a = lattice(latticeSeed(seed, 103), STRATUS_FREQ);
  const raw = new Float32Array(SIZE * SIZE);
  for (let y = 0; y < SIZE; y++) {
    const v0 = (y + 0.5) / SIZE;
    const row = y * SIZE;
    for (let x = 0; x < SIZE; x++) raw[row + x] = sampleLattice(a, STRATUS_FREQ, (x + 0.5) / SIZE, v0);
  }
  let mean = 0;
  for (const x of raw) mean += x;
  mean /= raw.length;
  let variance = 0;
  for (const x of raw) variance += (x - mean) * (x - mean);
  const sd = Math.sqrt(variance / raw.length) || 1e-6;
  return Float32Array.from(raw, (x) => clamp01(STRATUS_LEVEL + STRATUS_SWING * ((x - mean) / sd)));
}

/** The patchy field's type: a cumulonimbus sky is a cumulus field with embedded CB cells. */
const fieldType = (t: CloudType) => (t === "stratus" ? CLOUD_TYPE_VALUE.stratus : CLOUD_TYPE_VALUE.cumulus);

/**
 * One gaussian cell at map uv (u, v), radius in uv, wrapped across the edges (toroidal distance):
 * coverage = max(cov, s) with s = exp(−CELL_FALLOFF·(d/r)²), and the type channel blended to
 * `typeValue` through the dense core. A radius of 0 is a point cell (only its centre texel).
 */
function stampCell(cov: Float32Array, type: Float32Array, u: number, v: number, radius: number, typeValue: number): void {
  const invR2 = radius > 0 ? 1 / (radius * radius) : Number.POSITIVE_INFINITY;
  for (let y = 0; y < SIZE; y++) {
    let dv = Math.abs((y + 0.5) / SIZE - v);
    dv = Math.min(dv, 1 - dv);
    const row = y * SIZE;
    for (let x = 0; x < SIZE; x++) {
      let du = Math.abs((x + 0.5) / SIZE - u);
      du = Math.min(du, 1 - du);
      const d2 = du * du + dv * dv;
      const s = d2 === 0 ? 1 : Math.exp(-CELL_FALLOFF * d2 * invR2);
      const i = row + x;
      if (s > cov[i]!) cov[i] = s;
      const blend = smoothstep(CELL_TYPE_LO, CELL_TYPE_HI, s);
      type[i] = type[i]! + (typeValue - type[i]!) * blend;
    }
  }
}

/** 1–2 seeded cumulonimbus cells: radius 0.12–0.2 of the map, centres anywhere, type stamped to 1. */
function stampStormCells(cov: Float32Array, type: Float32Array, seed: number): void {
  const count = hash01(seed, 201, 0) < 0.5 ? 1 : 2;
  for (let ci = 0; ci < count; ci++) {
    stampCell(
      cov,
      type,
      hash01(seed, 210 + ci, 1),
      hash01(seed, 210 + ci, 2),
      CELL_MIN_RADIUS + CELL_RADIUS_SPAN * hash01(seed, 210 + ci, 3),
      CLOUD_TYPE_VALUE.cumulonimbus,
    );
  }
}

export const generateWeatherMap: GenerateWeatherMap = (p) => {
  const n = p.type === "stratus" ? stratusField(p.seed) : patchyField(p.seed);
  const texels = SIZE * SIZE;
  const cov = new Float32Array(texels);
  // The brief's formula: coverage = clamp(lowFreqNoise·1.4 − (1 − coverage)·1.1, 0, 1).
  for (let i = 0; i < texels; i++) cov[i] = clamp01(n[i]! * 1.4 - (1 - p.coverage) * 1.1);
  const type = new Float32Array(texels).fill(fieldType(p.type));
  if (p.type === "cumulonimbus") stampStormCells(cov, type, p.seed);
  if (p.forcedCell) stampCell(cov, type, p.forcedCell.u, p.forcedCell.v, p.forcedCell.radius, CLOUD_TYPE_VALUE.cumulus);
  const out = new Uint8Array(texels * 4);
  for (let i = 0; i < texels; i++) {
    out[4 * i] = byte(cov[i]!);
    out[4 * i + 1] = byte(type[i]!);
    out[4 * i + 2] = byte(p.precipitation * smoothstep(PRECIP_COVERAGE_LO, PRECIP_COVERAGE_HI, cov[i]!));
    out[4 * i + 3] = 255;
  }
  return out;
};

// ── The WebGL wrapper ────────────────────────────────────────────────────────────────────────────

/** The field's velocity in map uv per second: the wind blows toward fromDeg + 180 (u east, v north). */
export function windVelocity(windKmh: number, windFromDeg: number): Vec2 {
  const to = ((windFromDeg + 180) * Math.PI) / 180;
  const uvPerSec = ((windKmh / 3600) * WIND_TIMELAPSE) / GEOMETRY.WEATHER_MAP_KM;
  return [Math.sin(to) * uvPerSec, Math.cos(to) * uvPerSec];
}

/** The params that change the map's bytes. The wind only scrolls the field, so it never regenerates. */
const fieldChanged = (a: WeatherMapParams | null, b: WeatherMapParams): boolean =>
  !a ||
  a.type !== b.type ||
  a.coverage !== b.coverage ||
  a.precipitation !== b.precipitation ||
  a.seed !== b.seed ||
  a.forcedCell?.u !== b.forcedCell?.u ||
  a.forcedCell?.v !== b.forcedCell?.v ||
  a.forcedCell?.radius !== b.forcedCell?.radius;

export const createWeatherMap: CreateWeatherMap = (gl, initial) => {
  const texture = gl.createTexture()!;
  let params: WeatherMapParams | null = null;
  const upload = (p: WeatherMapParams) => {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA8,
      WEATHER_MAP_SIZE,
      WEATHER_MAP_SIZE,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      generateWeatherMap(p),
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  };
  const wrap = (x: number) => ((x % 1) + 1) % 1;
  const map = {
    texture,
    offset: [0, 0] as [number, number],
    velocity: [0, 0] as [number, number],
    update(dtSec: number) {
      map.offset[0] = wrap(map.offset[0] + map.velocity[0] * dtSec);
      map.offset[1] = wrap(map.offset[1] + map.velocity[1] * dtSec);
    },
    setParams(p: WeatherMapParams) {
      map.velocity = windVelocity(p.windKmh, p.windFromDeg);
      if (!fieldChanged(params, p)) return;
      params = { ...p };
      upload(p);
    },
    dispose() {
      gl.deleteTexture(texture);
    },
  };
  map.setParams(initial);
  return map;
};
