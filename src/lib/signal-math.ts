/**
 * Signal Field intensity, in plain TS. The GLSL in src/components/signal-field/shader.ts is generated
 * from the same constants and mirrors these functions line for line. Used by tests and as the reference.
 * Units: CSS px and seconds. Origin: viewport top-left.
 */

export const SF = {
  pitch: 22,
  rBase: 0.9,
  rGain: 1.1,
  aa: 0.75,
  aMin: 0.16,
  aMax: 0.62,
  idleAmp: 0.06,
  idleLambda: 900, // px
  idlePeriod: 9, // s
  noiseScale: 0.0015,
  noiseTime: 0.05,
  noiseWarp: 1.7,
  cursorGain: 0.45,
  sigma: 140,
  cursorTau: 0.08,
  cursorFade: 0.4,
  v: 420,
  wr: 18,
  tau: 1.6,
  maxEmitters: 8,
  column: 0.25,
  columnHalf: 384,
  columnEdge: 80,
  columnBreak: 808,
  amberMax: 0.35,
} as const;

export type Emitter = { x: number; y: number; amp: number; t0: number };

const fract = (x: number) => x - Math.floor(x);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const smoothstep = (e0: number, e1: number, x: number) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** Same hash as the shader. Float precision differs (JS doubles vs GLSL floats); shape is identical. */
function hash(x: number, y: number): number {
  return fract(Math.sin(x * 127.1 + y * 311.7) * 43758.5453);
}

/** 2D value noise in [-1, 1]. */
export function vnoise(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy);
  const b = hash(ix + 1, iy);
  const c = hash(ix, iy + 1);
  const d = hash(ix + 1, iy + 1);
  return mix(mix(a, b, ux), mix(c, d, ux), uy) * 2 - 1;
}

export function idle(x: number, y: number, t: number): number {
  const k = (2 * Math.PI) / SF.idleLambda;
  const w = (2 * Math.PI) / SF.idlePeriod;
  const n = vnoise(x * SF.noiseScale, y * SF.noiseScale + t * SF.noiseTime);
  return SF.idleAmp * (0.5 + 0.5 * Math.sin(k * x - w * t + SF.noiseWarp * n));
}

/** gain in [0, 1] scales SF.cursorGain (pointer-leave fade). */
export function cursor(x: number, y: number, cx: number, cy: number, gain = 1): number {
  const dx = x - cx;
  const dy = y - cy;
  return SF.cursorGain * gain * Math.exp(-(dx * dx + dy * dy) / (SF.sigma * SF.sigma));
}

export function ripple(x: number, y: number, t: number, e: Emitter): number {
  const age = t - e.t0;
  if (age < 0 || age > 5 * SF.tau) return 0;
  const r = Math.hypot(x - e.x, y - e.y);
  const front = r - SF.v * age;
  return e.amp * Math.exp(-(front * front) / (SF.wr * SF.wr)) * Math.exp(-age / SF.tau);
}

export function ripples(x: number, y: number, t: number, emitters: readonly Emitter[]): number {
  let s = 0;
  for (const e of emitters) s += ripple(x, y, t, e);
  return s;
}

/** 1 in the gutters, SF.column inside the 768px column, smoothstep over SF.columnEdge px into each gutter. */
export function columnMask(x: number, viewportWidth: number): number {
  if (viewportWidth < SF.columnBreak) return SF.column;
  const g = Math.abs(x - viewportWidth / 2) - SF.columnHalf; // px into the gutter (negative inside the column)
  return mix(SF.column, 1, smoothstep(0, SF.columnEdge, g));
}

export type FieldState = { t: number; vw: number; cx: number; cy: number; gain: number; emitters: readonly Emitter[] };

/** Unmasked intensity, clamped. */
export function rawIntensity(x: number, y: number, s: FieldState): number {
  return clamp01(idle(x, y, s.t) + cursor(x, y, s.cx, s.cy, s.gain) + ripples(x, y, s.t, s.emitters));
}

/** I(p, t) = clamp(idle + cursor + ripples, 0, 1) * columnMask(p) */
export function intensity(x: number, y: number, s: FieldState): number {
  return rawIntensity(x, y, s) * columnMask(x, s.vw);
}

/**
 * Peak dot alpha for a cell (coverage = 1). The mask scales the whole alpha, floor included, so the column
 * stays at mask × [aMin, aMax].
 */
export function dotAlpha(x: number, y: number, s: FieldState): number {
  return mix(SF.aMin, SF.aMax, rawIntensity(x, y, s)) * columnMask(x, s.vw);
}

export function dotRadius(i: number): number {
  return SF.rBase + SF.rGain * i;
}

/** Fraction toward --signal: only where the (masked) ripple term dominates. Cursor never turns amber. */
export function amber(x: number, y: number, s: FieldState): number {
  return SF.amberMax * smoothstep(0.5, 1, ripples(x, y, s.t, s.emitters) * columnMask(x, s.vw));
}

/** Frame-rate independent pointer smoothing. */
export function smoothToward(current: number, target: number, dt: number, tau = SF.cursorTau): number {
  return current + (target - current) * (1 - Math.exp(-dt / tau));
}

/** Fixed-size emitter ring buffer, laid out for uniform upload: pos = [x, y, amp] × N, t0 × N. */
export class EmitterRing {
  readonly pos = new Float32Array(SF.maxEmitters * 3);
  readonly t0 = new Float32Array(SF.maxEmitters).fill(-1e6);
  private head = 0;

  push(x: number, y: number, amp: number, t: number): void {
    const i = this.head;
    this.pos[i * 3] = x;
    this.pos[i * 3 + 1] = y;
    this.pos[i * 3 + 2] = amp;
    this.t0[i] = t;
    this.head = (i + 1) % SF.maxEmitters;
  }

  active(t: number): boolean {
    for (let i = 0; i < SF.maxEmitters; i++) if (t - this.t0[i]! <= 5 * SF.tau) return true;
    return false;
  }

  list(): Emitter[] {
    return Array.from({ length: SF.maxEmitters }, (_, i) => ({
      x: this.pos[i * 3]!,
      y: this.pos[i * 3 + 1]!,
      amp: this.pos[i * 3 + 2]!,
      t0: this.t0[i]!,
    }));
  }
}
