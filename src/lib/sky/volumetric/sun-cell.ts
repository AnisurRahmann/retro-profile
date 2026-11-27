/**
 * cloudAtSun (owner T5): where the forced cumulus cell goes so it covers the sun (or the moon at night), or puts its
 * edge on it. See WeatherMapParams.forcedCell and WeatherMap.offset in src/components/sky/volumetric/types.ts.
 * renderer.ts calls this on every state change and once a second (the field drifts with the wind); setParams
 * regenerates the map only when the result changes.
 *
 * The cell is centred where the body's ray reaches SUN_CELL.altKm (the dense middle of a cumulus layer, on the
 * spherical shell), so the whole stretch of the ray through the layer runs through the cell. Its radius grows with
 * that point's ground distance (a low sun's ray crosses the layer over tens of km). For "edge", the centre moves
 * sideways (perpendicular to the body's bearing) by SUN_CELL.edgeShift radii, so the ray grazes the cell's falloff.
 */
import { GEOMETRY, type LabScene, type LabState, type Vec2, type Vec3, type WeatherMapParams } from "@/components/sky/volumetric/types";

export const SUN_CELL = {
  /** Altitude (km) at which the body's ray meets the cell's centre. */
  altKm: 2.2,
  /** Cell radius = clamp(perKm · ground distance, min, max) km. */
  radiusPerKm: 0.25,
  minRadiusKm: 5,
  maxRadiusKm: 8,
  /** "edge": the centre's sideways shift, in cell radii. */
  edgeShift: 0.4,
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
  const t = distanceToAltitude(body.dir, SUN_CELL.altKm);
  let x = body.dir[0] * t;
  let z = body.dir[2] * t;
  const ground = Math.hypot(x, z);
  const radiusKm = Math.min(SUN_CELL.maxRadiusKm, Math.max(SUN_CELL.minRadiusKm, SUN_CELL.radiusPerKm * ground));
  if (state.cloudAtSun === "edge") {
    // Sideways = the body's bearing turned 90° clockwise (to its right as seen from the camera).
    const a = (body.azDeg * Math.PI) / 180;
    x += Math.cos(a) * SUN_CELL.edgeShift * radiusKm;
    z -= Math.sin(a) * SUN_CELL.edgeShift * radiusKm;
  }
  const km = GEOMETRY.WEATHER_MAP_KM;
  // A map feature at uv c sits over world xz = WEATHER_MAP_KM · (c + offset).
  return { u: wrap(x / km - offset[0]), v: wrap(z / km - offset[1]), radius: radiusKm / km };
}
