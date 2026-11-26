/**
 * Fog with depth (Weather v6, W6). Pure numbers, shared by the landscape that draws the distance fade and the
 * ground fog, the sun and moon, and the tests.
 */

/** How far each landscape layer fades into the fog's colour: the far hills almost gone, the near ground barely. */
export const FOG_AT = { L1: 0.85, L2: 0.6, L3: 0.3, L4: 0.08 } as const;

/** Three bands of ground fog: their height in px, and how fast they drift (px/s; the nearest, the tallest, the fastest). */
export const GROUND_FOG = [
  { h: 30, speed: 2.2 },
  { h: 60, speed: 3.4 },
  { h: 110, speed: 5 },
] as const;
/** A band's alpha range. */
export const FOG_ALPHA = [0.18, 0.32] as const;
/** The ground fog's noise is this many times wider than it is tall. */
export const FOG_STRETCH = 12;
/** One lattice cell of it, px across and down, and the width it tiles at (four cells). */
export const FOG_CELL = 240;
export const FOG_PERIOD = 4 * FOG_CELL;

const hash = (i: number, j: number) => {
  let h = Math.imul(i * 374761393 + j * 668265263, 1274126177);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
};
const sm = (t: number) => t * t * (3 - 2 * t);

/**
 * A band of ground fog's alpha at (x, y), y from its top in a band `h` px tall, band `k` (0 the lowest): three
 * octaves of a value noise stretched FOG_STRETCH : 1, tiling every FOG_PERIOD px, steepened into wisps, denser
 * toward the ground, in FOG_ALPHA.
 */
export function groundFog(x: number, y: number, h: number, k: number): number {
  if (y < 0 || y > h) return 0;
  const cell = FOG_CELL / FOG_STRETCH;
  let n = 0;
  let a = 1;
  for (let o = 0; o < 3; o++) {
    const w = o ? 8 : 4;
    const u = (((x % FOG_PERIOD) + FOG_PERIOD) % FOG_PERIOD) / (FOG_PERIOD / w);
    const v = y / (cell / (o ? 2 : 1));
    const i = Math.floor(u);
    const j = Math.floor(v);
    const fu = sm(u - i);
    const fv = sm(v - j);
    const at = (di: number, dj: number) => hash(((i + di) % w) + 10 * k + 100 * o, j + dj);
    const p = at(0, 0);
    const q = at(1, 0);
    const r = at(0, 1);
    const s = at(1, 1);
    n += a * (p + (q - p) * fu + (r - p) * fv + (p - q - r + s) * fu * fv);
    a *= 0.4;
  }
  // Steepened: distinct wisps rather than a smooth veil (1 + 0.4 + 0.16 = 1.56 of noise, about 0.78 on average).
  const t = Math.min(1, Math.max(0, (n / 1.56 - 0.32) / 0.36));
  return (FOG_ALPHA[0] + (FOG_ALPHA[1] - FOG_ALPHA[0]) * t * t * (3 - 2 * t)) * (y / h) ** 0.7;
}

/**
 * Where each band has drifted to after `t` seconds at a wind factor `wind` (1 at 15 km/h, 2 at 30 or more): x in
 * CSS px. In calm air the bands still drift at their own speed, never under 2 px/s.
 */
export const groundFogX = (k: number, t: number, wind: number) => GROUND_FOG[k]!.speed * Math.max(1, Math.min(2, wind)) * t;
