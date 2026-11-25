/**
 * The plane at Osmani Airport: its silhouette and its take-off, as pure functions (drawn by
 * src/components/sky/life.ts, triggered by the renderer).
 *
 * Silhouette: a narrow-body airliner in side view, nose to the left (it always takes off toward the viewport's
 * centre, and the airport stands right of it: the right gutter on desktop, right of centre in the closing scene).
 * Local units, origin at the main gear's contact point, y up negative; PLANE_LEN units nose to tail.
 *
 * Take-off, 4.6 s (planeAt):
 * - 0–0.5 s taxi from the gate onto the runway's threshold at 18 px/s (and down onto the runway's centreline),
 * - 0.5–2.0 s take-off roll at constant acceleration, x = x₀ + ½·a·t², reaching the rotation point at the end of the
 *   visible runway,
 * - 2.0–2.35 s rotation, pitch 0 → 9°, still rolling,
 * - 2.35–4.6 s climb on a 12° flight path, scale 1 → 0.55 (it's flying away), gear up at 2.75 s, fading over the
 *   last 0.6 s or as it leaves the viewport.
 * Then it's gone; 2.5 s later the next plane fades in at the gate over 600 ms (RESPAWN_S, FADE_IN_S).
 */
export const TAXI_S = 0.5;
export const ROLL_END_S = 2.0;
export const ROTATE_END_S = 2.35;
export const GEAR_UP_S = 2.75;
export const TAKEOFF_S = 4.6;
export const FADE_S = 0.6;
export const TAXI_PX_S = 18;
export const PITCH_ROTATE = 9;
export const CLIMB_DEG = 12;
export const SCALE_END = 0.55;
/** After it's gone: the gap before the next plane appears at the gate, and its fade-in. */
export const RESPAWN_S = 2.5;
export const FADE_IN_S = 0.6;

/** Nose (x = −20.2) to tail (x = 21.4), units. */
export const PLANE_LEN = 41.6;
/** Plane length on screen, px: 90 on phones, 100 above (v5.1 T5: it was 70 and 90). */
export const planePx = (vw: number) => (vw < 640 ? 90 : 100);

/** Fuselage, fin, stabiliser, wing root and engine nacelle: one silhouette. */
export const PLANE_BODY =
  // Fuselage: rounded nose (left), straight crown and belly, tail cone rising to the right.
  "M-14 -6.6L12 -6.6C15.5 -6.6 18.5 -6.5 20.6 -6.1L20.6 -5.3C17 -4.4 12.5 -2.2 9 -2.2L-15 -2.2C-18 -2.2 -20.2 -3 -20.2 -4.1C-20.2 -5.4 -17.8 -6.6 -14 -6.6Z" +
  // Fin, swept back.
  "M12.5 -6.6L16.6 -15L19.4 -15L20.2 -6.2Z" +
  // Horizontal stabiliser (a sliver in side view).
  "M15.5 -5.6L21.2 -6.8L21.4 -6L16 -4.9Z" +
  // Wing root fairing.
  "M-6 -3.4L2.5 -3.6L5.5 -2.4L-5 -2Z" +
  // Engine nacelle under the wing, forward of it.
  "M-9.5 -2.6H-2.5C-1.4 -2.6 -1.2 -0.7 -2.5 -0.7H-9.5C-10.4 -0.7 -10.4 -2.6 -9.5 -2.6Z";
/** Landing gear: main (at the origin) and nose. */
export const PLANE_GEAR =
  "M-0.3 -2.2h0.6v1.75h-0.6Z M0 -0.45m-0.45 0a0.45 0.45 0 1 0 0.9 0a0.45 0.45 0 1 0 -0.9 0Z M-16.2 -2.2h0.4v1.8h-0.4Z M-16 -0.4m-0.4 0a0.4 0.4 0 1 0 0.8 0a0.4 0.4 0 1 0 -0.8 0Z";
/** Light positions (local units): the red beacon on top of the fuselage, a wingtip strobe, the landing light. */
// (Documented in life.ts drawPlane: the beacon flashes at 1 Hz, the strobe twice every 1.2 s, from sunset to sunrise.)
export const PLANE_LIGHTS = {
  beacon: [-1, -6.9],
  strobe: [3.5, -2.6],
  landing: [-15, -1.6],
} as const;

export type PlaneState = "parked" | "taxi" | "roll" | "climb" | "gone";

export type TakeoffParams = {
  /** The main gear at the gate (px, band canvas coordinates: x on screen at the start, y down). */
  x0: number;
  y0: number;
  /** The runway's centreline y (px). */
  runwayY: number;
  /** Direction of the roll: −1 = to the left. */
  dir: -1 | 1;
  /** Roll distance from the threshold to the rotation point (the end of the visible runway), px. */
  rollPx: number;
  /** Visible area (px, same coordinates): it fades as it leaves. */
  bounds?: { x0: number; x1: number; y0: number };
};

export type PlaneFrame = {
  x: number;
  y: number;
  pitchDeg: number;
  scale: number;
  gearDown: boolean;
  alpha: number;
  state: PlaneState;
};

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (x: number) => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};

