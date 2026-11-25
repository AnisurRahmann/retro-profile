import { describe, expect, it } from "vitest";
import { FRAG, VERT } from "@/components/signal-field/shader";
import {
  columnMask,
  dotAlpha,
  EmitterRing,
  envelope,
  intensity,
  isActive,
  ripple,
  SF,
  smoothToward,
  tauFor,
  type Emitter,
  type FieldState,
} from "@/lib/signal-math";

const e: Emitter = { x: 500, y: 400, amp: 1, t0: 0, tau: SF.tau };

describe("signal math", () => {
  it("peaks the ring term at r = v (t - t0)", () => {
    const t = 0.5;
    const r = SF.v * t;
    const at = (dr: number) => ripple(e.x + r + dr, e.y, t, e);
    expect(at(0)).toBeGreaterThan(at(-6));
    expect(at(0)).toBeGreaterThan(at(6));
    expect(at(0)).toBeCloseTo(Math.exp(-t / SF.tau), 6);
  });

  it("uses each emitter's own τ", () => {
    const amb: Emitter = { ...e, amp: SF.ambientAmp, tau: tauFor("ambient") };
    expect(tauFor("ambient")).toBe(0.9);
    expect(tauFor("interactive")).toBe(1.6);
    expect(envelope(amb, 0.9)).toBeCloseTo(SF.ambientAmp * Math.exp(-1), 9);
    expect(ripple(amb.x + SF.v * 0.9, amb.y, 0.9, amb)).toBeCloseTo(SF.ambientAmp * Math.exp(-1), 9);
  });

  it("counts an emitter as active while A·e^(−Δt/τ) > 0.02, and contributes nothing after", () => {
    const tEnd = e.tau * Math.log(e.amp / SF.activeEps); // ≈ 6.26 s for amp 1, τ 1.6
    expect(isActive(e, tEnd - 0.01)).toBe(true);
    expect(isActive(e, tEnd + 0.01)).toBe(false);
    expect(ripple(e.x + SF.v * (tEnd + 0.01), e.y, tEnd + 0.01, e)).toBe(0);
    const amb: Emitter = { ...e, amp: SF.ambientAmp, tau: SF.tauAmbient };
    const ambEnd = SF.tauAmbient * Math.log(SF.ambientAmp / SF.activeEps); // ≈ 2.58 s < the 3.2 s status cycle
    expect(ambEnd).toBeLessThan(3.2);
    expect(isActive(amb, ambEnd + 0.01)).toBe(false);
    expect(isActive(e, -0.1)).toBe(false); // not started
  });

  it("masks SF.column at the column centre and 1.0 at 120px into the gutter", () => {
    const vw = 1440;
    expect(columnMask(vw / 2, vw)).toBeCloseTo(SF.column, 6);
    expect(columnMask(vw / 2 + 384 + 120, vw)).toBe(1);
    expect(columnMask(vw / 2 - 384 - 120, vw)).toBe(1);
    expect(columnMask(10, 800)).toBe(SF.column);
  });

  it("clamps to [0, 1] with all 8 emitters at amp 1 stacked on one point", () => {
    const x = 60;
    const emitters = Array.from({ length: 8 }, () => ({ ...e, x }));
    const s: FieldState = { t: 0, vw: 1440, cx: x, cy: e.y, gain: 1, emitters };
    expect(intensity(x, e.y, s)).toBe(1);
  });

  it("keeps column dot alpha within the readability guard", () => {
    const emitters = Array.from({ length: 8 }, () => ({ ...e, x: 720 }));
    expect(dotAlpha(720, 400, { t: 0, vw: 1440, cx: 720, cy: 400, gain: 1, emitters })).toBeLessThanOrEqual(SF.aMax * SF.column + 1e-9);
    let idleMax = 0;
    for (let x = 400; x < 1040; x += 11)
      for (let t = 0; t < 9; t += 0.5) idleMax = Math.max(idleMax, dotAlpha(x, 300, { t, vw: 1440, cx: -1e4, cy: -1e4, gain: 0, emitters: [] }));
    expect(idleMax).toBeLessThanOrEqual(0.06);
  });

  it("overwrites the oldest emitter on the 9th emit", () => {
    const ring = new EmitterRing();
    for (let i = 0; i < 9; i++) ring.push(i, i, 0.5, i);
    expect(ring.list()[0]).toMatchObject({ x: 8, t0: 8 });
    expect(ring.list().map((m) => m.t0)).toEqual([8, 1, 2, 3, 4, 5, 6, 7]);
  });

  it("reports activity by class and packs only active emitters", () => {
    const ring = new EmitterRing();
    expect(ring.activity(0)).toEqual({ interactive: false, ambient: false });
    expect(ring.compact(0)).toBe(0);
    ring.push(10, 10, SF.ambientAmp, 0, SF.tauAmbient);
    expect(ring.activity(0.1)).toEqual({ interactive: false, ambient: true });
    ring.push(20, 20, 0.6, 0.1, SF.tau);
    expect(ring.activity(0.2)).toEqual({ interactive: true, ambient: true });
    expect(ring.compact(0.2)).toBe(2);
    expect(ring.compact(3)).toBe(1); // ambient faded (≈2.58 s), interactive still alive
    expect(ring.packedPos[0]).toBe(20);
    expect(ring.activity(3)).toEqual({ interactive: true, ambient: false });
  });

  it("smooths the pointer frame-rate independently", () => {
    expect(smoothToward(0, 100, 1 / 30)).toBeCloseTo(smoothToward(smoothToward(0, 100, 1 / 60), 100, 1 / 60), 9);
  });

  it("generates GLSL from the same constants", () => {
    expect(VERT).toContain(`${SF.v}.0`);
    expect(VERT).toContain(`#define N ${SF.maxEmitters}`);
    expect(VERT).toContain(`${SF.activeEps}`);
    expect(VERT + FRAG).not.toMatch(/#[0-9a-fA-F]{6}/);
  });
});
