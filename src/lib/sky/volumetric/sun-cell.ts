/**
 * cloudAtSun (owner T5, tuned by T8): where the forced cumulus cell goes so it covers the sun (or the moon at night),
 * or puts its edge on it. See WeatherMapParams.forcedCell and WeatherMap.offset in
 * src/components/sky/volumetric/types.ts. renderer.ts calls this on every state change and once a second (the field
 * drifts with the wind); setParams regenerates the map only when the result changes.
 *
 * The cell is centred where the body's ray reaches SUN_CELL.altKm (the dense middle of a cumulus layer, on the
 * spherical shell).
 * - "cover": its radius grows with that point's ground distance (a low sun's ray crosses the layer over tens of km),
 *   so the whole stretch of the ray through the layer runs through the cell.
 * - "edge" (T8, M1 F2): a single cumulus-sized cell (SUN_CELL.edgeRadiusKm, so it reads as one cloud and not as a
 *   coverage disc seen edge-on), its centre moved sideways (perpendicular to the body's bearing) by
 *   SUN_CELL.edgeShift radii, so the ray grazes its falloff. A clear wedge along the ray's stretch through the layer
 *   (`clear`) removes the rest of the field from the line of sight; without it a low sun's ray crosses ~40 km of
 *   random cumulus and the body is always hidden.
 */
import { GEOMETRY, type LabScene, type LabState, type Vec2, type Vec3, type WeatherMapParams } from "@/components/sky/volumetric/types";

export const SUN_CELL = {
  /** Altitude (km) at which the body's ray meets the cell's centre. */
  altKm: 2.2,
  /** "cover": cell radius = clamp(perKm · ground distance, min, max) km. */
  radiusPerKm: 0.25,
  minRadiusKm: 5,
  maxRadiusKm: 8,
  /** "edge": the cell's radius (km): one cumulus. */
  edgeRadiusKm: 3.2,
  /** "edge": the centre's sideways shift, in cell radii. */
  edgeShift: 0.8,
  /** "edge": the clear wedge's half-width = minKm + tan(halfAngle) · ground distance. */
  clearMinKm: 0.8,
  clearHalfAngleDeg: 3,
  /** A body counts as up above this elevation (degrees). */
  minElDeg: 0.5,
} as const;

/** Distance along a ray from the camera to the sphere of altitude altKm (the camera is below it). */
export function distanceToAltitude(dir: Vec3, altKm: number): number {
  const R = GEOMETRY.EARTH_R;
  // The camera at (0, CAMERA_ALT, 0) relative to the planet's centre (0, −R, 0).
  const oy = R + GEOMETRY.CAMERA_ALT;
  const b = oy * dir[1];
  const c = oy * oy - (R + altKm) * (R + altKm);
  return -b + Math.sqrt(b * b - c);
}

const wrap = (x: number) => ((x % 1) + 1) % 1;

/** The body the cell goes on: the sun while it's up, else the moon while it's up, else none. */
export function cellTarget(scene: LabScene): { azDeg: number; elDeg: number; dir: Vec3 } | null {
  if (scene.sun.elDeg > SUN_CELL.minElDeg) return scene.sun;
  if (scene.moon.elDeg > SUN_CELL.minElDeg) return scene.moon;
  return null;
}

export function forcedCellFor(state: LabState, scene: LabScene, offset: Vec2): WeatherMapParams["forcedCell"] {
  if (state.cloudAtSun === "off") return undefined;
  const body = cellTarget(scene);
  if (!body) return undefined;
  const km = GEOMETRY.WEATHER_MAP_KM;
  // A map feature at uv c sits over world xz = WEATHER_MAP_KM · (c + offset).
  const toU = (x: number) => wrap(x / km - offset[0]);
  const toV = (z: number) => wrap(z / km - offset[1]);
  const t = distanceToAltitude(body.dir, SUN_CELL.altKm);
  let x = body.dir[0] * t;
  let z = body.dir[2] * t;
  if (state.cloudAtSun !== "edge") {
    const radiusKm = Math.min(SUN_CELL.maxRadiusKm, Math.max(SUN_CELL.minRadiusKm, SUN_CELL.radiusPerKm * Math.hypot(x, z)));
    return { u: toU(x), v: toV(z), radius: radiusKm / km };
  }
  const radiusKm = SUN_CELL.edgeRadiusKm;
  // Sideways = the body's bearing turned 90° clockwise (to its right as seen from the camera).
  const a = (body.azDeg * Math.PI) / 180;
  x += Math.cos(a) * SUN_CELL.edgeShift * radiusKm;
  z -= Math.sin(a) * SUN_CELL.edgeShift * radiusKm;
  // The clear wedge: the ray's ground track from the base to the top of the layer.
  const near = distanceToAltitude(body.dir, GEOMETRY.CLOUD_BASE);
  const far = distanceToAltitude(body.dir, GEOMETRY.CLOUD_TOP);
  const horiz = Math.hypot(body.dir[0], body.dir[2]) || 1;
  const g0 = near * horiz;
  const g1 = far * horiz;
  const ux = body.dir[0] / horiz;
  const uz = body.dir[2] / horiz;
  const tanA = Math.tan((SUN_CELL.clearHalfAngleDeg * Math.PI) / 180);
  // The wedge's ends are unwrapped relative to its start, so weather-map.ts can measure along the segment.
  const u0 = toU(ux * g0);
  const v0 = toV(uz * g0);
  const clear = {
    u0,
    v0,
    u1: u0 + (ux * (g1 - g0)) / km,
    v1: v0 + (uz * (g1 - g0)) / km,
    r0: (SUN_CELL.clearMinKm + tanA * g0) / km,
    r1: (SUN_CELL.clearMinKm + tanA * g1) / km,
  };
  return { u: toU(x), v: toV(z), radius: radiusKm / km, clear };
}