/** Where the plane is t seconds after the take-off started (t < 0: parked at the gate). */
export function planeAt(t: number, p: TakeoffParams): PlaneFrame {
  const parked: PlaneFrame = {
    x: p.x0,
    y: p.y0,
    pitchDeg: 0,
    scale: 1,
    gearDown: true,
    alpha: 1,
    state: "parked",
  };
  if (t < 0) return parked;
  const xT = p.x0 + p.dir * TAXI_PX_S * TAXI_S; // the threshold
  const rollS = ROLL_END_S - TAXI_S;
  const a = (2 * p.rollPx) / (rollS * rollS);
  const v = a * rollS; // speed at the rotation point, px/s
  const xR = xT + p.dir * p.rollPx;
  let f: PlaneFrame;
  if (t < TAXI_S) {
    f = {
      ...parked,
      x: p.x0 + p.dir * TAXI_PX_S * t,
      y: p.y0 + (p.runwayY - p.y0) * smooth(t / TAXI_S),
      state: "taxi",
    };
  } else if (t < ROLL_END_S) {
    const s = t - TAXI_S;
    f = { ...parked, x: xT + p.dir * 0.5 * a * s * s, y: p.runwayY, state: "roll" };
  } else if (t < ROTATE_END_S) {
    const s = t - ROLL_END_S;
    f = {
      ...parked,
      x: xR + p.dir * v * s,
      y: p.runwayY,
      pitchDeg: PITCH_ROTATE * smooth(s / (ROTATE_END_S - ROLL_END_S)),
      state: "roll",
    };
  } else if (t < TAKEOFF_S) {
    const s = t - ROTATE_END_S;
    const k = s / (TAKEOFF_S - ROTATE_END_S);
    const xL = xR + p.dir * v * (ROTATE_END_S - ROLL_END_S);
    const g = (CLIMB_DEG * Math.PI) / 180;
    // Flying away: the apparent speed shrinks with the plane (perspective: roughly speed × scale²).
    const scale = 1 + (SCALE_END - 1) * k;
    const dist = (v * s * (1 + scale + scale * scale)) / 3;
    f = {
      x: xL + p.dir * dist * Math.cos(g),
      y: p.runwayY - dist * Math.sin(g),
      pitchDeg: PITCH_ROTATE + (CLIMB_DEG - PITCH_ROTATE) * smooth(s / 0.6),
      scale,
      gearDown: t < GEAR_UP_S,
      alpha: clamp01((TAKEOFF_S - t) / FADE_S),
      state: "climb",
    };
  } else return { ...parked, alpha: 0, state: "gone" };
  if (p.bounds) {
    // Fade over the last 40px before it leaves the visible area.
    const b = p.bounds;
    const edge = Math.min(f.x - b.x0, b.x1 - f.x, f.y - b.y0);
    f.alpha *= clamp01(edge / 40);
  }
  return f;
}

/** The plane's state and alpha at the gate after a take-off at `t0` (now = t): gone, then fading in, then parked. */
export function gateAt(t: number, t0: number): { state: PlaneState; alpha: number } {
  const since = t - t0;
  if (!(since >= 0)) return { state: "parked", alpha: 1 };
  if (since < TAKEOFF_S)
    return {
      state: planeAt(since, { x0: 0, y0: 0, runwayY: 0, dir: -1, rollPx: 1 }).state,
      alpha: 1,
    };
  const back = since - TAKEOFF_S - RESPAWN_S;
  if (back < 0) return { state: "gone", alpha: 0 };
  return { state: "parked", alpha: clamp01(back / FADE_IN_S) };
}

/** The share of a landmark's width (screen x0 … x1) that is inside the viewport, 0 … 1. */
export function visibleShare(x0: number, x1: number, vw: number): number {
  return x1 <= x0 ? 0 : Math.min(1, Math.max(0, (Math.min(x1, vw) - Math.max(x0, 0)) / (x1 - x0)));
}

/** The fixed band's arrival fires this close to the bottom of the page or closer, px. */
export const ARRIVAL_FROM_BOTTOM = 400;

/**
 * The arrival at the airport in the fixed band (≥ 1100px; v5.1 T5): near once at least half the airport's width is
 * on screen and the page is scrolled within ARRIVAL_FROM_BOTTOM px of its bottom; away once under a tenth of it is
 * visible. It replaced "the airport within 60px of its gutter target" (re-armed beyond 240px).
 */
export function bandArrival(share: number, fromBottom: number): { near: boolean; away: boolean } {
  return { near: share >= 0.5 && fromBottom <= ARRIVAL_FROM_BOTTOM, away: share < 0.1 };
}

/**
 * Arrival trigger with hysteresis: fires once when `near` turns true (and the plane is ready), then only re-arms
 * after `away` has been true. The fixed band: bandArrival. Scene mode: near = the closing scene ≥ 60% visible,
 * away = < 15% visible.
 */
export function createArrival() {
  let armed = true;
  return {
    /** Returns true when the take-off should start now. */
    update(near: boolean, away: boolean, ready: boolean): boolean {
      if (!armed) {
        if (away) armed = true;
        return false;
      }
      if (near && ready) {
        armed = false;
        return true;
      }
      return false;
    },
    get armed() {
      return armed;
    },
  };
}
