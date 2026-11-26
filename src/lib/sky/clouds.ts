/**
 * The cloud model of Weather v6. Pure numbers and small functions shared by the shader
 * (src/components/sky/sky-shader.ts) and its CPU mirror (src/components/sky/cloud-field.ts), so the two can't drift.
 *
 * Three sheets in perspective, drawn back to front, plus SCUD under a rain deck:
 * - HIGH (cirrus): thin, stretched along the wind.
 * - MID (altocumulus): patches of small rounded cells.
 * - LOW (cumulus, stratus, nimbostratus): the clouds that make the weather.
 * - SCUD: small, fast fragments under a rain deck.
 *
 * Each sheet is a plane at height h above the viewer. A screen pixel at v (0 at the cloud horizon, 1 at the top of
 * the viewport) looks at a point z = h / v into the scene and (x − ½W)·z / focal across, so clouds are largest
 * overhead and shrink toward the horizon. The sheet's depth is read logarithmically, s = h·k·ln(z / h) with
 * k = horizon / focal, which is where this departs from sampling the flat plane (DECISIONS): on a flat plane a
 * cloud's height on screen falls as v² and its width only as v, so by 20° up every distant cumulus is a line six
 * times wider than it is tall. A cloud is as thick as it is wide: read in log depth it keeps its proportions at
 * every distance and shrinks with v, as a solid body does.
 *
 * Wind is a drift of each sheet's noise: x toward the west (screen right: the viewer faces south), and s, the log
 * of the distance, toward the south (away from the viewer). From the north the clouds recede, from the south they
 * come on.
 */
import { mulberry32 } from "./random";
import type { Condition } from "./weather";

export type SheetId = "high" | "mid" | "low" | "scud";
export const SHEETS: readonly SheetId[] = ["high", "mid", "low", "scud"];

/**
 * Per sheet: its height above the viewer (scene units), its speed relative to LOW, how many noise units a scene
 * unit spans (how big its clouds are), how far the noise is stretched along the wind (cirrus), the most opaque it
 * gets, and its thickness (Beer–Lambert: thick cores go dark). SCUD's fbm is at twice LOW's frequency.
 */
export const SHEET = {
  high: { h: 9, speed: 0.3, freq: 0.5, stretch: 5, alpha: 0.35, thick: 0.25 },
  mid: { h: 4, speed: 0.6, freq: 2, stretch: 1, alpha: 0.6, thick: 0.7 },
  low: { h: 1.6, speed: 1, freq: 1.6, stretch: 1, alpha: 0.95, thick: 1.6 },
  scud: { h: 1, speed: 1.6, freq: 3.2, stretch: 1, alpha: 0.5, thick: 0.6 },
} as const;

/** The camera's focal length, × the viewport width. */
export const FOCAL = 0.9;
/** A sheet is never looked at from closer to the horizon than this (v is clamped). */
export const V_MIN = 0.02;
/** Every sheet fades to nothing over the last 4% above the horizon (haze). */
export const HAZE = 0.04;
/** Density rises from 0 to 1 over this much of the cloud noise: the softness of an edge. */
export const EDGE = 0.045;
/**
 * A stratus deck (overcast, drizzle) is thick everywhere: a thin patch keeps `floor` of the density, so more light
 * comes through it and it is brighter (Beer–Lambert), where a cumulus edge is a bright rim round a hole. The deck
 * is opaque to at least `opaque` (no blue sky through a thin patch), and its edge is `edge` wide.
 */
export const STRATUS = { floor: 0.45, opaque: 0.86, edge: 0.18 } as const;
/** Worley cells per noise unit: the LOW sheet's puffs and MID's cells. */
export const CELLS_PER_UNIT = { low: 2.5, mid: 2 } as const;
/** How strongly the fbm's slope tilts a LOW cloud's normal. */
export const SLOPE = 4;

/**
 * Scene units a LOW feature drifts per second at 1 km/h. 0.0014 · max(wind, 6) moves one 65–106 px in 10 s in the
 * upper third of a 1440×900 viewport at 15 km/h (W2's calibration: 60–120 px, unit test and measured on screen).
 */
export const PLANE_SPEED = 0.0014;
/**
 * How fast a receding or approaching cloud crosses the sheet in log depth, against the same wind across it. On
 * screen a receding cloud's speed is this × k × the wind's, where a cloud drifting across moves at ∝ v: they match
 * at about half the height of the sky.
 */
