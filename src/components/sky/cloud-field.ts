/**
 * CPU mirror of the atmosphere's clouds (sky-shader.ts): the same noise, the same sheets, sample by sample. The
 * sun and the moon need the cloud in front of them (the optical depth of LOW and MID at their disc), the
 * crepuscular rays need the gaps, and the backing model (src/lib/sky/backing.ts) the most cloud over a text box,
 * from a 64×36 grid refreshed every 500 ms. It also solves, from the cloud noise's own distribution, the density a
 * coverage means (the shader's threshold), so a coverage means what it says.
 */
import {
  CELLS_PER_UNIT,
  EDGE,
  HAZE,
  SHEET,
  SHEETS,
  STRATUS,
  cellData,
  lod,
  noiseData,
  planePoint,
  type SheetId,
} from "@/lib/sky/clouds";

export const GRID_W = 64;
export const GRID_H = 36;
export const CLOUD_REFRESH_S = 0.5;
/** The softness of a cirrus and a SCUD edge, in noise (sky-shader.ts). */
const SOFT = { high: 0.25, scud: 0.15 } as const;

/** Where a sheet is being sampled: its offset in noise units (the wind, integrated by the renderer). */
export type SheetState = { x: number; z: number; evo: number };
export type CloudInputs = {
  sheets: Record<SheetId, SheetState>;
  /** Coverage of each sheet, 0..1. */
  cover: Record<SheetId, number>;
  billow: number;
  warp: number;
  /** 1 when the LOW sheet is a stratus deck (clouds.ts STRATUS). */
  stratus: number;
  fog: number;
  /** The wind's direction on the cloud planes (unit): cirrus stretch along it. */
  wind: [number, number];
  vw: number;
  /** The clouds' horizon line, CSS px. */
  cloudHz: number;
  /** The CSS size of one atmosphere pixel. */
  px: number;
};

const N = 256;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const wrap = (v: number) => ((v % N) + N) % N;
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const sm = (e0: number, e1: number, x: number) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
/** A bilinear read of one channel of a noise texture, as the GPU filters it. */
const tap = (data: Uint8Array, x: number, y: number, ch: number) => {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  let fx = x - ix;
  let fy = y - iy;
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  const at = (cx: number, cy: number) => data[(wrap(cy) * N + wrap(cx)) * 4 + ch]!;
  const a = at(ix, iy);
  const b = at(ix + 1, iy);
  const c = at(ix, iy + 1);
  const d = at(ix + 1, iy + 1);
  return (a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy) / 255;
};
/** R * p = (1.6x − 1.2y, 1.2x + 1.6y); RC is a turn of 36.9°. */
const rot = (x: number, y: number): [number, number] => [1.6 * x - 1.2 * y, 1.2 * x + 1.6 * y];
const rotC = (x: number, y: number): [number, number] => [0.8 * x - 0.6 * y, 0.6 * x + 0.8 * y];

