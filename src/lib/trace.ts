/**
 * Geometry for FIG. 1, the hero signal trace. Pure and shared by the canvas
 * (animated) and the server-rendered SVG (static / reduced-motion fallback).
 *
 * u is the horizontal position 0..1. The signal changes character at each block:
 * voice -> [STT] quantised -> [STATE MACHINE] slots -> [LLM] token ticks -> [TTS] smooth -> [VERIFIER] flat.
 */

/** Horizontal centres of the five blocks, as fractions of the width. */
export const BLOCK_CENTERS = [0.17, 0.34, 0.51, 0.68, 0.86] as const;
const [C0, C1, C2, C3, C4] = BLOCK_CENTERS;

/** Half of a block, as a fraction of the width: ticks stay in the visible gap between blocks. */
const GAP_INSET = 0.05;

function hash(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function voice(u: number, t: number): number {
  const env = 0.5 + 0.5 * Math.sin(u * 46 - t * 1.4) * Math.sin(u * 13 + t * 0.6);
  const body =
    0.52 * Math.sin(u * 150 - t * 7) +
    0.3 * Math.sin(u * 290 - t * 11.3 + 1) +
    0.18 * Math.sin(u * 520 - t * 17 + 2);
  const noise = (hash(Math.floor(u * 700 + t * 40)) - 0.5) * 0.14;
  return (0.25 + 0.75 * env) * body + noise;
}

/** Trace height at u, in -1..1. `amp` scales the live voice (cursor / scroll energy). */
export function yAt(u: number, t: number, amp: number): number {
  // Inside a block the wire is flat: the block is where the signal is transformed.
  for (const c of BLOCK_CENTERS) if (Math.abs(u - c) < GAP_INSET - 0.002) return 0;
  return signal(u, t, amp);
}

function signal(u: number, t: number, amp: number): number {
  if (u < C0) return voice(u, t) * 0.8 * amp;
  if (u < C1) {
    // After STT: the same signal, sampled and held, visibly quantised.
    const cell = Math.floor((u - t * 0.012) / 0.0062);
    const v = Math.sin(cell * 1.1) * 0.6 + Math.sin(cell * 0.37 + 2) * 0.3;
    return (Math.round(v * 3) / 3) * 0.62;
  }
  if (u < C2) {
    // State machine: discrete slots, either filled or not.
    const cell = Math.floor((u - t * 0.012) / 0.0105);
    return hash(cell) > 0.5 ? 0.42 : -0.42;
  }
  if (u < C3) return 0; // LLM output: baseline, tokens are drawn as ticks
  if (u < C4) return 0.46 * Math.sin(u * 240 - t * 6) * (0.75 + 0.25 * Math.sin(u * 31 - t * 1.3));
  return 0; // Verified: flat PASS
}

export type Tick = { u: number; h: number };

/** Discrete token ticks between LLM and TTS. */
export function tokenTicks(t: number): Tick[] {
  const step = 0.0085;
  const shift = (t * 0.012) % step;
  const out: Tick[] = [];
  const first = Math.floor((t * 0.012) / step);
  for (let i = 0, u = C2 + GAP_INSET + shift; u < C3 - GAP_INSET; i++, u += step) {
    out.push({ u, h: 0.14 + hash(i - first) * 0.26 });
  }
  return out;
}

/** Positions (0..1) of the pulses travelling along the wire. */
export function pulses(t: number, count = 5): number[] {
  return Array.from({ length: count }, (_, i) => (t * 0.09 + i / count) % 1);
}

/** Static path for the SVG fallback, in a width x height box. */
export function staticTracePath(width: number, height: number, t = 0.6, amp = 1): string {
  const mid = height / 2;
  const scale = height * 0.4;
  let d = "";
  for (let x = 0; x <= width; x += 2) {
    const y = mid - yAt(x / width, t, amp) * scale;
    d += `${x === 0 ? "M" : "L"}${x} ${Math.round(y * 10) / 10}`;
  }
  return d;
}

export function staticTickPath(width: number, height: number, t = 0.6): string {
  const mid = height / 2;
  const scale = height * 0.4;
  return tokenTicks(t)
    .map((k) => {
      const x = Math.round(k.u * width * 10) / 10;
      return `M${x} ${mid}L${x} ${Math.round((mid - k.h * scale) * 10) / 10}`;
    })
    .join("");
}
