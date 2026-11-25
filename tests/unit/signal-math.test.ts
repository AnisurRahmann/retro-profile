import { describe, expect, it } from "vitest";
import { columnMask, dotAlpha, EmitterRing, intensity, ripple, SF, smoothToward, type FieldState } from "@/lib/signal-math";
import { FRAG, VERT } from "@/components/signal-field/shader";

const e = { x: 500, y: 400, amp: 1, t0: 0 };

describe("signal math", () => {
  it("peaks the ring term at r = v (t - t0)", () => {
    const t = 0.5;
    const r = SF.v * t;
    const at = (dr: number) => ripple(e.x + r + dr, e.y, t, e);
    expect(at(0)).toBeGreaterThan(at(-6));
    expect(at(0)).toBeGreaterThan(at(6));
    expect(at(0)).toBeCloseTo(Math.exp(-t / SF.tau), 6);
  });

  it("decays a ripple below 1% after 5τ", () => {
    const t = 5 * SF.tau;
    expect(ripple(e.x + SF.v * t, e.y, t - 1e-6, e)).toBeLessThan(0.01);
    expect(ripple(e.x + SF.v * (t + 0.1), e.y, t + 0.1, e)).toBe(0);
  });

  it("masks SF.column at the column centre and 1.0 at 120px into the gutter", () => {
    const vw = 1440;
    expect(columnMask(vw / 2, vw)).toBeCloseTo(SF.column, 6);
    expect(columnMask(vw / 2 + 384 + 120, vw)).toBe(1);
    expect(columnMask(vw / 2 - 384 - 120, vw)).toBe(1);
    expect(columnMask(10, 800)).toBe(SF.column); // below 808px the column is the page
  });

  it("clamps to [0, 1] with all 8 emitters at amp 1 stacked on one point", () => {
    const emitters = Array.from({ length: 8 }, () => ({ ...e }));
    const s: FieldState = { t: 0, vw: 1440, cx: e.x, cy: e.y, gain: 1, emitters };
    const gutterX = 60;
    const i = intensity(gutterX, e.y, { ...s, emitters: emitters.map((m) => ({ ...m, x: gutterX })), cx: gutterX });
    expect(i).toBeLessThanOrEqual(1);
    expect(i).toBeGreaterThanOrEqual(0);
    expect(i).toBe(1);
  });

  it("keeps column dot alpha within the readability guard", () => {
    const emitters = Array.from({ length: 8 }, () => ({ x: 720, y: 400, amp: 1, t0: 0 }));
    const peak = dotAlpha(720, 400, { t: 0, vw: 1440, cx: 720, cy: 400, gain: 1, emitters });
    expect(peak).toBeLessThanOrEqual(SF.aMax * SF.column + 1e-9);
    let idleMax = 0;
    for (let x = 400; x < 1040; x += 11) for (let t = 0; t < 9; t += 0.5)
      idleMax = Math.max(idleMax, dotAlpha(x, 300, { t, vw: 1440, cx: -1e4, cy: -1e4, gain: 0, emitters: [] }));
    expect(idleMax).toBeLessThanOrEqual(0.06);
  });

  it("overwrites the oldest emitter on the 9th emit", () => {
    const ring = new EmitterRing();
    for (let i = 0; i < 9; i++) ring.push(i, i, 0.5, i);
    const list = ring.list();
    expect(list[0]).toMatchObject({ x: 8, t0: 8 });
    expect(list.map((m) => m.t0)).toEqual([8, 1, 2, 3, 4, 5, 6, 7]);
  });

  it("smooths the pointer frame-rate independently", () => {
    const oneStep = smoothToward(0, 100, 1 / 30);
    const twoSteps = smoothToward(smoothToward(0, 100, 1 / 60), 100, 1 / 60);
    expect(oneStep).toBeCloseTo(twoSteps, 9);
  });

  it("generates GLSL from the same constants", () => {
    expect(VERT).toContain(`${SF.v}.0`);
    expect(VERT).toContain(`#define N ${SF.maxEmitters}`);
    expect(VERT + FRAG).not.toMatch(/#[0-9a-fA-F]{6}/);
  });
});
