/**
 * Sun and moon over Sylhet. Pure functions of a Date (suncalc underneath).
 * Sky state is driven by sun elevation, never by clock hour, so it's right in June and in December.
 */
import SunCalc from "suncalc";
import { atDhakaMinutes } from "./time";
import { SYLHET } from "./weather";

const DEG = 180 / Math.PI;

/** suncalc azimuth is radians from south, positive westward → compass bearing (0 = N, 90 = E). */
const bearing = (azRad: number) => (((azRad * DEG + 180) % 360) + 360) % 360;

export const SKY_STATES = ["night", "astronomical", "nautical", "civil", "golden", "day"] as const;
export type SkyState = (typeof SKY_STATES)[number];
export type Phase = "morning" | "evening";

export function skyState(elevationDeg: number): SkyState {
  if (elevationDeg <= -18) return "night";
  if (elevationDeg <= -12) return "astronomical";
  if (elevationDeg <= -6) return "nautical";
  if (elevationDeg < 0) return "civil";
  if (elevationDeg < 8) return "golden";
  return "day";
}

/** Dark enough to call it night for people (and meteors): the sun is past civil twilight. */
export const isNightElevation = (elevationDeg: number) => elevationDeg < -6;

export function solarNoon(date: Date): Date {
  return SunCalc.getTimes(date, SYLHET.lat, SYLHET.lon).solarNoon;
}

export function sun(date: Date): { elevationDeg: number; azimuthDeg: number; phase: Phase } {
  const p = SunCalc.getPosition(date, SYLHET.lat, SYLHET.lon);
  return {
    elevationDeg: p.altitude * DEG,
    azimuthDeg: bearing(p.azimuth),
    phase: date.getTime() < solarNoon(date).getTime() ? "morning" : "evening",
  };
}

export type Moon = {
  altitudeDeg: number;
  azimuthDeg: number;
  /** Illuminated fraction 0..1. */
  fraction: number;
  /** 0 new → 0.25 first quarter → 0.5 full → 0.75 last quarter. */
  phase: number;
  waxing: boolean;
  /** Midpoint angle of the bright limb (radians), from suncalc. */
  angle: number;
};

export function moon(date: Date): Moon {
  const p = SunCalc.getMoonPosition(date, SYLHET.lat, SYLHET.lon);
  const i = SunCalc.getMoonIllumination(date);
  return {
    altitudeDeg: p.altitude * DEG,
    azimuthDeg: bearing(p.azimuth),
    fraction: i.fraction,
    phase: i.phase,
    waxing: i.phase < 0.5,
    angle: i.angle,
  };
}

/** Sunrise and sunset for the Dhaka calendar day containing `date`. */
export function sunTimes(date: Date): { sunrise: Date; sunset: Date; solarNoon: Date } {
  const t = SunCalc.getTimes(atDhakaMinutes(date, 12 * 60), SYLHET.lat, SYLHET.lon);
  return { sunrise: t.sunrise, sunset: t.sunset, solarNoon: t.solarNoon };
}

export type Astro = {
  date: Date;
  elevation: number;
  azimuth: number;
  phase: Phase;
  state: SkyState;
  moon: Moon;
};

export function astro(date: Date): Astro {
  const s = sun(date);
  return { date, elevation: s.elevationDeg, azimuth: s.azimuthDeg, phase: s.phase, state: skyState(s.elevationDeg), moon: moon(date) };
}
