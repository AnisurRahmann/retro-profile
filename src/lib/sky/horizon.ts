/**
 * Where the sky's horizon is on screen. Pure; shared by the CSS gradient (custom properties on the gradient layer),
 * the atmosphere shader (uHorizonY, uHorizonB) and the backing model.
 *
 * The sky is a gradient in one parameter p (0 zenith, 0.55 mid, 1 horizon). Gutter and centre modes: the fixed
 * landscape band sits on the viewport bottom, so p = y / vh.
 *
 * Scene mode (< 1100px with the stage), the horizon tracks the visible ground:
 * - "away" (no scene near the viewport): the horizon is pushed below the viewport, A = 1.45 vh, p = y / A, so the
 *   bottom of the screen shows the mid sky, not the horizon colour, while the cards scroll.
 * - a scene's band is on screen (its bottom B > 0) and its ground line G (the foot of its far hills) is above A:
 *   the horizon is G. Above G the sky runs zenith → mid → horizon (p = y / G); from B down (the scene's ground
 *   fade and below) the sky is the "away" sky again (p = y / A), reached from the horizon colour behind the
 *   opaque ground between G and B.
 *   So no horizon colour ever shows beneath a scene, and a scene entering from below (G falls from A) or leaving
 *   at the top (B rises past 0) changes nothing on screen at the moment it does: the hand-over is continuous.
 * - The one real jump, one scene handing straight to another (short pages), eases with a critically damped spring
 *   (ω = 8 rad/s) on H and B.
 */
import { oklabToRgb, rgbToOklab, type Lab, type RGB } from "./color";

/** Mid colour's position between the zenith (0) and the horizon (1). */
export const SKY_MID_AT = 0.55;
/** Where the horizon goes when no ground line is in view, × vh. */
export const HORIZON_AWAY = 1.45;
/** Spring stiffness for a scene-to-scene hand-over, rad/s. */
export const HORIZON_OMEGA = 8;
/** The fade from a scene's ground into the sky below it, px. */
export const GROUND_FADE = 48;

/** A scene, viewport px: its ground line (the horizon behind it) and its band's bottom (where its ground fade starts). */
export type SceneLine = { id: string; ground: number; bottom: number };
/** h: the horizon line; b: where the sky under a scene is back to the "away" sky (b = h: nothing under it). */
export type Horizon = { h: number; b: number };

/** The gradient parameter at viewport y (0 zenith … 1 horizon) for horizon hz, with the "away" horizon at a. */
export function skyParam(y: number, hz: Horizon, a: number): number {
  const { h, b } = hz;
  if (y <= h) return h > 0 ? Math.max(0, y) / h : 1;
  if (y <= b) return 1 + (Math.min(1, b / a) - 1) * ((y - h) / Math.max(1e-6, b - h));
  return Math.min(1, Math.max(0, y) / a);
}

/** Gutter/centre mode, and the default before anything is measured: the horizon on the viewport bottom. */
export const flatHorizon = (vh: number): Horizon => ({ h: vh, b: vh });
/** The "away" horizon for a viewport height. */
export const awayY = (vh: number) => HORIZON_AWAY * vh;

/** The horizon for the scenes on screen ("" = away). Scenes in document order. */
export function horizonTarget(scenes: SceneLine[], vh: number): Horizon & { id: string } {
  const a = awayY(vh);
  for (const s of scenes)
    if (s.bottom > 0 && s.ground <= a)
      return { id: s.id, h: s.ground, b: Math.max(s.ground, s.bottom) };
  return { id: "", h: a, b: a };
}

/** One step of a critically damped spring toward 0, exact for any dt (frame drops never overshoot). Returns [x, v]. */
export function springStep(
  x: number,
  v: number,
  dt: number,
  omega = HORIZON_OMEGA,
): [number, number] {
  const e = Math.exp(-omega * dt);
  const k = v + omega * x;
  return [(x + k * dt) * e, (v - omega * k * dt) * e];
}

/**
 * The tracker: H and B are the target plus an offset that springs to 0. Only a switch from one scene straight to
 * another sets an offset (it would jump); entering and leaving are continuous (see above) and snap.
 */
export function createHorizonTracker() {
  let id: string | null = null;
  let off: [number, number] = [0, 0];
  let vel: [number, number] = [0, 0];
  let cur: Horizon = { h: 0, b: 0 };
  return {
    step(t: Horizon & { id: string }, dt: number, snap = false): Horizon {
      if (snap || id === null) {
        off = [0, 0];
        vel = [0, 0];
      } else if (t.id !== id && t.id && id) off = [cur.h - t.h, cur.b - t.b];
      id = t.id;
      if (!snap && (off[0] || off[1])) {
        const p = springStep(off[0], vel[0], dt);
        const q = springStep(off[1], vel[1], dt);
        off = [p[0], q[0]];
        vel = [p[1], q[1]];
        if (Math.abs(off[0]) + Math.abs(off[1]) < 0.5 && Math.abs(vel[0]) + Math.abs(vel[1]) < 1) {
          off = [0, 0];
          vel = [0, 0];
        }
      }
      const h = t.h + off[0];
      cur = { h, b: Math.max(h, t.b + off[1]) };
      return cur;
    },
    get current() {
      return cur;
    },
    /** Still easing toward the target. */
    get moving() {
      return off[0] !== 0 || off[1] !== 0;
    },
  };
}

type Colors = { zenith: Lab; mid: Lab; horizon: Lab };
const mix = (p: RGB, q: RGB, t: number) => p.map((v, i) => v + (q[i]! - v) * t) as RGB;
/** The sky colour at gradient parameter p, in sRGB (as the browser interpolates between stops). */
export function skyRgb(c: Colors, p: number): RGB {
  const [z, m, h] = [c.zenith, c.mid, c.horizon].map(oklabToRgb) as [RGB, RGB, RGB];
  return p < SKY_MID_AT
    ? mix(z, m, Math.max(0, p) / SKY_MID_AT)
    : mix(m, h, Math.min(1, (p - SKY_MID_AT) / (1 - SKY_MID_AT)));
}
/** The gradient's colour at viewport y. */
export const gradientRgb = (c: Colors, y: number, hz: Horizon, a: number): RGB =>
  skyRgb(c, skyParam(y, hz, a));
export const gradientLab = (c: Colors, y: number, hz: Horizon, a: number): Lab =>
  rgbToOklab(gradientRgb(c, y, hz, a));

/**
 * The CSS for the gradient layer (custom properties; globals.css .sky-gradient draws the stops): the horizon line,
 * the bottom of the scene's fade and the colour there (a color-mix of the live sky colours, so weather and preview
 * transitions stay in step), and the mid stop of the "away" sky below it.
 */
export function horizonCss(hz: Horizon, a: number): Record<string, string> {
  const pb = Math.min(1, Math.max(0, hz.b / a));
  const ret =
    pb < SKY_MID_AT
      ? `color-mix(in srgb, var(--sky-zenith), var(--sky-mid) ${((100 * pb) / SKY_MID_AT).toFixed(2)}%)`
      : `color-mix(in srgb, var(--sky-mid), var(--sky-horizon) ${((100 * (pb - SKY_MID_AT)) / (1 - SKY_MID_AT)).toFixed(2)}%)`;
  const px = (v: number) => `${v.toFixed(1)}px`;
  return {
    "--sky-h": px(hz.h),
    "--sky-b": px(hz.b),
    "--sky-ret": ret,
    "--sky-t": px(Math.max(hz.b, SKY_MID_AT * a)),
    "--sky-tail": pb < SKY_MID_AT ? "var(--sky-mid)" : ret,
    "--sky-a": px(a),
  };
}
