import { describe, expect, it } from "vitest";
import { ANCHOR_AT, nearestPlace, PARALLAX, screenX, solveAnchors } from "@/lib/sky/landscape/anchors";
import { fireflyCount, LIT_SHARE, windowLit, windowSchedule } from "@/lib/sky/landscape/lights";
import { buildWorld } from "@/lib/sky/landscape/world";

// Section tops (document px) for a 1440×900 home page.
const SECTIONS = { stage: 0, shipped: 622, bench: 1010, receipts: 1460, closer: 2100, footer: 2480 };
const VW = 1440;
const VH = 900;

describe("landmark anchors", () => {
  const anchors = solveAnchors(SECTIONS, VW, VH);

  it("centres each landmark when its section's top reaches 40% of the viewport", () => {
    expect(anchors.map((a) => a.id)).toEqual(["tea", "bridge", "city", "city2", "airport", "tea2"]);
    for (const a of anchors) {
      const top = SECTIONS[a.section as keyof typeof SECTIONS];
      const scrollY = Math.max(0, top - ANCHOR_AT * VH);
      // At that scroll the section top is at 40% of the viewport …
      if (top > ANCHOR_AT * VH) expect(top - scrollY).toBeCloseTo(ANCHOR_AT * VH, 9);
      // … and the landmark is at the viewport centre on its own layer.
      expect(screenX(a.x, scrollY, PARALLAX[a.layer])).toBeCloseTo(VW / 2, 9);
    }
  });

  it("puts the bridge with Shipped, the city with the bench and receipts, the airport with the closer", () => {
    const by = Object.fromEntries(anchors.map((a) => [a.id, a]));
    expect(by.bridge!.layer).toBe("L3");
    expect(by.tea!.layer).toBe("L2");
    expect(by.airport!.s).toBeCloseTo(2100 - 360, 9);
  });

  it("names the place whose section is nearest its 40% line", () => {
    expect(nearestPlace(anchors, 0)).toBe("tea");
    expect(nearestPlace(anchors, 262)).toBe("bridge");
    expect(nearestPlace(anchors, 650)).toBe("city");
    expect(nearestPlace(anchors, 1100)).toBe("city");
    expect(nearestPlace(anchors, 1740)).toBe("airport");
    expect(nearestPlace(anchors, 2200)).toBe("tea");
    expect(nearestPlace([], 0)).toBeNull();
  });

  it("keeps the sky still and the near layer fastest (real parallax)", () => {
    expect(PARALLAX.L1).toBeLessThan(PARALLAX.L2);
    expect(PARALLAX.L2).toBeLessThan(PARALLAX.L3);
    expect(PARALLAX.L3).toBeLessThan(PARALLAX.L4);
    expect(screenX(500, 1000, 0)).toBe(500);
  });

  it("builds a world whose landmarks don't overlap and are long enough for the page", () => {
    const w = buildWorld(anchors, VW, VH, 3200, 162);
    const marks = [...w.marks].sort((a, b) => a.x0 - b.x0);
    expect(marks.map((m) => m.id)).toEqual(["clock", "bridge", "city", "airport"]);
    for (let i = 1; i < marks.length; i++) expect(marks[i]!.x0).toBeGreaterThanOrEqual(marks[i - 1]!.x1);
    // L4 must cover the viewport at the bottom of the page.
    expect(w.length.L4 * w.s).toBeGreaterThanOrEqual(VW + (3200 - VH) * PARALLAX.L4);
    expect(w.lights.L3.filter((l) => l.kind === "window").length).toBeGreaterThan(40);
    expect(w.plane).not.toBeNull();
  });
});

describe("window lights", () => {
  it("are deterministic for a date seed and differ between dates", () => {
    const a = Array.from({ length: 200 }, (_, i) => windowSchedule(i, 349));
    const b = Array.from({ length: 200 }, (_, i) => windowSchedule(i, 349));
    const c = Array.from({ length: 200 }, (_, i) => windowSchedule(i, 350));
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it("light about 30% of windows, off between 22:00 and 01:00, back on between 05:00 and 06:30", () => {
    const n = 4000;
    const s = Array.from({ length: n }, (_, i) => windowSchedule(i, 120));
    const lit = s.filter((w) => w.lit).length / n;
    expect(lit).toBeGreaterThan(LIT_SHARE - 0.03);
    expect(lit).toBeLessThan(LIT_SHARE + 0.03);
    for (const w of s) {
      expect(w.off).toBeGreaterThanOrEqual(22 * 60);
      expect(w.off).toBeLessThanOrEqual(25 * 60);
      expect(w.on).toBeGreaterThanOrEqual(5 * 60);
      expect(w.on).toBeLessThanOrEqual(6.5 * 60);
    }
    const count = (min: number) => Array.from({ length: n }, (_, i) => windowLit(i, min, 120)).filter(Boolean).length;
    expect(count(20 * 60 + 30)).toBe(s.filter((w) => w.lit).length); // all lit windows on at 20:30
    expect(count(23 * 60 + 30)).toBeLessThan(count(20 * 60 + 30)); // the city goes to sleep
    expect(count(3 * 60)).toBe(0); // 03:00: everyone's asleep
    expect(count(7 * 60)).toBe(s.filter((w) => w.lit).length); // and wakes by 06:30
  });
});

describe("fireflies", () => {
  it("count by month, none in the wet", () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => fireflyCount(m, false))).toEqual([4, 4, 4, 10, 10, 18, 18, 18, 10, 10, 4, 4]);
    expect(fireflyCount(7, true)).toBe(0);
  });
});
