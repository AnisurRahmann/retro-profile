import { describe, expect, it } from "vitest";
import {
  LAMPS_AT,
  MAX_SLANT,
  RAIN_DENSITY,
  RAIN_LAYER,
  RAIN_LAYERS,
  RAIN_MAX,
  SPLASH_RATE,
  layerCounts,
  rainSlant,
} from "@/lib/sky/rain";
import { CONDITIONS } from "@/lib/sky/weather";

const deg = (rad: number) => Math.abs((rad * 180) / Math.PI);

describe("the slant of the rain", () => {
  it("is atan((km/h ÷ 3.6) ÷ 7.5) from the vertical: 0, about 29° at 15 km/h, and no more than 35°", () => {
    expect(rainSlant(0, 270)).toBeCloseTo(0, 12);
    expect(deg(rainSlant(15, 270))).toBeCloseTo(29.05, 1);
    expect(deg(rainSlant(30, 270))).toBeCloseTo(35, 6);
    expect(deg(rainSlant(120, 90))).toBeCloseTo(35, 6);
    expect(MAX_SLANT).toBeCloseTo((35 * Math.PI) / 180, 12);
  });

  it("leans toward where the wind blows: east is screen-left, west is screen-right", () => {
    // The viewer faces south. A west wind (from 270°) blows east: the streaks' lower ends are to the left.
    expect(Math.tan(rainSlant(20, 270))).toBeLessThan(0);
    expect(Math.tan(rainSlant(20, 90))).toBeGreaterThan(0);
    // From 200° (south-south-west) it blows toward 20°, which has an eastward component: left, at atan(0.34 · tan 35°).
    expect(deg(rainSlant(30, 200))).toBeCloseTo(13.4, 0);
    expect(Math.tan(rainSlant(30, 200))).toBeLessThan(0);
  });

  it("stays vertical in a north or south wind (along the view)", () => {
    expect(rainSlant(40, 0)).toBeCloseTo(0, 12);
    expect(rainSlant(40, 180)).toBeCloseTo(0, 12);
  });
});

describe("three depths", () => {
  it("splits the streaks 50 / 35 / 15, exactly, whatever the count", () => {
    expect(layerCounts(1000)).toEqual({ far: 500, mid: 350, near: 150 });
    expect(layerCounts(7)).toEqual({ far: 4, mid: 2, near: 1 });
    expect(layerCounts(0)).toEqual({ far: 0, mid: 0, near: 0 });
    expect(RAIN_LAYER.far.share + RAIN_LAYER.mid.share + RAIN_LAYER.near.share).toBe(1);
  });

  it("has the briefed lengths, widths, alphas and speeds, each growing with nearness", () => {
    expect(RAIN_LAYER.far).toMatchObject({ len: [6, 10], width: 1, alpha: [0.1, 0.16], speed: [600, 800] });
    expect(RAIN_LAYER.mid).toMatchObject({ len: [12, 20], width: 1, alpha: [0.18, 0.28], speed: [900, 1200] });
    expect(RAIN_LAYER.near).toMatchObject({ len: [26, 44], width: 1.5, alpha: [0.28, 0.4], speed: [1400, 1900] });
    for (let i = 1; i < RAIN_LAYERS.length; i++) {
      const a = RAIN_LAYER[RAIN_LAYERS[i - 1]!];
      const b = RAIN_LAYER[RAIN_LAYERS[i]!];
      expect(b.len[0]).toBeGreaterThanOrEqual(a.len[1]);
      expect(b.alpha[0]).toBeGreaterThanOrEqual(a.alpha[1]);
      expect(b.speed[0]).toBeGreaterThanOrEqual(a.speed[1]);
    }
  });

  it("is 8, 22, 48 and 40 streaks per 100,000 px², and the pool holds the densest", () => {
    expect(RAIN_DENSITY).toEqual({ drizzle: 8, rain: 22, "heavy-rain": 48, thunder: 40 });
    expect(RAIN_MAX).toBeGreaterThanOrEqual(Math.max(...CONDITIONS.map((c) => RAIN_DENSITY[c] ?? 0)));
    // 1920×1080 under heavy rain: 995 streaks, 149 of them near.
    expect(Math.round((48 * 1920 * 1080) / 100_000)).toBe(995);
    expect(layerCounts(995)).toEqual({ far: 498, mid: 348, near: 149 });
  });
});

describe("what comes with the rain", () => {
  it("splashes: 30 a second per 1,000 px in rain, 70 in heavy rain (and thunder), none in a drizzle", () => {
    expect(SPLASH_RATE).toEqual({ rain: 30, "heavy-rain": 70, thunder: 70 });
    expect(SPLASH_RATE.drizzle).toBeUndefined();
  });

  it("has no sun disc: every rain but a drizzle is a deck", () => {
    for (const c of ["rain", "heavy-rain", "thunder"] as const) expect(c in RAIN_DENSITY).toBe(true);
  });

  it("turns the lights on with the sky's luminance: on below 0.04, off above 0.048", () => {
    expect(LAMPS_AT.on).toBeLessThan(LAMPS_AT.off);
    // A clear noon is above both; a storm's noon (0.033) and any clear sunset (0.023 at −4°) are below "on".
    expect(LAMPS_AT.off).toBeLessThan(0.0481);
    expect(LAMPS_AT.on).toBeGreaterThan(0.033);
    expect(LAMPS_AT.on).toBeGreaterThan(0.016);
  });
});
