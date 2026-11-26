/**
 * LabState → the physical inputs of a frame (owner T0): sun, moon, sky colours, stars, camera, weather params.
 * Pure; the astro and colours come from the home page's own code (astro.ts, gradient.ts, palette.ts).
 */
import { moon as moonAt, sun as sunAt, type Phase } from "@/lib/sky/astro";
import { hexToRgb, oklabToRgb, toLinear, type Lab, type RGB } from "@/lib/sky/color";
import { skyColors, smoothstep, sunColor } from "@/lib/sky/gradient";
import { LAND_L4, STAR_COOL, STAR_WARM } from "@/lib/sky/palette";
import { dayOfYear, dhakaDate } from "@/lib/sky/time";
import type { Condition } from "@/lib/sky/weather";
import { GEOMETRY, type LabScene, type LabState, type Vec3 } from "@/components/sky/volumetric/types";

const RAD = Math.PI / 180;
const lin = (c: RGB): Vec3 => [toLinear(c[0]), toLinear(c[1]), toLinear(c[2])];
const labLin = (c: Lab): Vec3 => lin(oklabToRgb(c));

/** A bearing (0 = north, 90 = east) and an elevation → a world direction (+x east, +y up, +z north). */
export function dirFromAzEl(azDeg: number, elDeg: number): Vec3 {
  const a = azDeg * RAD;
  const e = elDeg * RAD;
  return [Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)];
}

/** The lab's Dhaka date + time as an instant. */
export function labDate(s: Pick<LabState, "date" | "t">): Date {
  const [y, m, d] = s.date.split("-").map(Number) as [number, number, number];
  const [h, mi] = s.t.split(":").map(Number) as [number, number];
  return dhakaDate(y, m, d, h * 60 + mi);
}

/** The home page's condition for the lab's cloud params (drives the gradient's weather shift). */
export function conditionFor(s: Pick<LabState, "type" | "cov" | "precip">): Condition {
  if (s.precip > 0.6) return s.type === "cumulonimbus" ? "thunder" : "heavy-rain";
  if (s.precip > 0.3) return "rain";
  if (s.precip > 0.05) return "drizzle";
  if (s.cov >= 0.85) return "overcast";
  return s.cov >= 0.1 ? "partly" : "clear";
}

/** Camera pitch (degrees) that puts the horizon at GEOMETRY.HORIZON_AT of the height for the vertical FOV. */
export function cameraPitch(): number {
  const tanHalf = Math.tan((GEOMETRY.FOV_Y / 2) * RAD);
  return Math.atan((2 * GEOMETRY.HORIZON_AT - 1) * tanHalf) / RAD;
}

export function sceneFor(s: LabState): LabScene {
  const date = labDate(s);
  const real = sunAt(date);
  const override = s.sunAz !== null || s.sunEl !== null;
  const sunAz = s.sunAz ?? real.azimuthDeg;
  const sunEl = s.sunEl ?? real.elevationDeg;
  const phase: Phase = override ? (sunAz < 180 ? "morning" : "evening") : real.phase;
  const m = moonAt(date);
  const sky = skyColors(sunEl, phase, conditionFor(s));

  const pitch = cameraPitch();
  const viewAz = s.view ?? (sunEl > -2 ? sunAz : m.altitudeDeg > 0 ? m.azimuthDeg : 180);
  const forward = dirFromAzEl(viewAz, pitch);
  const right: Vec3 = [Math.cos(viewAz * RAD), 0, -Math.sin(viewAz * RAD)];
  const up: Vec3 = [
    forward[1] * right[2] - forward[2] * right[1],
    forward[2] * right[0] - forward[0] * right[2],
    forward[0] * right[1] - forward[1] * right[0],
  ];

  return {
    date,
    sun: { azDeg: sunAz, elDeg: sunEl, dir: dirFromAzEl(sunAz, sunEl), colour: lin(sunColor(Math.max(0, sunEl))), visible: smoothstep(-1.5, 1, sunEl) },
    moon: {
      azDeg: m.azimuthDeg,
      elDeg: m.altitudeDeg,
      dir: dirFromAzEl(m.azimuthDeg, m.altitudeDeg),
      fraction: m.fraction,
      phase: m.phase,
      angle: m.angle,
      visible: smoothstep(-1, 1, m.altitudeDeg),
    },
    sky: { zenith: labLin(sky.zenith), mid: labLin(sky.mid), horizon: labLin(sky.horizon), ground: lin(hexToRgb(LAND_L4)) },
    stars: { alpha: 1 - smoothstep(-10, -3, sunEl), seed: dayOfYear(date), warm: lin(hexToRgb(STAR_WARM)), cool: lin(hexToRgb(STAR_COOL)) },
    camera: { azDeg: viewAz, pitchDeg: pitch, forward, right, up, tanHalfFov: Math.tan((GEOMETRY.FOV_Y / 2) * RAD) },
    weather: { type: s.type, coverage: s.cov, precipitation: s.precip, windKmh: s.wind, windFromDeg: s.from, seed: s.seed },
  };
}
