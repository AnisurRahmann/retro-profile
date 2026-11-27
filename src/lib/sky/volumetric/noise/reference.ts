/**
 * The CPU reference of the noise (owner T1): the same arithmetic as the GLSL in glsl.ts, in doubles. It is what
 * tests/unit/vol-noise.test.ts checks for tileability and range, and what the GPU's texels are compared against.
 * Every function is periodic in x, y and z over [0, 1): a cell's lattice index wraps at the octave's frequency,
 * a power of two, so the wrap is a mask (& freq − 1) on both sides (an integer remainder would cost the GPU a division).
 */
import { PERLIN_SPAN, WORLEY_GAIN, detailRecipe, shapeRecipe, type Octave } from "./recipes";

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/**
 * 32-bit hash of a lattice cell, for cells below 32 on every axis and seeds below 2^17: the cell and the seed packed
 * into one word, then MurmurHash3's finaliser (public domain), two xorshift-multiply rounds. GLSL's hashCell is the
 * same in uint arithmetic; two integer multiplies is few enough to run 270 times per texel.
 */
export function hashCell(x: number, y: number, z: number, seed: number): number {
  let h = (((z << 10) | (y << 5) | x) ^ (seed << 15)) >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

/** Perlin's fade (quintic): C2-continuous across the lattice. */
const fade = (t: number): number => t * t * t * (t * (t * 6 - 15) + 10);

/**
 * Perlin's 12 edge gradients by hash, each as likely: the axis that is 0, then the two signs. Eight hash bits pick one
 * through a multiply and a shift (22 of 256 for four of them, 21 for the rest), so GLSL needs no integer division.
 */
function gradient(h: number): [number, number, number] {
  const m = ((h & 255) * 12) >>> 8;
  const axis = m >> 2;
  const s = m & 3;
  const a = s < 2 ? 1 : -1;
  const b = (s & 1) === 0 ? 1 : -1;
  return axis === 0 ? [0, a, b] : axis === 1 ? [a, 0, b] : [a, b, 0];
}

/** |perlin| never exceeds this (a single octave's bound; an fbm's weights sum to 1, so it holds there too). */
export const PERLIN_BOUND = Math.sqrt(3) / 2;

/**
 * Improved Perlin noise at a point of the tile, `freq` cells per edge, in [−PERLIN_BOUND, PERLIN_BOUND] (the tests
 * check the bound over a dense lattice).
 */
export function perlin(x: number, y: number, z: number, freq: number, seed: number): number {
  const px = x * freq;
  const py = y * freq;
  const pz = z * freq;
  const cx = Math.floor(px);
  const cy = Math.floor(py);
  const cz = Math.floor(pz);
  const fx = px - cx;
  const fy = py - cy;
  const fz = pz - cz;
  const wrap = freq - 1;
  const corner = (dx: number, dy: number, dz: number): number => {
    const g = gradient(hashCell((cx + dx) & wrap, (cy + dy) & wrap, (cz + dz) & wrap, seed));
    return g[0] * (fx - dx) + g[1] * (fy - dy) + g[2] * (fz - dz);
  };
  const x00 = lerp(corner(0, 0, 0), corner(1, 0, 0), fade(fx));
  const x10 = lerp(corner(0, 1, 0), corner(1, 1, 0), fade(fx));
  const x01 = lerp(corner(0, 0, 1), corner(1, 0, 1), fade(fx));
  const x11 = lerp(corner(0, 1, 1), corner(1, 1, 1), fade(fx));
  return lerp(lerp(x00, x10, fade(fy)), lerp(x01, x11, fade(fy)), fade(fz));
}

/**
 * Worley F1 at a point of the tile, `freq` cells per edge: the distance (in cells) to the nearest cell's feature point,
 * each point placed by its cell's hash. The search covers the 3×3×3 neighbourhood, which is exact whenever F1 < 1.
 */
export function worley(x: number, y: number, z: number, freq: number, seed: number): number {
  const px = x * freq;
  const py = y * freq;
  const pz = z * freq;
  const cx = Math.floor(px);
  const cy = Math.floor(py);
  const cz = Math.floor(pz);
  const wrap = freq - 1;
  let best = Infinity;
  for (let dz = -1; dz <= 1; dz++) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const h = hashCell((cx + dx) & wrap, (cy + dy) & wrap, (cz + dz) & wrap, seed);
        // 10 bits per axis place the point inside its cell.
        const ex = cx + dx + (h & 1023) / 1024 - px;
        const ey = cy + dy + ((h >>> 10) & 1023) / 1024 - py;
        const ez = cz + dz + ((h >>> 20) & 1023) / 1024 - pz;
        best = Math.min(best, ex * ex + ey * ey + ez * ez);
      }
    }
  }
  return Math.sqrt(best);
}

/** Inverted Worley: 1 − F1, saturated. 1 at a feature point, 0 a cell or more away from every one. */
export function invertedWorley(
  x: number,
  y: number,
  z: number,
  freq: number,
  seed: number,
): number {
  return clamp01(1 - worley(x, y, z, freq, seed));
}

type Noise = (x: number, y: number, z: number, freq: number, seed: number) => number;

/** An fbm: the octaves' weighted sum (the weights sum to 1, so the sum shares a single octave's range). */
export function fbmOf(
  fn: Noise,
  x: number,
  y: number,
  z: number,
  octaves: readonly Octave[],
): number {
  let s = 0;
  for (const o of octaves) s += o.amp * fn(x, y, z, o.freq, o.seed);
  return s;
}

/** The Perlin fbm as 0..1: clamp(0.5 + fbm / PERLIN_SPAN). */
export function perlinFbm01(x: number, y: number, z: number, octaves: readonly Octave[]): number {
  return clamp01(0.5 + fbmOf(perlin, x, y, z, octaves) / PERLIN_SPAN);
}

/** A Worley fbm channel: the fbm, contrast-stretched over the whole range (WORLEY_GAIN). */
export function worleyChannel(x: number, y: number, z: number, octaves: readonly Octave[]): number {
  return clamp01(0.5 + (fbmOf(invertedWorley, x, y, z, octaves) - 0.5) * WORLEY_GAIN);
}

/** Below this the remap's denominator is floored, so a fully eroded spot (Worley 0) cannot divide by zero. */
export const WORLEY_EPS = 1e-4;

/**
 * SHAPE at a point of the tile (x, y, z in [0, 1), wrapping): R Perlin-Worley, then the Worley fbm channels of G, B, A.
 * R remaps the Perlin fbm (0..1) by the inverted Worley, w: remap(perlin, 1 − w, 1, 0, 1) clamped, so w = 1 keeps the
 * Perlin and smaller w erodes it to 0 (about 48% of the volume is exactly 0).
 */
export function shapeAt(
  x: number,
  y: number,
  z: number,
  shapeSize: 64 | 128,
): [number, number, number, number] {
  const r = shapeRecipe(shapeSize);
  const p = perlinFbm01(x, y, z, r.perlin);
  const w = Math.max(invertedWorley(x, y, z, r.pwWorley.freq, r.pwWorley.seed), WORLEY_EPS);
  return [clamp01((p + w - 1) / w), ...r.worley.map((oct) => worleyChannel(x, y, z, oct))] as [
    number,
    number,
    number,
    number,
  ];
}

/** DETAIL at a point of the tile: the Worley fbm channels of R, G and B. */
export function detailAt(x: number, y: number, z: number): [number, number, number] {
  return detailRecipe().map((oct) => worleyChannel(x, y, z, oct)) as [number, number, number];
}
