/**
 * The noise recipes (owner T1): which octaves build every channel of SHAPE and DETAIL, and the two contrast constants.
 * One table feeds both the GLSL (glsl.ts, through noise-gpu.ts's uniforms) and the CPU reference (reference.ts), so
 * the two cannot drift apart. tests/unit/vol-noise.test.ts checks that they agree.
 */

/**
 * One octave of a channel: `freq` cells along a tile edge, its weight `amp` (the octave's share of the channel) and the
 * hash seed that picks its lattice. The tile wraps only for a whole number of cells, and every frequency here is a
 * power of two below 64, which is what the GLSL relies on: the lattice wraps with a mask, and a cell (below 32) and its
 * seed (below 2^17) pack together into the hash's one word. The tests hold the recipes to that.
 */
export type Octave = { freq: number; amp: number; seed: number };

/** An fbm's octave weights at ×1, ×2, ×4: 5/8, 1/4, 1/8 (they sum to 1). */
export const FBM_AMPS: readonly number[] = [0.625, 0.25, 0.125];

/** SHAPE and DETAIL edge lengths in texels (as TIERS: SHAPE is 128 on the high tier). */
export type NoiseSize = 32 | 64 | 128;

/**
 * The highest frequency a texture of `size` texels resolves: 4 texels per Worley cell. Octaves above it are dropped and
 * the rest renormalised, so the lower tiers hold the same noise as 128³ minus the octaves they cannot carry.
 */
export function maxFrequency(size: NoiseSize): number {
  return size / 4;
}

function fbm(
  base: number,
  cap: number,
  seeds: number,
  amps: readonly number[] = FBM_AMPS,
): Octave[] {
  const kept = amps
    .map((amp, k) => ({ freq: base * 2 ** k, amp, seed: seeds + k }))
    .filter((o) => o.freq <= cap);
  const total = kept.reduce((s, o) => s + o.amp, 0);
  return kept.map((o) => ({ ...o, amp: o.amp / total }));
}

/** SHAPE: the Perlin fbm (from 4), the inverted Worley that remaps it (4), and the Worley fbm of G, B and A (from 2, 4, 8). */
export type ShapeRecipe = {
  perlin: Octave[];
  pwWorley: Octave;
  worley: [Octave[], Octave[], Octave[]];
};

const shapeCache = new Map<64 | 128, ShapeRecipe>();

export function shapeRecipe(shapeSize: 64 | 128): ShapeRecipe {
  let r = shapeCache.get(shapeSize);
  if (!r) {
    const cap = maxFrequency(shapeSize);
    shapeCache.set(
      shapeSize,
      (r = {
        perlin: fbm(4, cap, 0x100, [1, 0.5, 0.25, 0.125]),
        pwWorley: { freq: 4, amp: 1, seed: 0x200 },
        worley: [fbm(2, cap, 0x300), fbm(4, cap, 0x400), fbm(8, cap, 0x500)],
      }),
    );
  }
  return r;
}

/** DETAIL: the Worley fbm of R, G and B, from 2, 4 and 8 (32³, so 8 is its top octave). */
export const detailRecipe = (): [Octave[], Octave[], Octave[]] => [
  fbm(2, maxFrequency(32), 0x600),
  fbm(4, maxFrequency(32), 0x700),
  fbm(8, maxFrequency(32), 0x800),
];

/**
 * Perlin fbm → 0..1 is clamp(0.5 + fbm / PERLIN_SPAN). The fbm's spread is only ±0.16 (it is a bell around 0), so
 * 0.6 widens it to a standard deviation of 0.26, with about 4% at 0 and 1% at 1.
 */
export const PERLIN_SPAN = 0.6;

/**
 * Contrast of a Worley fbm channel: clamp(0.5 + (fbm − 0.5) × WORLEY_GAIN). Averaging octaves narrows the inverted
 * Worley to about 0.15..0.85; ×2 puts 2–5% of a channel at 0 and 1–2% at 1, with the median at 0.45 and the 5th and
 * 95th percentiles near 0.03 and 0.86 (DETAIL's single-octave B: 10% and 6%). Measured on a 24³ volume.
 */
export const WORLEY_GAIN = 2;

/** BLUE: a 64×64 R8 texture of blue noise (void-and-cluster on the CPU, once per session: blue.ts). */
export const BLUE_SIZE = 64;
