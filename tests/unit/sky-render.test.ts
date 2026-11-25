import { describe, expect, it } from "vitest";
import { lightningEnvelope } from "@/components/sky/SkyRenderer";
import { mulberry32, skyRotation } from "@/components/sky/particles";
import { bearingToX, fogAmount, skyModel, windVector } from "@/lib/sky/model";
import { dhakaDate } from "@/lib/sky/time";
import { UNKNOWN_WEATHER } from "@/lib/sky/weather";

describe("lightning", () => {
  it("is a double pulse: 80 ms on, 60 ms off, 120 ms on", () => {
    expect(lightningEnvelope(0.04)).toBe(1);
    expect(lightningEnvelope(0.1)).toBe(0);
    expect(lightningEnvelope(0.2)).toBeGreaterThan(0);
    expect(lightningEnvelope(0.3)).toBe(0);
  });
  it("never flashes more than 3 times in any second (WCAG 2.3.1), even with the shortest 18 s gap", () => {
    let flashes = 0;
    let on = false;
    for (let ms = 0; ms < 1000; ms++) {
      const now = lightningEnvelope(ms / 1000) > 0;
      if (now && !on) flashes++;
      on = now;
    }
    expect(flashes).toBeLessThanOrEqual(3);
  });
});

describe("wind", () => {
  it("drifts 0.6 px/s per km/h, away from where it blows from; east is screen-left", () => {
    const [x, y] = windVector(10, 90); // from the east → toward the west → rightwards
    expect(x).toBeCloseTo(6, 5);
    expect(y).toBeCloseTo(0, 5);
    const [nx, ny] = windVector(10, 0); // from the north → toward the south (the horizon) → down, scaled ×0.25
    expect(nx).toBeCloseTo(0, 5);
    expect(ny).toBeCloseTo(1.5, 5);
    const [ex] = windVector(15, 45); // NE wind → toward SW → right
    expect(ex).toBeGreaterThan(0);
  });
});

describe("screen mapping", () => {
  it("puts east at the left and west at the right", () => {
    expect(bearingToX(90)).toBe(0);
    expect(bearingToX(180)).toBe(0.5);
    expect(bearingToX(270)).toBe(1);
  });
  it("puts the December dusk glow bottom-right and the dawn glow bottom-left", () => {
    const dusk = skyModel(dhakaDate(2026, 12, 15, 16 * 60 + 55), UNKNOWN_WEATHER);
    const dawn = skyModel(dhakaDate(2026, 12, 15, 6 * 60 + 25), UNKNOWN_WEATHER);
    expect(dusk.sunX).toBeGreaterThan(0.75);
    expect(dawn.sunX).toBeLessThan(0.25);
    expect(dusk.glow).toBeGreaterThan(0.5);
    expect(skyModel(dhakaDate(2026, 12, 15, 11 * 60), UNKNOWN_WEATHER).glow).toBe(0);
  });
});

describe("fog", () => {
  it("is full in fog and humidity/visibility-driven haze otherwise", () => {
    expect(fogAmount({ condition: "fog", humidity: 50, visibilityM: 20_000 })).toBe(1);
    expect(fogAmount({ condition: "clear", humidity: 70 })).toBe(0);
    expect(fogAmount({ condition: "clear", humidity: 100 })).toBeCloseTo(0.35, 5);
    expect(fogAmount({ condition: "partly", humidity: 90, visibilityM: 2500 })).toBeCloseTo(0.175 + 0.2, 5);
  });
});

describe("stars", () => {
  it("rotate at the sidereal rate, from real time", () => {
    const perHour = skyRotation(3.6e6) - skyRotation(0);
    expect((perHour * 180) / Math.PI).toBeCloseTo(15.041, 3);
  });
  it("seed deterministically", () => {
    const a = mulberry32(349);
    const b = mulberry32(349);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
    expect(mulberry32(350)()).not.toBe(mulberry32(349)());
  });
});
