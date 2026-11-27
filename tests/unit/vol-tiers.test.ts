/** T7: quality tiers, the automatic step-down, and the pipeline's pure scheduling helpers (docs/volumetric/BRIEF.md §5). */
import { describe, expect, it } from "vitest";
import { BAYER_2X2, cloudTargetSize, createMarchClock, HISTORY_ALPHA, historyAlpha, MARCH_HZ } from "@/components/sky/volumetric/targets";
import { createTierGovernor, lowerTier, median, resolveTier, STEP_DOWN_MS, STEP_DOWN_WINDOW_MS } from "@/components/sky/volumetric/tiers";
import { TIERS } from "@/components/sky/volumetric/types";

/** Feeds `ms` frame times every `every` ms from `from` to `to`; returns the steps the governor took, with their time. */
function run(g: ReturnType<typeof createTierGovernor>, ms: (t: number) => number, from: number, to: number, every = 16) {
  const steps: [number, string][] = [];
  for (let t = from; t <= to; t += every) {
    const s = g.sample(ms(t), t);
    if (s) steps.push([t, s]);
  }
  return steps;
}

describe("resolveTier", () => {
  it("auto starts high on a fine pointer and medium on a coarse one", () => {
    expect(resolveTier("auto", { coarsePointer: false })).toBe("high");
    expect(resolveTier("auto", { coarsePointer: true })).toBe("medium");
  });
  it("an explicit tier wins", () => {
    for (const t of ["high", "medium", "low"] as const) expect(resolveTier(t, { coarsePointer: true })).toBe(t);
  });
  it("lowerTier steps high → medium → low → none", () => {
    expect(lowerTier("high")).toBe("medium");
    expect(lowerTier("medium")).toBe("low");
    expect(lowerTier("low")).toBeNull();
  });
  it("median", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBeNaN();
  });
});

describe("createTierGovernor", () => {
  it("steps down once the median is over 20 ms for 3 s, not before", () => {
    const g = createTierGovernor("high", true);
    const steps = run(g, () => 25, 0, STEP_DOWN_WINDOW_MS + 100);
    expect(steps).toHaveLength(1);
    expect(steps[0]![1]).toBe("medium");
    expect(steps[0]![0]).toBeGreaterThanOrEqual(STEP_DOWN_WINDOW_MS);
  });
  it("then watches a fresh window: medium → low 3 s later, and never below low", () => {
    const g = createTierGovernor("high", true);
    const steps = run(g, () => 40, 0, 4 * STEP_DOWN_WINDOW_MS);
    expect(steps.map((s) => s[1])).toEqual(["medium", "low"]);
    expect(steps[1]![0] - steps[0]![0]).toBeGreaterThanOrEqual(STEP_DOWN_WINDOW_MS);
  });
  it("ignores spikes: the median, not the mean, decides", () => {
    const g = createTierGovernor("high", true);
    // One frame in four takes 60 ms (mean 27 ms), the rest 16.7 ms.
    let i = 0;
    expect(run(g, () => (i++ % 4 === 0 ? 60 : 16.7), 0, 3 * STEP_DOWN_WINDOW_MS)).toEqual([]);
  });
  it("does not step at exactly the threshold", () => {
    const g = createTierGovernor("high", true);
    expect(run(g, () => STEP_DOWN_MS, 0, 2 * STEP_DOWN_WINDOW_MS)).toEqual([]);
  });
  it("only the last 3 s count: a slow start followed by fast frames does not step", () => {
    const g = createTierGovernor("high", true);
    expect(run(g, (t) => (t < 1500 ? 50 : 10), 0, 2 * STEP_DOWN_WINDOW_MS)).toEqual([]);
  });
  it("is off unless the tier is auto", () => {
    const g = createTierGovernor("high", false);
    expect(run(g, () => 100, 0, 3 * STEP_DOWN_WINDOW_MS)).toEqual([]);
  });
});

describe("pipeline scheduling (targets.ts)", () => {
  it("the cloud target is the tier scale of the drawing buffer, rounded up to even", () => {
    const [w, h] = cloudTargetSize(3840, 2160, TIERS.high.scale);
    expect(w % 2).toBe(0);
    expect(h % 2).toBe(0);
    expect(w).toBeGreaterThanOrEqual(3840 * TIERS.high.scale);
    expect(w - 3840 * TIERS.high.scale).toBeLessThan(2);
    expect(cloudTargetSize(1, 1, 0.25)).toEqual([2, 2]);
  });
  it("the Bayer order visits each pixel of a 2×2 block once per 4 marches", () => {
    expect(new Set(BAYER_2X2.map(([x, y]) => `${x},${y}`)).size).toBe(4);
  });
  it.each([60, 80, 120, 144])("re-marches at most %i → ≤ 15 Hz, every frame composited", (fps) => {
    const clock = createMarchClock(MARCH_HZ);
    let n = 0;
    const frames = fps * 10;
    for (let i = 0; i < frames; i++) if (clock.due((i * 1000) / fps)) n++;
    expect(n / 10).toBeLessThanOrEqual(MARCH_HZ + 0.1);
    expect(n / 10).toBeGreaterThan(MARCH_HZ - 1.5);
  });
  it("marches every 4th frame at 60 fps, with frame-time jitter", () => {
    const clock = createMarchClock(MARCH_HZ);
    const hits: number[] = [];
    for (let i = 0; i < 240; i++) if (clock.due(i * 16.667 + Math.sin(i * 12.9898) * 1.5)) hits.push(i);
    const gaps = new Set(hits.slice(1).map((h, k) => h - hits[k]!));
    expect([...gaps]).toEqual([4]);
  });
  it("after a stall it restarts instead of bursting", () => {
    const clock = createMarchClock(MARCH_HZ);
    clock.due(0);
    expect(clock.due(5000)).toBe(true);
    expect(clock.due(5016)).toBe(false);
  });
  it("history α is a running mean after a reset, then 0.25", () => {
    expect([0, 3, 4, 7, 8, 12, 100].map(historyAlpha)).toEqual([1, 1, 0.5, 0.5, 1 / 3, HISTORY_ALPHA, HISTORY_ALPHA]);
  });
});