export const DEPTH_RATE = 0.5;

/** Gusts: the wind swells and drops by ±`amplitude` around its speed, at `hz`. */
export const GUST = { amplitude: 0.2, hz: 0.07 } as const;
/** The wind's speed at time t (seconds), as a factor of its own: 1 ± 0.2 at 0.07 Hz. */
export const gust = (t: number) => 1 + GUST.amplitude * Math.sin(2 * Math.PI * GUST.hz * t);

/**
 * Evolution: how fast a sheet's shapes change, as its warp field drifting (per second). LOW is the brief's third
 * noise dimension at 0.02/s; HIGH's cirrus thins and gathers at 0.008/s. MID and SCUD only drift.
 */
export const EVOLUTION = { low: 0.02, mid: 0, high: 0.008, scud: 0 } as const;
/**
 * A sheet's evolution wraps at this many units without a jump: every warp input moves at a whole number of lattices
 * per wrap (256 × 10, 6, 7 and 10 for LOW's 1, 0.6, 0.7 and 1). 36 hours of LOW at a time.
 */
export const EVO_PERIOD = 2560;

/** Coverage of each sheet at the cloud cover typical of a condition; a real cover scales it (cloudPlan). */
const COVER_AT: Record<Condition, Record<SheetId, number>> = {
  clear: { high: 0.15, mid: 0, low: 0, scud: 0 },
  partly: { high: 0.25, mid: 0.25, low: 0.45, scud: 0 },
  overcast: { high: 0, mid: 0.6, low: 0.98, scud: 0 },
  drizzle: { high: 0, mid: 0, low: 0.9, scud: 0 },
  rain: { high: 0, mid: 0, low: 1, scud: 0.25 },
  "heavy-rain": { high: 0, mid: 0, low: 1, scud: 0.4 },
  thunder: { high: 0, mid: 0, low: 1, scud: 0.35 },
  fog: { high: 0, mid: 0, low: 0, scud: 0 },
};

export type CloudPlan = {
  /** Coverage of HIGH, MID, LOW and SCUD, 0..1. */
  cover: [number, number, number, number];
  /** The Worley billow in the LOW sheet: 1 = cumulus puffs, 0.2 = a flat stratus sheet. */
  billow: number;
  /** The LOW sheet's domain warp: 0.6, 1 in thunder (towering cumulonimbus). */
  warp: number;
  /** 1 when the LOW sheet is a stratus deck (overcast, drizzle): thick everywhere, soft-edged (STRATUS). */
  stratus: number;
};

/** What a condition draws, for a cloud cover (0..1). The sheets' coverage follows the real cover from the condition's own. */
export function cloudPlan(condition: Condition, cloudCover: number, typical: number): CloudPlan {
  const at = COVER_AT[condition];
  const k = typical > 0 ? cloudCover / typical : 1;
  const of = (s: SheetId) => Math.min(1, Math.max(0, (at[s] ?? 0) * k));
  const sheet = condition === "overcast" || condition === "drizzle";
  return {
    cover: [of("high"), of("mid"), of("low"), of("scud")],
    billow: sheet || condition === "fog" ? 0.2 : condition === "thunder" ? 1 : 0.6,
    warp: condition === "thunder" ? 1 : 0.6,
    stratus: sheet ? 1 : 0,
  };
}

/** Log depth is isotropic with x for this k (the clouds' horizon over the camera's focal length). */
export const depthK = (vw: number, cloudHz: number) => cloudHz / (FOCAL * vw);

/**
 * Where a CSS px looks on a sheet: v (0 at the cloud horizon, 1 at the top), and the noise coordinates to sample
 * (before the sheet's drift): x across, s the log of the distance. The footprint (the noise under one atmosphere
 * pixel, `px` CSS px) is the same along both axes; octaves finer than it are not worth sampling.
 */
export function planePoint(x: number, y: number, sheet: SheetId, vw: number, cloudHz: number, px = 0) {
  const { h, freq } = SHEET[sheet];
  const v = Math.max((cloudHz - y) / cloudHz, V_MIN);
  const z = h / v;
  return {
    v,
    x: ((x - 0.5 * vw) * z * freq) / (FOCAL * vw),
    s: h * depthK(vw, cloudHz) * Math.log(z / h) * freq,
    fp: (px * z * freq) / (FOCAL * vw),
  };
}

