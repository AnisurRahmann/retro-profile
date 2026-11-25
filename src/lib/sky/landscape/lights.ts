/**
 * Night life schedules. Seeded, so the city goes to sleep and wakes with real time and the same on every load.
 */
import { mulberry32 } from "../random";

/** Share of windows that are lit in the evening. */
export const LIT_SHARE = 0.3;

export type WindowSchedule = { lit: boolean; off: number; on: number };

/**
 * Window i's schedule for a date seed: 30% are lit; each turns off at a random minute between 22:00 and 01:00
 * Sylhet time and back on between 05:00 and 06:30. Minutes past Dhaka midnight; `off` may exceed 1440 (after
 * midnight).
 */
export function windowSchedule(i: number, dateSeed: number): WindowSchedule {
  const r = mulberry32(((dateSeed * 73856093) ^ (i * 19349663)) >>> 0);
  r();
  const lit = r() < LIT_SHARE;
  const off = 22 * 60 + r() * 180;
  const on = 5 * 60 + r() * 90;
  return { lit, off, on };
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
