/**
 * Rain (Weather v6). Pure numbers, shared by the sky model (up front), the particle layer that draws the streaks,
 * the slow life that draws the splashes and the rain in the lamps' light (loaded when idle), and the tests.
 */
import type { Condition } from "./weather";

export type RainLayer = "far" | "mid" | "near";
export const RAIN_LAYERS: readonly RainLayer[] = ["far", "mid", "near"];

export type LayerSpec = {
  /** The share of the streaks. */
  share: number;
  /** Length, px. */
  len: [number, number];
  /** Width, px. */
  width: number;
  /** Alpha range. */
  alpha: [number, number];
  /** Fall speed, px/s. */
  speed: [number, number];
};

/** Three depths: the nearer, the longer, the wider, the brighter and the faster. */
export const RAIN_LAYER: Record<RainLayer, LayerSpec> = {
  far: { share: 0.5, len: [6, 10], width: 1, alpha: [0.1, 0.16], speed: [600, 800] },
  mid: { share: 0.35, len: [12, 20], width: 1, alpha: [0.18, 0.28], speed: [900, 1200] },
  near: { share: 0.15, len: [26, 44], width: 1.5, alpha: [0.28, 0.4], speed: [1400, 1900] },
};

/** The densest condition's streaks per 100,000 px²: the pool is sized for it. */
export const RAIN_MAX = 48;
/** Streaks per 100,000 px² of viewport, by condition. */
export const RAIN_DENSITY: Partial<Record<Condition, number>> = { drizzle: 8, rain: 22, "heavy-rain": 48, thunder: 40 };
/** Splashes a second per 1,000 px of water, by condition (a drizzle leaves none). */
export const SPLASH_RATE: Partial<Record<Condition, number>> = { rain: 30, "heavy-rain": 70, thunder: 70 };
/** A splash mark: how long it lives (s), how wide it grows (px) and its brightest alpha. */
export const SPLASH = { life: 0.3, r0: 1.5, r1: 5, alpha: 0.6 } as const;

/**
 * How many of `n` streaks each depth takes: far 50%, mid 35%, and the rest near, so the shares add up exactly.
 */
export function layerCounts(n: number): Record<RainLayer, number> {
  const far = Math.round(n * RAIN_LAYER.far.share);
  const mid = Math.round(n * RAIN_LAYER.mid.share);
  return { far, mid, near: Math.max(0, n - far - mid) };
}

export const MAX_SLANT = (35 * Math.PI) / 180;

/**
 * The streaks' angle from the vertical (radians): atan((km/h ÷ 3.6) ÷ 7.5), the wind's speed against a drop's
 * fall speed of 7.5 m/s, at most 35°. Signed by the east–west wind: rain falls toward where the wind blows, and
 * east is screen-left (the viewer faces south), so a west wind leans the streaks left and an east wind right. A
 * north or south wind is along the view, and the streaks stay vertical.
 */
export function rainSlant(kmh: number, fromDeg: number): number {
  const lean = Math.tan(Math.min(MAX_SLANT, Math.atan(kmh / 3.6 / 7.5)));
  return Math.atan(-Math.sin(((fromDeg + 180) * Math.PI) / 180) * lean);
}

/**
 * The lights come on with the sky, not the clock. The mid sky's relative luminance (linear) at which the lamps and
 * windows are fully on, and at which they are off: on a clear sky that is the sun at about −1.5° and +0.5°, as
 * before; under a storm at noon the sky is as dark as a clear one at sunset, and they come on in the afternoon.
 */
export const LAMPS_AT = { on: 0.04, off: 0.048 } as const;