/** Octave i of a noise of wavelength 1 at this footprint: 1 keeps it, 0 replaces it by its mean. */
export const lod = (fp: number, octave = 0) => Math.min(1, Math.max(0, 1.5 - 2.5 * fp * 2 ** octave));

/**
 * Wind (km/h, from its bearing) as a drift of a sheet's noise, scene units per second: it blows toward
 * fromDeg + 180°, east to screen-left. Into the scene, the log of the distance: the offset is added to a pixel's
 * depth, so an offset that grows brings a cloud nearer and one that shrinks carries it away. From the north the
 * clouds recede (toward the horizon, smaller); from the south they come on. `k` is depthK for the layout.
 * A gust scales the km/h (gust).
 */
export function planeWind(kmh: number, fromDeg: number, sheet: SheetId, k = 0.6): [number, number] {
  const s = SHEET[sheet].speed * PLANE_SPEED * Math.max(kmh, 6);
  const to = ((fromDeg + 180) * Math.PI) / 180;
  return [-Math.sin(to) * s, Math.cos(to) * s * k * DEPTH_RATE];
}

// ── The noise textures ─────────────────────────────────────────────────────────────────────────────────────────

/** Side of the square noise textures (repeat, linear). */
export const NOISE_SIZE = 256;
/** Worley cells along a side of the cell texture (8 texels each). */
export const CELLS = 32;

let noise: Uint8Array | null = null;
/**
 * Four independent value-noise lattices (R, G, B, A), seeded so the sky is the same on every load. R is one noise,
 * RG a noise vector (the domain warp).
 */
export function noiseData(): Uint8Array {
  if (!noise) {
    const rnd = mulberry32(1013);
    noise = new Uint8Array(NOISE_SIZE * NOISE_SIZE * 4).map(() => (rnd() * 256) | 0);
  }
  return noise;
}

let cells: Uint8Array | null = null;
/**
 * Worley cells as a texture: G and B hold the vector from the texel to its cell's feature point (cell units), so F1 is
 * its length and the puff's normal its direction; R holds F2. Jittered points on a wrapped 32×32 grid, so it tiles.
 * One filtered fetch replaces the nine of a Worley lookup, on the GPU and on the CPU.
 */
export function cellData(): Uint8Array {
  if (cells) return cells;
  const n = NOISE_SIZE;
  const per = n / CELLS;
  const wrap = (v: number) => ((v % CELLS) + CELLS) % CELLS;
  // One feature point per cell, up to 0.4 off its centre.
  const pts = new Float32Array(CELLS * CELLS * 2);
  const rnd = mulberry32(1014);
  for (let i = 0; i < CELLS * CELLS; i++) {
    pts[i * 2] = (i % CELLS) + 0.5 + (rnd() - 0.5) * 0.8;
    pts[i * 2 + 1] = Math.floor(i / CELLS) + 0.5 + (rnd() - 0.5) * 0.8;
  }
  cells = new Uint8Array(n * n * 4).fill(255);
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const px = (i + 0.5) / per;
      const py = (j + 0.5) / per;
      const cx = Math.floor(px);
      const cy = Math.floor(py);
      let f1 = Infinity;
      let f2 = Infinity;
      let nx = 0;
      let ny = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          // A cell off the edge is the copy of the one it wraps to, standing 32 cells away from it.
          const gx = cx + dx;
          const gy = cy + dy;
          const k = wrap(gy) * CELLS + wrap(gx);
          const fx = pts[k * 2]! + gx - wrap(gx);
          const fy = pts[k * 2 + 1]! + gy - wrap(gy);
          const d = Math.hypot(px - fx, py - fy);
          if (d < f1) {
            f2 = f1;
            f1 = d;
            nx = px - fx;
            ny = py - fy;
          } else if (d < f2) f2 = d;
        }
      const o = (j * n + i) * 4;
      cells[o] = Math.min(255, Math.round(f2 * 128));
      cells[o + 1] = Math.round((0.5 + 0.4 * nx) * 255);
      cells[o + 2] = Math.round((0.5 + 0.4 * ny) * 255);
    }
  return cells;
}
