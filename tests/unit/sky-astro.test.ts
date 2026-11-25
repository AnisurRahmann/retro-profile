import { describe, expect, it } from "vitest";
import sunFixture from "../fixtures/open-meteo-sun.json";
import { isNightElevation, moon, skyState, solarNoon, sun, sunTimes } from "@/lib/sky/astro";
import { dayOfYear, dhakaDate, formatHM, msToNextMinute, parseDhakaLocal } from "@/lib/sky/time";

const peak = (y: number, m: number, d: number) => sun(solarNoon(dhakaDate(y, m, d, 12 * 60))).elevationDeg;

describe("sun geometry over Sylhet (24.9° N)", () => {
  it("solar-noon elevation is ~88.5° on 21 June (90 − 24.9 + 23.44)", () => {
    expect(Math.abs(peak(2026, 6, 21) - 88.54)).toBeLessThanOrEqual(0.6);
  });
  it("solar-noon elevation is ~41.7° on 21 December (90 − 24.9 − 23.44)", () => {
    expect(Math.abs(peak(2026, 12, 21) - 41.66)).toBeLessThanOrEqual(0.6);
  });
  it("rises in the east, sets in the west, sits south at noon in December", () => {
    expect(sun(dhakaDate(2026, 12, 15, 7 * 60)).azimuthDeg).toBeGreaterThan(100);
    expect(sun(dhakaDate(2026, 12, 15, 7 * 60)).azimuthDeg).toBeLessThan(140);
    expect(sun(dhakaDate(2026, 12, 15, 16 * 60 + 30)).azimuthDeg).toBeGreaterThan(220);
    expect(Math.abs(sun(solarNoon(dhakaDate(2026, 12, 15, 720))).azimuthDeg - 180)).toBeLessThan(1);
  });
  it.each(sunFixture.days)("sunrise and sunset match Open-Meteo within ±3 min on $date", ({ date, sunrise, sunset }) => {
    const [y, m, d] = date.split("-").map(Number) as [number, number, number];
    const t = sunTimes(dhakaDate(y, m, d, 12 * 60));
    // Open-Meteo prints whole minutes, so compare against the middle of that minute.
    const toDate = (s: string) => new Date(`${s}:30+06:00`);
    expect(Math.abs(t.sunrise.getTime() - toDate(sunrise).getTime()) / 60_000).toBeLessThanOrEqual(3);
    expect(Math.abs(t.sunset.getTime() - toDate(sunset).getTime()) / 60_000).toBeLessThanOrEqual(3);
  });
});

describe("sky state from elevation", () => {
  it.each([
    [-40, "night"],
    [-18, "night"],
    [-17.9, "astronomical"],
    [-12, "astronomical"],
    [-11.9, "nautical"],
    [-6, "nautical"],
    [-5.9, "civil"],
    [-0.1, "civil"],
    [0, "golden"],
    [7.9, "golden"],
    [8, "day"],
    [88, "day"],
  ] as const)("%f° → %s", (e, s) => expect(skyState(e)).toBe(s));
  it("calls it night once the sun is past civil twilight", () => {
    expect(isNightElevation(-6.1)).toBe(true);
    expect(isNightElevation(-5)).toBe(false);
  });
});

describe("morning vs evening", () => {
  for (const [y, m, d] of [
    [2026, 6, 21],
    [2026, 12, 15],
    [2026, 3, 20],
  ] as const) {
    it(`flips at solar noon on ${y}-${m}-${d}`, () => {
      const noon = solarNoon(dhakaDate(y, m, d, 720)).getTime();
      expect(sun(new Date(noon - 60_000)).phase).toBe("morning");
      expect(sun(new Date(noon + 60_000)).phase).toBe("evening");
    });
  }
  it("is morning just after midnight and evening just before it", () => {
    expect(sun(dhakaDate(2026, 12, 15, 30)).phase).toBe("morning");
    expect(sun(dhakaDate(2026, 12, 15, 23 * 60 + 50)).phase).toBe("evening");
    expect(sun(dhakaDate(2026, 6, 21, 5)).phase).toBe("morning");
  });
});

describe("moon", () => {
  it("is full around 2026-11-24 and new around 2026-12-09", () => {
    // Full moon 2026-11-24 14:53 UTC, new moon 2026-12-09 00:52 UTC.
    expect(moon(new Date("2026-11-24T15:00:00Z")).fraction).toBeGreaterThan(0.98);
    expect(moon(new Date("2026-12-09T01:00:00Z")).fraction).toBeLessThan(0.02);
    expect(moon(new Date("2026-12-03T00:00:00Z")).waxing).toBe(false);
    expect(moon(new Date("2026-12-14T00:00:00Z")).waxing).toBe(true);
  });
});

describe("Dhaka time", () => {
  it("formats in Asia/Dhaka with a 24-hour clock", () => {
    expect(formatHM(new Date("2026-12-15T20:00:00Z"))).toBe("02:00");
    expect(formatHM(new Date("2026-12-15T18:05:00Z"))).toBe("00:05");
  });
  it("parses the ?sky= override as Dhaka wall-clock time", () => {
    expect(parseDhakaLocal("2026-12-15T02:00")?.toISOString()).toBe("2026-12-14T20:00:00.000Z");
    expect(parseDhakaLocal("2026-12-15T24:00")).toBeNull();
    expect(parseDhakaLocal("nope")).toBeNull();
  });
  it("numbers days of the year in Dhaka", () => {
    expect(dayOfYear(new Date("2026-12-31T18:30:00Z"))).toBe(1); // already 1 Jan in Dhaka
    expect(dayOfYear(dhakaDate(2026, 12, 15))).toBe(349);
  });
  it("schedules the next tick exactly on the minute", () => {
    expect(msToNextMinute(Date.UTC(2026, 0, 1, 0, 0, 59, 500))).toBe(500);
    expect(msToNextMinute(Date.UTC(2026, 0, 1, 0, 1))).toBe(60_000);
  });
});
