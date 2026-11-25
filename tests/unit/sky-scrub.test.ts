import { describe, expect, it } from "vitest";
import { easeInOutCubic, minutesFromToday, minutesLabel, smootherstep01, timeAtDrag } from "@/lib/sky/scrub";
import { dhakaDate } from "@/lib/sky/time";

const now = dhakaDate(2026, 12, 15, 18 * 60 + 40); // 18:40 in Sylhet

describe("timeAtDrag", () => {
  it("is now when the pointer hasn't moved, and 12 h per viewport width, forward to the right", () => {
    expect(timeAtDrag(300, 300, now, 1440).getTime()).toBe(now.getTime());
    expect(timeAtDrag(0, 1440, now, 1440).getTime() - now.getTime()).toBe(12 * 3600_000);
    expect(timeAtDrag(1440, 0, now, 1440).getTime() - now.getTime()).toBe(-12 * 3600_000);
    expect(timeAtDrag(100, 100 + 375 / 4, now, 375).getTime() - now.getTime()).toBe(3 * 3600_000);
  });

  it("doesn't care where the drag starts, only how far it goes", () => {
    expect(timeAtDrag(10, 370, now, 1440).getTime()).toBe(timeAtDrag(900, 1260, now, 1440).getTime());
  });

  it("maps to preview minutes past today's Dhaka midnight (beyond 1440 is tomorrow)", () => {
    expect(minutesFromToday(timeAtDrag(0, 0, now, 1440), now)).toBe(18 * 60 + 40);
    expect(minutesFromToday(timeAtDrag(0, 1440, now, 1440), now)).toBe(18 * 60 + 40 + 720);
    expect(minutesLabel(18 * 60 + 40 + 720)).toBe("06:40");
    expect(minutesLabel(-30)).toBe("23:30");
  });
});

describe("easing", () => {
  it("ease-in-out cubic: 0, ½, 1 with zero slope at both ends and symmetry", () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5, 12);
    expect(easeInOutCubic(1)).toBe(1);
    expect(easeInOutCubic(0.001)).toBeLessThan(1e-8);
    for (const t of [0.1, 0.25, 0.4]) expect(easeInOutCubic(t) + easeInOutCubic(1 - t)).toBeCloseTo(1, 12);
    expect(easeInOutCubic(-1)).toBe(0);
    expect(easeInOutCubic(2)).toBe(1);
  });

  it("smootherstep: 0, ½, 1, monotonic, flat first and second derivative at the ends", () => {
    expect(smootherstep01(0)).toBe(0);
    expect(smootherstep01(0.5)).toBeCloseTo(0.5, 12);
    expect(smootherstep01(1)).toBe(1);
    let prev = 0;
    for (let i = 1; i <= 100; i++) {
      const v = smootherstep01(i / 100);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
    expect(smootherstep01(0.01)).toBeLessThan(1e-5);
    expect(1 - smootherstep01(0.99)).toBeLessThan(1e-5);
  });
});
