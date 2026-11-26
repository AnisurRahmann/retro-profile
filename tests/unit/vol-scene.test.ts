/** LabState → scene: camera framing, directions and the gradient inputs (owner T0). */
import { describe, expect, it } from "vitest";
import { GEOMETRY, LAB_DEFAULTS, LAB_PRESETS, type Vec3 } from "@/components/sky/volumetric/types";
import { conditionFor, dirFromAzEl, sceneFor } from "@/lib/sky/volumetric/scene";

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const at = (p: keyof typeof LAB_PRESETS) => sceneFor({ ...LAB_DEFAULTS, ...LAB_PRESETS[p] });

describe("lab scene", () => {
  it("frames the horizon at HORIZON_AT of the height (the view ray there is level)", () => {
    const c = at("A").camera;
    const ndcY = 1 - 2 * GEOMETRY.HORIZON_AT;
    const ray = [0, 1, 2].map((i) => c.forward[i]! + ndcY * c.tanHalfFov * c.up[i]!) as Vec3;
    expect(Math.abs(ray[1])).toBeLessThan(1e-9);
  });
  it("has an orthonormal camera basis", () => {
    const c = at("B").camera;
    for (const v of [c.forward, c.right, c.up]) expect(dot(v, v)).toBeCloseTo(1, 9);
    expect(dot(c.forward, c.right)).toBeCloseTo(0, 9);
    expect(dot(c.forward, c.up)).toBeCloseTo(0, 9);
    expect(c.up[1]).toBeGreaterThan(0);
  });
  it("faces the sun by default, so it is in view", () => {
    for (const p of ["A", "B", "C"] as const) {
      const s = at(p);
      expect(s.camera.azDeg).toBeCloseTo(s.sun.azDeg, 9);
      expect(s.sun.elDeg).toBeGreaterThan(0);
      expect(s.sun.elDeg).toBeLessThan(s.camera.pitchDeg + GEOMETRY.FOV_Y / 2);
    }
  });
  it("maps bearings to world axes (+x east, +z north)", () => {
    const e = dirFromAzEl(90, 0);
    expect(e[0]).toBeCloseTo(1, 9);
    expect(dirFromAzEl(0, 0)[2]).toBeCloseTo(1, 9);
    expect(dirFromAzEl(0, 90)[1]).toBeCloseTo(1, 9);
  });
  it("honours the sun override and hides the stars by day", () => {
    const s = sceneFor({ ...LAB_DEFAULTS, sunAz: 250, sunEl: 3 });
    expect(s.sun.azDeg).toBe(250);
    expect(s.sun.elDeg).toBe(3);
    expect(at("A").stars.alpha).toBe(0);
    expect(sceneFor({ ...LAB_DEFAULTS, t: "20:30" }).stars.alpha).toBe(1);
  });
  it("picks the gradient's weather from the cloud params", () => {
    expect(conditionFor({ type: "stratus", cov: 0.95, precip: 0 })).toBe("overcast");
    expect(conditionFor({ type: "cumulus", cov: 0.38, precip: 0 })).toBe("partly");
    expect(conditionFor({ type: "cumulonimbus", cov: 0.8, precip: 0.9 })).toBe("thunder");
  });
});
