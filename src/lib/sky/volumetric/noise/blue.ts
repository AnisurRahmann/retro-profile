/**
 * BLUE (owner T1): 64×64 blue noise by void-and-cluster (Ulichney, 1993), computed on a torus so the texture tiles
 * under REPEAT. Once per session (memoised): a few ms for BLUE_SIZE² bytes, each of 0..255 at 16 texels.
 *
 * Every live pixel carries an energy: a Gaussian of the toroidal distance to the on-pixels around it (σ 1.5, cut at
 * radius 5), in 1/256 steps so energies are integers that sit in buckets. A swap phase moves the tightest cluster (the
 * on-pixel with the most energy) into the largest void (the off-pixel with the least) until no on-pixel is worse off
 * than any off-pixel. The prototype is then ranked, each ranked pixel retiring from the pattern: its on-pixels,
 * tightest first, take the lowest values; then the off-pixels, emptiest first, the rest.
 */
import { mulberry32 } from "@/lib/sky/random";
import { BLUE_SIZE } from "./recipes";

const N = BLUE_SIZE;
const M = N * N;
const MASK = N - 1;
const SHIFT = Math.log2(N);
/** The prototype's on-pixels: an eighth of the texture, a minority as the method asks. */
const ON_COUNT = M / 8;
const SIGMA = 1.5;
const RADIUS = 5;
const WEIGHT_SCALE = 256;
const SEED = 0x5eed;
/** Pixel states: off pixels are void candidates, on pixels cluster candidates, retired ones are ranked and out. */
const OFF = 0;
const ON = 1;
const RETIRED = 2;

function kernel(): { dx: Int32Array; dy: Int32Array; w: Int32Array; cap: number } {
  const dx: number[] = [];
  const dy: number[] = [];
  const w: number[] = [];
  let sum = 0;
  for (let y = -RADIUS; y <= RADIUS; y++) {
    for (let x = -RADIUS; x <= RADIUS; x++) {
      const d2 = x * x + y * y;
      // A pixel's own state is not part of its energy (f(0) = 0).
      if (d2 === 0 || d2 > RADIUS * RADIUS) continue;
      const weight = Math.round(Math.exp(-d2 / (2 * SIGMA * SIGMA)) * WEIGHT_SCALE);
      if (weight <= 0) continue;
      dx.push(x);
      dy.push(y);
      w.push(weight);
      sum += weight;
    }
  }
  // No pixel can hold more than every kernel weight at once.
  return { dx: Int32Array.from(dx), dy: Int32Array.from(dy), w: Int32Array.from(w), cap: sum + 1 };
}

function voidAndCluster(): Uint8Array {
  const { dx, dy, w, cap } = kernel();
  const energy = new Int32Array(M);
  const state = new Uint8Array(M);
  // Bucket lists: headOn[b] and headOff[b] are the first on- and off-pixel of energy b (-1: empty); next and prev
  // chain them. lo and hi are the lowest and highest bucket that can hold anything.
  const headOn = new Int32Array(cap).fill(-1);
  const headOff = new Int32Array(cap).fill(-1);
  const next = new Int32Array(M);
  const prev = new Int32Array(M);
  let lo = 0;
  let hi = 0;

  const link = (i: number): void => {
    const head = state[i] === ON ? headOn : headOff;
    const b = energy[i]!;
    next[i] = head[b]!;
    prev[i] = -1;
    if (next[i]! >= 0) prev[next[i]!] = i;
    head[b] = i;
  };
  const cut = (i: number): void => {
    const head = state[i] === ON ? headOn : headOff;
    const p = prev[i]!;
    const n = next[i]!;
    if (p >= 0) next[p] = n;
    else head[energy[i]!] = n;
    if (n >= 0) prev[n] = p;
  };
  /** Gives a live pixel a new energy (it stays on or off). */
  const move = (i: number, e: number): void => {
    if (state[i] === RETIRED) return;
    cut(i);
    energy[i] = e;
    link(i);
    if (state[i] === ON) hi = Math.max(hi, e);
    else lo = Math.min(lo, e);
  };
  /** Moves pixel t to a new state and shifts its neighbours' energies with its being on (+1) or not (−1). */
  const setState = (t: number, to: number, delta: number): void => {
    cut(t);
    state[t] = to;
    if (to !== RETIRED) link(t);
    if (to === ON) hi = Math.max(hi, energy[t]!);
    else if (to === OFF) lo = Math.min(lo, energy[t]!);
    const tx = t & MASK;
    const ty = t >> SHIFT;
    for (let k = 0; k < dx.length; k++) {
      const j = (((ty + dy[k]!) & MASK) << SHIFT) | ((tx + dx[k]!) & MASK);
      move(j, energy[j]! + delta * w[k]!);
    }
  };
  // Below lo and above hi every bucket is empty, and both only ever move outward between lookups.
  const largestVoid = (): number => {
    while (headOff[lo]! < 0) lo++;
    return headOff[lo]!;
  };
  const tightestCluster = (): number => {
    while (headOn[hi]! < 0) hi--;
    return headOn[hi]!;
  };

  // A random pattern of ON_COUNT on-pixels (a partial Fisher-Yates of the indices) ...
  const rand = mulberry32(SEED);
  const order = new Uint16Array(M);
  for (let i = 0; i < M; i++) {
    order[i] = i;
    link(i);
  }
  for (let k = 0; k < ON_COUNT; k++) {
    const j = k + Math.floor(rand() * (M - k));
    [order[k], order[j]] = [order[j]!, order[k]!];
    setState(order[k]!, ON, 1);
  }
  // ... swapped into the prototype: no on-pixel denser than any off-pixel.
  for (let swaps = 0; swaps < 4 * M; swaps++) {
    const voidPixel = largestVoid();
    const cluster = tightestCluster();
    if (energy[cluster]! <= energy[voidPixel]!) break;
    setState(cluster, OFF, -1);
    setState(voidPixel, ON, 1);
  }
  // Ranking: the prototype's on-pixels, tightest first ...
  const rank = new Int32Array(M);
  let r = 0;
  for (let k = 0; k < ON_COUNT; k++) {
    const c = tightestCluster();
    rank[c] = r++;
    setState(c, RETIRED, -1);
  }
  // ... then the off-pixels, emptiest first (each is filled in, so it stops being a void).
  while (r < M) {
    const v = largestVoid();
    rank[v] = r++;
    setState(v, ON, 1);
  }
  const out = new Uint8Array(M);
  for (let i = 0; i < M; i++) out[i] = Math.floor((rank[i]! * 256) / M);
  return out;
}

let cached: Uint8Array | null = null;

/** BLUE_SIZE² bytes of blue noise, row-major: the same texture every time (seeded). */
export function blueNoise(): Uint8Array {
  return (cached ??= voidAndCluster());
}
