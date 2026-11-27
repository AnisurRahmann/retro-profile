import { describe, expect, it } from "vitest";
import { GEOMETRY, LAB_DEFAULTS, type LabState, type Vec2 } from "@/components/sky/volumetric/types";
import { sceneFor } from "@/lib/sky/volumetric/scene";
import { cellTarget, distanceToAltitude, forcedCellFor, SUN_CELL } from "@/lib/sky/volumetric/sun-cell";

/** cloudAtSun (T5): the forced cell's map uv puts it on the sun (or the moon at night), or its edge on it. */
const at = (p: Partial<LabState>): LabState => ({ ...LAB_DEFAULTS, ...p });
const KM = GEOMETRY.WEATHER_MAP_KM;
/** Toroidal uv distance. */
const duv = (a: number, b: number) => Math.min(Math.abs(a - b), 1 - Math.abs(a - b));
const DEG = Math.PI / 180;

/** Where the body's ray reaches the cell's altitude, in map uv for this offset. */
function rayUv(s: LabState, offset: Vec2): [number, number] {
  const body = cellTarget(sceneFor(s))!;
  const t = distanceToAltitude(body.dir, SUN_CELL.altKm);
  const w = (x: number) => ((x % 1) + 1) % 1;
  return [w((body.dir[0] * t) / KM - offset[0]), w((body.dir[2] * t) / KM - offset[1])];
}

describe("forcedCellFor", () => {
  it("is off unless cloudAtSun asks for it", () => {
    const s = at({ t: "16:45" });
    expect(forcedCellFor(s, sceneFor(s), [0, 0])).toBeUndefined();
  });

  it("puts the cell's centre on the sun's ray (state B, cover)", () => {
    const s = at({ t: "16:45", cloudAtSun: "cover" });
    for (const off of [[0, 0], [0.3, 0.71], [0.99, 0.02]] as Vec2[]) {
      const c = forcedCellFor(s, sceneFor(s), off)!;
      const [u, v] = rayUv(s, off);
      expect(duv(c.u, u)).toBeLessThan(1e-9);
      expect(duv(c.v, v)).toBeLessThan(1e-9);
      expect(c.u).toBeGreaterThanOrEqual(0);
      expect(c.u).toBeLessThan(1);
      expect(c.radius * KM).toBeGreaterThanOrEqual(SUN_CELL.minRadiusKm);
      expect(c.radius * KM).toBeLessThanOrEqual(SUN_CELL.maxRadiusKm);
    }
  });

  it("the ray really reaches the cell's altitude there (spherical shell)", () => {
    const body = cellTarget(sceneFor(at({ t: "16:45" })))!;
    const t = distanceToAltitude(body.dir, SUN_CELL.altKm);
    const p = [body.dir[0] * t, GEOMETRY.CAMERA_ALT + body.dir[1] * t + GEOMETRY.EARTH_R, body.dir[2] * t];
    expect(Math.hypot(p[0]!, p[1]!, p[2]!) - GEOMETRY.EARTH_R).toBeCloseTo(SUN_CELL.altKm, 6);
    // A low sun (3.4°) meets 2.2 km far out: tens of km, so the cell is at its largest.
    expect(Math.hypot(p[0]!, p[2]!)).toBeGreaterThan(25);
  });

  it("follows the moon at night, and gives up when neither is up", () => {
    const night = at({ t: "20:30", cloudAtSun: "cover" });
    const scene = sceneFor(night);
    expect(scene.sun.elDeg).toBeLessThan(0);
    expect(cellTarget(scene)).toBe(scene.moon);
    const c = forcedCellFor(night, scene, [0.2, 0.4])!;
    const [u, v] = rayUv(night, [0.2, 0.4]);
    expect(duv(c.u, u) + duv(c.v, v)).toBeLessThan(1e-9);

    const dark = at({ t: "20:30", sunEl: -30, sunAz: 270, cloudAtSun: "cover" });
    const ds = sceneFor(dark);
    const noMoon = { ...ds, moon: { ...ds.moon, elDeg: -20 } };
    expect(forcedCellFor(dark, noMoon, [0, 0])).toBeUndefined();
  });

  it("edge moves the centre sideways, perpendicular to the body's bearing, by edgeShift of its own radius", () => {
    const cover = at({ t: "16:45", cloudAtSun: "cover" });
    const edge = at({ t: "16:45", cloudAtSun: "edge" });
    const a = forcedCellFor(cover, sceneFor(cover), [0, 0])!;
    const b = forcedCellFor(edge, sceneFor(edge), [0, 0])!;
    const du = (((b.u - a.u + 0.5) % 1) + 1) % 1 - 0.5;
    const dv = (((b.v - a.v + 0.5) % 1) + 1) % 1 - 0.5;
    expect(Math.hypot(du, dv)).toBeCloseTo(SUN_CELL.edgeShift * b.radius, 9);
    const az = sceneFor(cover).sun.azDeg * DEG;
    // Perpendicular to the bearing (sin az, cos az) in (u, v).
    expect(du * Math.sin(az) + dv * Math.cos(az)).toBeCloseTo(0, 9);
  });
});