export function createCloudField() {
  const noiseTex = noiseData();
  const cellTex = cellData();
  const grid = new Float32Array(GRID_W * GRID_H);
  /** Each sheet's cloud noise as a sorted sample of 1,024 densities, by style. */
  const dist = new Map<string, Float32Array>();
  let vw = 1,
    vh = 1,
    ready = false;
  let cur: CloudInputs | null = null;

  const vn = (x: number, y: number) => tap(noiseTex, x, y, 0);
  /** Worley: the vector to the centre of the cell. */
  const cellv = (x: number, y: number): [number, number] => [
    tap(cellTex, x, y, 1) * 2.5 - 1.25,
    tap(cellTex, x, y, 2) * 2.5 - 1.25,
  ];
  const fbm = (x: number, y: number, fp: number, n: 2 | 3) => {
    let v = 0;
    let a = 0.5;
    for (let i = 0; i < n; i++) {
      v += a * mix(0.5, vn(x, y), lod(fp, i));
      [x, y] = rot(x, y);
      a *= 0.5;
    }
    return v;
  };
  /** LOW's density before its threshold, at noise coordinates q. */
  const low = (qx: number, qy: number, fp: number, warp: number, billow: number, evo: number, stratus: number) => {
    const ax = qx * 0.5 + 1.7 + evo;
    const ay = qy * 0.5 + 9.2 + evo * 0.6;
    const w1x = tap(noiseTex, ax, ay, 0) - 0.5;
    const w1y = tap(noiseTex, ax, ay, 1) - 0.5;
    const bx = (qx + warp * w1x) * 0.5 + 8.3 - evo * 0.7;
    const by = (qy + warp * w1y) * 0.5 + 2.8 - evo;
    const w2x = tap(noiseTex, bx, by, 0) - 0.5;
    const w2y = tap(noiseTex, bx, by, 1) - 0.5;
    let x = qx + warp * (w1x + w2x);
    let y = qy + warp * (w1y + w2y);
    // Three octaves about their mean, as the shader has them.
    let f = 0.5 * mix(0.5, vn(x, y), lod(fp)) + 0.1875;
    [x, y] = rot(x, y);
    f += 0.25 * (mix(0.5, vn(x, y), lod(fp, 1)) - 0.5);
    [x, y] = rot(x, y);
    f += 0.125 * (mix(0.5, vn(x, y), lod(fp, 2)) - 0.5);
    const kc = clamp01(1.5 - 2.5 * CELLS_PER_UNIT.low * fp);
    const [cx, cy] = cellv(...rotC(qx * CELLS_PER_UNIT.low, qy * CELLS_PER_UNIT.low));
    const d = f * mix(1, mix(0.5, 1 - kc * Math.hypot(cx, cy), kc), billow);
    return mix(d, STRATUS.floor + (1 - STRATUS.floor) * d, stratus);
  };
  /** MID's density before its threshold: a patch mask times its cells' domes. */
  const mid = (qx: number, qy: number, fp: number) => {
    const kc = clamp01(1.5 - 2.5 * CELLS_PER_UNIT.mid * fp);
    const [cx, cy] = cellv(...rotC(qx * CELLS_PER_UNIT.mid, qy * CELLS_PER_UNIT.mid));
    return vn(qx * 0.25 + 3.1, qy * 0.25 + 7.7) * (0.4 + 0.6 * mix(0.5, 1 - kc * Math.hypot(cx, cy), kc));
  };

  /**
   * The density a coverage means for a sheet: the quantile of its noise's distribution. The distribution doesn't
   * depend on where the wind has left the sheet, so it's sampled once per sheet and style, without wind.
   */
  const threshold = (s: SheetId, cover: number, billow: number, warp: number, stratus = 0) => {
    const key = `${s}|${billow}|${warp}|${stratus}`;
    let sorted = dist.get(key);
    if (!sorted) {
      const n = 1024;
      const vals = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        // Scattered, not on a lattice.
        const qx = ((i * 0.6180339887) % 1) * 64;
        const qy = ((i * 0.7548776662) % 1) * 64;
        vals[i] = s === "low" ? low(qx, qy, 0, warp, billow, 0, stratus) : s === "mid" ? mid(qx, qy, 0) : fbm(qx, qy, 0, 2);
      }
      vals.sort();
      sorted = vals;
      dist.set(key, sorted);
    }
    return sorted[Math.min(sorted.length - 1, Math.floor((1 - Math.min(1, Math.max(0, cover))) * sorted.length))]!;
  };

  const height = (y: number, c: CloudInputs) => (c.cloudHz - y) / c.cloudHz;
  /** A sheet's density at a CSS px: 0 under the cloud horizon. */
  const density = (s: SheetId, x: number, y: number, c: CloudInputs): number => {
    const v = height(y, c);
    if (v <= 0) return 0;
    const { x: ax, s: depth, fp } = planePoint(x, y, s, c.vw, c.cloudHz, c.px);
    const st = c.sheets[s];
    const qx = ax + st.x * SHEET[s].freq;
    const qy = depth + st.z * SHEET[s].freq;
    const cover = c.cover[s];
    // Every edge is centred on the threshold (the shader's too), so a coverage is the share of the sky past its middle.
    const th = threshold(s, cover, c.billow, c.warp, c.stratus);
    const e = (s === "low" ? mix(EDGE, STRATUS.edge, c.stratus) : s === "mid" ? EDGE : s === "high" ? SOFT.high : SOFT.scud) / 2;
    if (s === "low") return sm(th - e, th + e, low(qx, qy, fp, c.warp, c.billow, st.evo, c.stratus));
    if (s === "mid") return sm(th - e, th + e, mid(qx, qy, fp));
    if (s === "high") {
      const [wx, wz] = c.wind;
      const sx = (wx * qx + wz * qy) / SHEET.high.stretch;
      const sy = -wz * qx + wx * qy;
      // Its warp (the shader's too): the cirrus evolves.
      const ox = sx * 0.3 + 5.1 + st.evo;
      const oy = sy * 0.3 + 11.3 + st.evo * 0.7;
      return sm(th - e, th + e, fbm(sx + 0.35 * (tap(noiseTex, ox, oy, 0) - 0.5), sy + 0.35 * (tap(noiseTex, ox, oy, 1) - 0.5), fp, 2));
    }
    return sm(th - e, th + e, fbm(qx, qy, fp, 2));
  };
  /** A sheet's opacity at a CSS px: its density, but a stratus deck's is never under STRATUS.opaque while it has any
   *  cover at all (the shader's `op`). */
  const opacity = (s: SheetId, x: number, y: number, c: CloudInputs) => {
    const d = density(s, x, y, c);
    return s === "low" && d > 0 ? Math.max(d, STRATUS.opaque * c.stratus) : d;
  };
  /** What a sheet adds to a pixel: opacity × its alpha × the haze at the horizon × (1 − fog). */
  const alphaOf = (s: SheetId, x: number, y: number, c: CloudInputs) => {
    if (c.cover[s] <= 0.001) return 0;
    const op = opacity(s, x, y, c);
    return op <= 0 ? 0 : op * SHEET[s].alpha * sm(0, HAZE, height(y, c)) * (1 - 0.6 * c.fog);
  };

  return {
    resize(w: number, h: number) {
      vw = Math.max(1, w);
      vh = Math.max(1, h);
    },
    update(c: CloudInputs) {
      cur = c;
      for (let j = 0; j < GRID_H; j++) {
        const y = ((j + 0.5) / GRID_H) * vh;
        for (let i = 0; i < GRID_W; i++) {
          const x = ((i + 0.5) / GRID_W) * vw;
          let m = 0;
          for (const s of SHEETS) m = Math.max(m, alphaOf(s, x, y, c));
          grid[j * GRID_W + i] = m;
        }
      }
      ready = true;
    },
    get ready() {
      return ready;
    },
    /** Cloud alpha at a CSS px point (0 clear … 0.95 the densest deck). */
    at(x: number, y: number): number {
      if (!cur) return 0;
      let m = 0;
      for (const s of SHEETS) m = Math.max(m, alphaOf(s, x, y, cur));
      return m;
    },
    /** Optical depth of LOW and MID at a CSS px: what the sun's and the moon's light crosses (a disc is exp(−1.8 τ)). */
    tau(x: number, y: number): number {
      if (!cur) return 0;
      return density("low", x, y, cur) * SHEET.low.thick + density("mid", x, y, cur) * SHEET.mid.thick;
    },
    threshold,
    /** Maximum over a rectangle (the grid cells it touches), for the backing model (src/lib/sky/backing.ts). */
    maxIn(x0: number, y0: number, x1: number, y1: number): number {
      if (!ready) return -1;
      let m = 0;
      const i0 = Math.max(0, Math.floor((x0 / vw) * GRID_W));
      const i1 = Math.min(GRID_W - 1, Math.floor((x1 / vw) * GRID_W));
      const j0 = Math.max(0, Math.floor((y0 / vh) * GRID_H));
      const j1 = Math.min(GRID_H - 1, Math.floor((y1 / vh) * GRID_H));
      for (let j = j0; j <= j1; j++)
        for (let i = i0; i <= i1; i++) m = Math.max(m, grid[j * GRID_W + i]!);
      return m;
    },
  };
}

export type CloudField = ReturnType<typeof createCloudField>;
