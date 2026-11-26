/**
 * Client-side sky state shared by the controller, the label, the clock and the renderer.
 * A tiny external store (useSyncExternalStore-compatible), no React context.
 */
import { atDhakaMinutes, parseDhakaLocal } from "./time";
import { CONDITIONS, UNKNOWN_WEATHER, type Condition, type SylhetWeather } from "./weather";

/** Debug overrides (?sky=, ?wx=, &wind=, &from=, &cloud=) work in dev and test builds, or with NEXT_PUBLIC_SKY_DEBUG=1. */
export const SKY_DEBUG =
  process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_SKY_DEBUG === "1" || process.env.NEXT_PUBLIC_E2E === "1";

export type SkySnapshot = {
  /** Last /api/sylhet value (null until the first response). */
  weather: SylhetWeather | null;
  /** True once /api/sylhet answered or failed. */
  loaded: boolean;
  /** Frozen time from ?sky= (debug only). */
  timeOverride: Date | null;
  /** Weather fields from ?wx= & co (debug only). */
  wxOverride: Partial<SylhetWeather> | null;
  /** Scrubber position, minutes past Dhaka midnight; null = live. */
  preview: number | null;
  /** True while a scrub, drag or time-lapse is running or easing back to now (the renderer runs at 60fps). */
  scrubbing: boolean;
  /** The landmark nearest the viewport centre (the label's place name); null = "in Sylhet". */
  place: PlaceId | null;
};

export type PlaceId = "tea" | "bridge" | "city" | "airport";

let snap: SkySnapshot = { weather: null, loaded: false, timeOverride: null, wxOverride: null, preview: null, scrubbing: false, place: null };
const listeners = new Set<() => void>();

export const skyStore = {
  get: (): SkySnapshot => snap,
  set(patch: Partial<SkySnapshot>): void {
    let changed = false;
    for (const k in patch) if (snap[k as keyof SkySnapshot] !== patch[k as keyof SkySnapshot]) changed = true;
    if (!changed) return;
    snap = { ...snap, ...patch };
    listeners.forEach((l) => l());
  },
  subscribe(l: () => void): () => void {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
};

/** Typical cloud cover and WMO code per condition, for the ?wx= override (and the cloud sheets' coverage: clouds.ts). */
export const WX_DEFAULTS: Record<Condition, { cloudCover: number; code: number }> = {
  clear: { cloudCover: 0.04, code: 0 },
  partly: { cloudCover: 0.45, code: 2 },
  overcast: { cloudCover: 0.97, code: 3 },
  fog: { cloudCover: 0.9, code: 45 },
  drizzle: { cloudCover: 0.85, code: 53 },
  rain: { cloudCover: 0.95, code: 63 },
  "heavy-rain": { cloudCover: 1, code: 65 },
  thunder: { cloudCover: 1, code: 95 },
};

export function parseOverrides(search: string): Pick<SkySnapshot, "timeOverride" | "wxOverride"> {
  if (!SKY_DEBUG) return { timeOverride: null, wxOverride: null };
  const q = new URLSearchParams(search);
  const timeOverride = parseDhakaLocal(q.get("sky"));
  const wx = q.get("wx");
  const o: Partial<SylhetWeather> = {};
  if (wx && (CONDITIONS as readonly string[]).includes(wx)) {
    const c = wx as Condition;
    Object.assign(o, { condition: c, ...WX_DEFAULTS[c] });
    if (c === "fog") Object.assign(o, { visibilityM: 300, humidity: 98 });
    if (c === "clear" || c === "partly") Object.assign(o, { humidity: 60, visibilityM: 20_000 });
    if (c === "rain" || c === "heavy-rain" || c === "thunder" || c === "drizzle") Object.assign(o, { humidity: 92, visibilityM: 8000 });
  }
  const n = (k: string) => {
    const v = q.get(k);
    return v !== null && v !== "" && Number.isFinite(Number(v)) ? Number(v) : null;
  };
  const wind = n("wind");
  const from = n("from");
  const cloud = n("cloud");
  if (wind !== null) o.windKmh = Math.max(0, wind);
  if (from !== null) o.windFromDeg = ((from % 360) + 360) % 360;
  if (cloud !== null) o.cloudCover = Math.min(1, Math.max(0, cloud / 100));
  return { timeOverride, wxOverride: Object.keys(o).length ? o : null };
}

/** Weather the sky renders: the API value with any debug override on top. */
export function effectiveWeather(s: SkySnapshot): SylhetWeather {
  const base = s.weather ?? UNKNOWN_WEATHER;
  return s.wxOverride ? { ...base, ...s.wxOverride, stale: base.stale && base.tempC === null } : base;
}

/** The real "now" (frozen under ?sky=). */
export function liveNow(s: SkySnapshot = snap): Date {
  return s.timeOverride ?? new Date();
}

/** The time the sky is drawn for: the scrubber position on today's Dhaka date, else now. */
export function skyTime(s: SkySnapshot = snap): Date {
  const now = liveNow(s);
  return s.preview === null ? now : atDhakaMinutes(now, s.preview);
}
