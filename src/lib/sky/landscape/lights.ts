/**
 * Night life schedules and the city's glow. Seeded, so the city goes to sleep and wakes with real time and the
 * same on every load.
 */
import { mulberry32 } from "../random";

/** Share of windows lit in the evening (before 22:00). */
export const LIT_SHARE = 0.45;
/** Share still lit from 01:00 until morning. */
export const LATE_SHARE = 0.1;
/** Share of lit windows that are TV light (cool white, flickering gently at TV_HZ). */
export const TV_SHARE = 0.12;
export const TV_HZ = 0.3;

export type WindowSchedule = { lit: boolean; off: number; on: number; tv: boolean };

/**
 * Window i's schedule for a date seed: 45% are lit in the evening; most turn off at a random minute between 22:00
 * and 01:00 Sylhet time, so 10% are left by 01:00 (those stay on until 05:00); all come back on between 05:00 and
 * 06:30. Minutes past Dhaka midnight; `off` may exceed 1440 (after midnight).
 */
export function windowSchedule(i: number, dateSeed: number): WindowSchedule {
  const r = mulberry32(((dateSeed * 73856093) ^ (i * 19349663)) >>> 0);
  r();
  const lit = r() < LIT_SHARE;
  const late = r() < LATE_SHARE / LIT_SHARE;
  const off = late ? 29 * 60 : 22 * 60 + r() * 180;
  const on = 5 * 60 + r() * 90;
  const tv = r() < TV_SHARE;
  return { lit, off, on, tv };
}

/** Is window i lit at `minutes` past Dhaka midnight (the evening's schedule rolls over at noon)? */
export function windowLit(i: number, minutes: number, dateSeed: number): boolean {
  const w = windowSchedule(i, dateSeed);
  if (!w.lit) return false;
  // Evening: lit from noon until its off time (which can run past midnight). Morning: lit from its on time.
  if (minutes >= 12 * 60) return minutes < w.off;
  if (minutes + 1440 < w.off) return true;
  return minutes >= w.on;
}

/** Fireflies over the tea gardens at night, by month (1–12): Jun–Aug 18, Apr–May and Sep–Oct 10, Nov–Mar 4. */
export function fireflyCount(month: number, wet: boolean): number {
  if (wet) return 0;
  if (month >= 6 && month <= 8) return 18;
  if (month === 4 || month === 5 || month === 9 || month === 10) return 10;
  return 4;
}

/** City glow at the horizon, alpha before cloud and the night fade. */
export const CITY_GLOW_ALPHA = 0.16;
/** The glow reaches this fraction of the viewport height above the horizon. */
export const CITY_GLOW_REACH = 0.14;

/**
 * Light pollution over the city (sodium, palette CITY_GLOW) at `minutes` past Dhaka midnight: 0.16 at the horizon,
 * × (1 + 0.8 · cloud cover) (low cloud reflects city light), dimming to × 0.6 between 22:00 and 01:00 in step with
 * the windows, back to full between 05:00 and 06:00. `night` 0..1 fades it in from sunset to sunrise.
 */
/** The moonlight rim's alpha on a full moon (landscape.ts: MOON_RIM along the top of the hills and the bridge). */
export const MOON_RIM_ALPHA = 0.3;

/**
 * Moonlight rim (v5.1 T4): while the moon is above the horizon, 0.3 × its illumination. It fades with the night (no
 * rim from a daytime moon) and with cloud (no rim from a moon that's hidden).
 */
export function moonRimAlpha(up: boolean, illumination: number, night: number, cloudCover: number): number {
  return up ? MOON_RIM_ALPHA * illumination * night * Math.max(0, 1 - cloudCover) : 0;
}

export function cityGlowAlpha(minutes: number, cloudCover: number, night: number): number {
  const m = ((minutes % 1440) + 1440) % 1440;
  const t = m >= 12 * 60 ? Math.min(1, Math.max(0, (m - 22 * 60) / 180)) : m < 5 * 60 ? 1 : Math.max(0, 1 - (m - 5 * 60) / 60);
  return CITY_GLOW_ALPHA * (1 + 0.8 * Math.min(1, Math.max(0, cloudCover))) * (1 - 0.4 * t) * night;
}
