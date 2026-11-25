/**
 * CPU mirror of the atmosphere's cloud field (sky-shader.ts) on a 64×36 grid, refreshed every 500 ms: the sun and
 * moon need to know how much cloud is in front of them, and the crepuscular rays need the gaps. Same noise
 * lattice, same fbm, same warp; values are cloud opacity 0..1 (the shader's cloudA before fog and damping, / 0.85).
 */
import { NOISE_SIZE, noiseData, OCTAVES } from "./sky-shader";

export const GRID_W = 64;
export const GRID_H = 36;
export const CLOUD_REFRESH_S = 0.5;

const N = NOISE_SIZE;

export type CloudInputs = { drift: [number, number]; z: number; cover: number; rainDark: number };

export function createCloudField() {
  const tex = noiseData();
  const grid = new Float32Array(GRID_W * GRID_H);
  let vw = 1,
    vh = 1,
    ready = false;

  // GLSL: f = smoothstep-warped fract; texture((i + f + .5) / N) with LINEAR + REPEAT = bilinear between lattice
  // points i and i + 1 with weight f.
  const lat = (x: number, y: number) => tex[(((y % N) + N) % N) * N + (((x % N) + N) % N)]! / 255;
  const noise = (px: number, py: number) => {
    const ix = Math.floor(px);
    const iy = Math.floor(py);
    let fx = px - ix;
    let fy = py - iy;
    fx = fx * fx * (3 - 2 * fx);
    fy = fy * fy * (3 - 2 * fy);
    const a = lat(ix, iy);
    const b = lat(ix + 1, iy);
    const c = lat(ix, iy + 1);
    const d = lat(ix + 1, iy + 1);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };
  // R = mat2(1.6, 1.2, -1.2, 1.6), column-major: R * p = (1.6 px − 1.2 py, 1.2 px + 1.6 py).
  const fbm3 = (px: number, py: number) => {
    let v = 0;
    let a = 0.5;
    for (let i = 0; i < 3; i++) {
      v += a * noise(px, py);
      const nx = 1.6 * px - 1.2 * py;
      py = 1.2 * px + 1.6 * py;
      px = nx;
      a *= 0.5;
    }
    return v;
  };
  const detail = (px: number, py: number) => {
    for (let i = 0; i < 3; i++) {
      const nx = 1.6 * px - 1.2 * py;
      py = 1.2 * px + 1.6 * py;
      px = nx;
    }
    let v = 0;
    let a = 0.0625;
    for (let i = 3; i < OCTAVES; i++) {
      v += a * noise(px, py);
      const nx = 1.6 * px - 1.2 * py;
      py = 1.2 * px + 1.6 * py;
      px = nx;
      a *= 0.5;
    }
    return v;
  };
  const sm = (e0: number, e1: number, x: number) => {
    const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
    return t * t * (3 - 2 * t);
  };

  /** Cloud opacity at a CSS px point (0 clear … 1 the densest deck). */
  const sample = (x: number, y: number, c: CloudInputs) => {
    if (c.cover <= 0.005) return 0;
    const qx = (x - c.drift[0]) / 400;
    const qy = (y - c.drift[1]) / (190 + 210 * (1 - y / vh));
    const wx = fbm3(qx * 0.6 + 1.7 + c.z, qy * 0.6 + 9.2 + c.z * 0.6);
    const wy = fbm3(qx * 0.6 + 8.3 - c.z * 0.7, qy * 0.6 + 2.8 - c.z);
    const px = qx + 1.6 * (wx - 0.5);
    const py = qy + 1.6 * (wy - 0.5);
    const lo = fbm3(px, py);
    const d = (lo + detail(px, py) - 0.48) * 1.9 + 0.5;
    const th = 0.85 + (0.25 - 0.85) * c.cover;
    const dens = sm(th, th + 0.22, d);
    if (dens <= 0) return 0;
    const thick = sm(th, th + 0.5, d);
    return Math.min(0.85, dens * (0.55 + 0.3 * thick) * (1 + 0.08 * c.rainDark)) / 0.85;
  };

  return {
    resize(w: number, h: number) {
      vw = Math.max(1, w);
      vh = Math.max(1, h);
    },
    update(c: CloudInputs) {
      for (let j = 0; j < GRID_H; j++) {
        const y = ((j + 0.5) / GRID_H) * vh;
        for (let i = 0; i < GRID_W; i++) grid[j * GRID_W + i] = sample(((i + 0.5) / GRID_W) * vw, y, c);
      }
      ready = true;
    },
    get ready() {
      return ready;
    },
    sample,
    /** Bilinear read of the grid at a CSS px point. */
    at(x: number, y: number): number {
      if (!ready) return 0;
      const gx = Math.min(GRID_W - 1.001, Math.max(0, (x / vw) * GRID_W - 0.5));
      const gy = Math.min(GRID_H - 1.001, Math.max(0, (y / vh) * GRID_H - 0.5));
      const i = Math.floor(gx);
      const j = Math.floor(gy);
      const fx = gx - i;
      const fy = gy - j;
      const g = (a: number, b: number) => grid[b * GRID_W + a]!;
      const top = g(i, j) + (g(i + 1, j) - g(i, j)) * fx;
      const bot = g(i, j + 1) + (g(i + 1, j + 1) - g(i, j + 1)) * fx;
      return top + (bot - top) * fy;
    },
    /** Maximum over a rectangle (grid cells it touches), for the text-scrim guard. */
    maxIn(x0: number, y0: number, x1: number, y1: number): number {
      if (!ready) return -1;
      let m = 0;
      const i0 = Math.max(0, Math.floor((x0 / vw) * GRID_W));
      const i1 = Math.min(GRID_W - 1, Math.floor((x1 / vw) * GRID_W));
      const j0 = Math.max(0, Math.floor((y0 / vh) * GRID_H));
      const j1 = Math.min(GRID_H - 1, Math.floor((y1 / vh) * GRID_H));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) m = Math.max(m, grid[j * GRID_W + i]!);
      return m;
    },
  };
}

export type CloudField = ReturnType<typeof createCloudField>;
