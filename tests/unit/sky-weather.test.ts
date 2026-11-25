import { afterEach, describe, expect, it, vi } from "vitest";
import fixture from "@/server/fixtures/open-meteo-sylhet.json";
import { compass, conditionFor, hasWeather, normalise, upstreamUrl, weatherWord, type Condition } from "@/lib/sky/weather";
import { _resetSylhetCache, getSylhetWeather } from "@/server/sylhet";

describe("WMO code → condition", () => {
  const table: [number[], Condition][] = [
    [[0, 1], "clear"],
    [[2], "partly"],
    [[3], "overcast"],
    [[45, 48], "fog"],
    [[51, 52, 53, 54, 55, 56, 57], "drizzle"],
    [[61, 63, 80, 81], "rain"],
    [[65, 67, 82], "heavy-rain"],
    [[95, 96, 97, 98, 99], "thunder"],
    [[71, 72, 73, 74, 75, 76, 77, 85, 86], "overcast"],
  ];
  for (const [codes, cond] of table) {
    it.each(codes)(`code %i → ${cond}`, (code) => expect(conditionFor(code)).toBe(cond));
  }
});

describe("normalise", () => {
  it("maps the recorded Open-Meteo response", () => {
    const w = normalise(fixture)!;
    expect(w).toMatchObject({
      observedAt: "2026-11-25T08:15:00+06:00",
      tempC: 20.9,
      feelsC: 24,
      humidity: 94,
      cloudCover: 0.86,
      condition: "fog",
      windKmh: 4.6,
      windFromDeg: 101,
      visibilityM: 480,
      sunrise: "2026-11-25T06:15:00+06:00",
      sunset: "2026-11-25T17:03:00+06:00",
      stale: false,
    });
  });
  it("treats visibility as optional", () => {
    const current: Partial<typeof fixture.current> = { ...fixture.current };
    delete current.visibility;
    const w = normalise({ ...fixture, current })!;
    expect(w.visibilityM).toBeUndefined();
    expect(w.condition).toBe("fog");
  });
  it("rejects a malformed body", () => {
    expect(normalise({ current: { time: "x" } })).toBeNull();
    expect(normalise(null)).toBeNull();
  });
  it("asks Open-Meteo for exactly the fields we use, in Asia/Dhaka", () => {
    const u = new URL(upstreamUrl());
    expect(u.origin + u.pathname).toBe("https://api.open-meteo.com/v1/forecast");
    expect(u.searchParams.get("latitude")).toBe("24.8949");
    expect(u.searchParams.get("longitude")).toBe("91.8687");
    expect(u.searchParams.get("timezone")).toBe("Asia/Dhaka");
    expect(u.searchParams.get("daily")).toBe("sunrise,sunset");
    expect(u.searchParams.get("forecast_days")).toBe("1");
    expect(u.searchParams.get("current")?.split(",")).toContain("visibility");
  });
});

describe("label words", () => {
  it("picks light rain from slight-intensity codes", () => {
    expect(weatherWord({ condition: "rain", code: 61, cloudCover: 1 })).toBe("lightRain");
    expect(weatherWord({ condition: "rain", code: 63, cloudCover: 1 })).toBe("rain");
    expect(weatherWord({ condition: "clear", code: 0, cloudCover: 0.05 })).toBe("clear");
    expect(weatherWord({ condition: "clear", code: 1, cloudCover: 0.1 })).toBe("mostlyClear");
    expect(weatherWord({ condition: "thunder", code: 95, cloudCover: 1 })).toBe("thunderstorm");
  });
  it("maps wind bearings to 8 compass points", () => {
    expect([0, 44, 46, 135, 180, 225, 270, 315, 359].map(compass)).toEqual(["N", "NE", "NE", "SE", "S", "SW", "W", "NW", "N"]);
  });
});

describe("getSylhetWeather", () => {
  afterEach(() => {
    _resetSylhetCache();
    vi.restoreAllMocks();
  });
  const ok = () => Promise.resolve(new Response(JSON.stringify(fixture), { status: 200 }));
  const boom = () => Promise.reject(new Error("network"));

  it("returns the fresh value and caches it in Next's data cache for 15 minutes", async () => {
    const f = vi.fn(ok);
    const w = await getSylhetWeather(f as unknown as typeof fetch);
    expect(w.stale).toBe(false);
    expect(hasWeather(w)).toBe(true);
    expect((f.mock.calls[0] as unknown[])[1]).toMatchObject({ next: { revalidate: 900 } });
  });
  it("serves the last good value with stale:true when the upstream fails", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await getSylhetWeather(ok as unknown as typeof fetch);
    const w = await getSylhetWeather(boom as unknown as typeof fetch);
    expect(w.stale).toBe(true);
    expect(w.tempC).toBe(20.9);
    expect(hasWeather(w)).toBe(false);
  });
  it("falls back to a clear, unknown sky when there was never a good value", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const w = await getSylhetWeather(boom as unknown as typeof fetch);
    expect(w).toMatchObject({ condition: "clear", tempC: null, stale: true });
    const bad = () => Promise.resolve(new Response("{}", { status: 200 }));
    expect((await getSylhetWeather(bad as unknown as typeof fetch)).stale).toBe(true);
    const down = () => Promise.resolve(new Response("", { status: 502 }));
    expect((await getSylhetWeather(down as unknown as typeof fetch)).stale).toBe(true);
  });
});
