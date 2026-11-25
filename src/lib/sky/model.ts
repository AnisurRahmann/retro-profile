/**
 * Everything the sky draws, derived from (time, weather). Pure; shared by the controller (CSS gradient, backing,
 * label) and the renderer (shader uniforms, particles).
 * Screen convention: the viewer faces south (the sun's side of the sky at 24.9° N), so east is at the left and
 * west at the right: the dawn glow sits bottom-left, the dusk glow bottom-right.
 */
import { arcPoint, DEFAULT_GEOM, moonPass, sunPass, type ArcGeom, type Pass } from "./arc";
import { astro, type Astro } from "./astro";
import { toCss, skyColors, smoothstep, type SkyColors } from "./gradient";
import type { Condition, SylhetWeather } from "./weather";

export type SkyModel = {
  astro: Astro;
  condition: Condition;
  colors: SkyColors;
  css: { zenith: string; mid: string; horizon: string };
  /** Star and moon visibility 0..1 (fades in from −6° to −14°). */
  night: number;
  /** Sun x on screen (arc), 0 = left edge (east) … 1 = right edge (west). */
  sunX: number;
  /** Sun position on the arc, fractions of the viewport; `up` between sunrise and sunset. */
  sun: { x: number; y: number; up: boolean; alt: number };
  sunPass: Pass;
  moonPass: Pass;
  /** Horizon glow intensity 0..1 (sun between −8° and +10°). */
  glow: number;
  cloudCover: number;
  /** Cloud drift, CSS px/s on screen. */
  wind: [number, number];
  fog: number;
  /** Rain darkening of the cloud layer 0..1. */
  rainDark: number;
  /** Rain streaks per 100k CSS px². */
  rainDensity: number;
  windKmh: number;
  /** Signed rain slant (radians, + leans right). */
  rainSlant: number;
  thunder: boolean;
  /** x, y: the disc on the arc, fractions of the viewport. */
  moon: { x: number; y: number; up: boolean; fraction: number; waxing: boolean; phase: number };
  windFromDeg: number;
  humidity: number;
};

/** Compass bearing → screen x (E 0, S 0.5, W 1). */
export const bearingToX = (deg: number) => (deg - 90) / 180;

const RAIN: Partial<Record<Condition, { density: number; dark: number }>> = {
  drizzle: { density: 6, dark: 0.3 },
  rain: { density: 18, dark: 0.6 },
  "heavy-rain": { density: 40, dark: 1 },
  thunder: { density: 40, dark: 1 },
};

export function fogAmount(w: Pick<SylhetWeather, "condition" | "humidity" | "visibilityM">): number {
  if (w.condition === "fog") return 1;
  let f = Math.min(1, Math.max(0, ((w.humidity ?? 0) - 80) / 20)) * 0.35;
  if (w.visibilityM !== undefined && w.visibilityM < 5000) f += (1 - w.visibilityM / 5000) * 0.4;
  return Math.min(1, f);
}

/** Wind (km/h, from bearing) → screen drift: 0.6 px/s per km/h, blowing away from `fromDeg`; N–S scaled ×0.25. */
export function windVector(kmh: number, fromDeg: number): [number, number] {
  const speed = 0.6 * kmh;
  const to = ((fromDeg + 180) * Math.PI) / 180;
  const east = Math.sin(to);
  const north = Math.cos(to);
  return [-east * speed, -north * speed * 0.25];
}

/** Minimum cloud drift (px/s) even in calm air: 5 desktop, 3 mobile. */
export const MIN_DRIFT = { desktop: 5, mobile: 3 };

/**
 * Cloud drift on screen (px/s): max(min, 0.6 × km/h) in the real wind direction (N–S foreshortened × 0.25), with
 * at least 60% of the minimum sideways so a north or south wind still reads as moving.
 */
export function driftVector(kmh: number, fromDeg: number, min: number): [number, number] {
  const speed = Math.max(min, 0.6 * kmh);
  const to = ((fromDeg + 180) * Math.PI) / 180;
  let vx = -Math.sin(to) * speed;
  const vy = -Math.cos(to) * speed * 0.25;
  if (Math.abs(vx) < 0.6 * min) vx = (vx < 0 || Object.is(vx, -0) ? -1 : 1) * 0.6 * min;
  return [vx, vy];
}

export function skyModel(date: Date, w: SylhetWeather, g: ArcGeom = DEFAULT_GEOM): SkyModel {
  const a = astro(date);
  const sp = sunPass(date);
  const mp = moonPass(date);
  const sunPt = arcPoint(sp.u, sp.alt, sp.maxAlt, g);
  const moonPt = arcPoint(mp.u, mp.alt, mp.maxAlt, g);
  const colors = skyColors(a.elevation, a.phase, w.condition);
  const rain = RAIN[w.condition];
  const moonUp = mp.up && a.moon.altitudeDeg > 0;
  const toward = ((w.windFromDeg + 180) * Math.PI) / 180;
  return {
    astro: a,
    condition: w.condition,
    colors,
    css: toCss(colors),
    night: smoothstep(-6, -14, a.elevation),
    sunX: sunPt.x / g.w,
    sun: { x: sunPt.cx / g.w, y: sunPt.y / g.h, up: sp.up && a.elevation > -0.83, alt: a.elevation },
    sunPass: sp,
    moonPass: mp,
    glow: smoothstep(-8, -2, a.elevation) * (1 - smoothstep(4, 10, a.elevation)),
    cloudCover: w.cloudCover,
    wind: windVector(w.windKmh, w.windFromDeg),
    fog: fogAmount(w),
    rainDark: rain?.dark ?? 0,
    rainDensity: rain?.density ?? 0,
    windKmh: w.windKmh,
    rainSlant: Math.atan((0.6 * w.windKmh) / 1100) * -Math.sign(Math.sin(toward) || 0),
    thunder: w.condition === "thunder",
    moon: {
      x: moonPt.cx / g.w,
      y: moonPt.y / g.h,
      up: moonUp,
      fraction: a.moon.fraction,
      waxing: a.moon.waxing,
      phase: a.moon.phase,
    },
    windFromDeg: w.windFromDeg,
    humidity: w.humidity ?? 0,
  };
}
