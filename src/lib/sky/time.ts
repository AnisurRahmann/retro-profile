/** Asia/Dhaka time helpers. UTC+6 all year (no DST), so Dhaka minute boundaries coincide with UTC ones. */
export const DHAKA_OFFSET_MS = 6 * 3600_000;

const hm = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dhaka", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/** "07:52" in Sylhet. Always Asia/Dhaka, never the visitor's zone. */
export function formatHM(date: Date): string {
  return hm.format(date);
}

/** Dhaka wall-clock fields for a date. */
export function dhakaParts(date: Date): { y: number; m: number; d: number; minutes: number } {
  const t = new Date(date.getTime() + DHAKA_OFFSET_MS);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(), minutes: t.getUTCHours() * 60 + t.getUTCMinutes() };
}

/** A Dhaka wall-clock time as an instant. */
export function dhakaDate(y: number, m: number, d: number, minutes = 0): Date {
  return new Date(Date.UTC(y, m - 1, d, 0, minutes) - DHAKA_OFFSET_MS);
}

/** Same Dhaka calendar day as `date`, at `minutes` past Dhaka midnight. */
export function atDhakaMinutes(date: Date, minutes: number): Date {
  const { y, m, d } = dhakaParts(date);
  return dhakaDate(y, m, d, minutes);
}

/** "2026-12-15T02:00" read as Asia/Dhaka time (the ?sky= debug override). */
export function parseDhakaLocal(s: string | null | undefined): Date | null {
  const m = s?.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number) as [number, number, number, number, number, number];
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59) return null;
  return dhakaDate(y, mo, d, h * 60 + mi);
}

/** Day of the year (1..366) in Dhaka. Seeds the star field: stable within a day, different between days. */
export function dayOfYear(date: Date): number {
  const { y, m, d } = dhakaParts(date);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 86400_000) + 1;
}

/** Milliseconds until the next minute boundary (at least 1). */
export function msToNextMinute(nowMs: number): number {
  return 60_000 - (((nowMs % 60_000) + 60_000) % 60_000) || 60_000;
}
