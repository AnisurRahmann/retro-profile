/**
 * Sylhet weather: Open-Meteo upstream schema, WMO code mapping and the normalised shape /api/sylhet returns.
 * Pure (no fetch, no server-only imports) so the client, the agent tool and the tests share it.
 */
import { z } from "zod";

export const SYLHET = { lat: 24.8949, lon: 91.8687, tz: "Asia/Dhaka", utcOffsetMin: 360 } as const;

export const CONDITIONS = ["clear", "partly", "overcast", "fog", "drizzle", "rain", "heavy-rain", "thunder"] as const;
export type Condition = (typeof CONDITIONS)[number];

/** WMO weather interpretation code → sky condition. Snow (71–77, 85–86; practically impossible in Sylhet) → overcast. */
export function conditionFor(code: number): Condition {
  if (code === 0 || code === 1) return "clear";
  if (code === 2) return "partly";
  if (code === 3) return "overcast";
  if (code === 45 || code === 48) return "fog";
  if (code >= 51 && code <= 57) return "drizzle";
  if (code === 61 || code === 63 || code === 80 || code === 81) return "rain";
  if (code === 65 || code === 67 || code === 82) return "heavy-rain";
  if (code >= 95 && code <= 99) return "thunder";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "overcast";
  // 66 (light freezing rain) and anything unlisted: the nearest honest sky.
  if (code === 66) return "rain";
  return "overcast";
}

export const UPSTREAM_CURRENT = [
  "temperature_2m",
  "relative_humidity_2m",
  "apparent_temperature",
  "is_day",
  "precipitation",
  "rain",
  "showers",
  "weather_code",
  "cloud_cover",
  "wind_speed_10m",
  "wind_direction_10m",
  "visibility",
] as const;

export function upstreamUrl(): string {
  const q = new URLSearchParams({
    latitude: String(SYLHET.lat),
    longitude: String(SYLHET.lon),
    current: UPSTREAM_CURRENT.join(","),
    daily: "sunrise,sunset",
    timezone: SYLHET.tz,
    forecast_days: "1",
  });
  return `https://api.open-meteo.com/v1/forecast?${q.toString()}`;
}

const num = z.number().finite();
export const upstreamSchema = z.object({
  current: z.object({
    time: z.string(),
    temperature_2m: num,
    relative_humidity_2m: num,
    apparent_temperature: num,
    is_day: num.optional(),
    precipitation: num,
    rain: num.optional(),
    showers: num.optional(),
    weather_code: z.number().int(),
    cloud_cover: num,
    wind_speed_10m: num,
    wind_direction_10m: num,
    visibility: num.nullable().optional(),
  }),
  daily: z.object({ sunrise: z.array(z.string()).min(1), sunset: z.array(z.string()).min(1) }),
});

export type SylhetWeather = {
  observedAt: string | null;
  code: number | null;
  tempC: number | null;
  feelsC: number | null;
  humidity: number | null;
  /** 0..1 */
  cloudCover: number;
  precipMm: number;
  condition: Condition;
  windKmh: number;
  windFromDeg: number;
  visibilityM?: number;
  sunrise: string | null;
  sunset: string | null;
  stale: boolean;
};

/** Open-Meteo local times ("2026-11-25T08:15", Asia/Dhaka) → ISO with the +06:00 offset. */
export function dhakaIso(local: string): string {
  return /[zZ]|[+-]\d\d:\d\d$/.test(local) ? local : `${local.length === 16 ? `${local}:00` : local}+06:00`;
}

export function normalise(raw: unknown): SylhetWeather | null {
  const parsed = upstreamSchema.safeParse(raw);
  if (!parsed.success) return null;
  const { current: c, daily } = parsed.data;
  return {
    observedAt: dhakaIso(c.time),
    code: c.weather_code,
    tempC: Math.round(c.temperature_2m * 10) / 10,
    feelsC: Math.round(c.apparent_temperature * 10) / 10,
    humidity: c.relative_humidity_2m,
    cloudCover: Math.min(1, Math.max(0, c.cloud_cover / 100)),
    precipMm: c.precipitation,
    condition: conditionFor(c.weather_code),
    windKmh: c.wind_speed_10m,
    windFromDeg: c.wind_direction_10m,
    ...(typeof c.visibility === "number" ? { visibilityM: c.visibility } : {}),
    sunrise: dhakaIso(daily.sunrise[0]!),
    sunset: dhakaIso(daily.sunset[0]!),
    stale: false,
  };
}

/** No data at all: a clear sky, no weather in the label. */
export const UNKNOWN_WEATHER: SylhetWeather = {
  observedAt: null,
  code: null,
  tempC: null,
  feelsC: null,
  humidity: null,
  cloudCover: 0,
  precipMm: 0,
  condition: "clear",
  windKmh: 0,
  windFromDeg: 0,
  sunrise: null,
  sunset: null,
  stale: true,
};

export const WEATHER_WORDS = [
  "clear",
  "mostlyClear",
  "partlyCloudy",
  "overcast",
  "foggy",
  "drizzle",
  "lightRain",
  "rain",
  "heavyRain",
  "thunderstorm",
] as const;
export type WeatherWord = (typeof WEATHER_WORDS)[number];

/** Which word the label uses. Light vs moderate rain comes from the WMO code (61/80 = slight). */
export function weatherWord(w: Pick<SylhetWeather, "condition" | "code" | "cloudCover">): WeatherWord {
  switch (w.condition) {
    case "clear":
      return w.code === 1 || w.cloudCover >= 0.2 ? "mostlyClear" : "clear";
    case "partly":
      return "partlyCloudy";
    case "overcast":
      return "overcast";
    case "fog":
      return "foggy";
    case "drizzle":
      return "drizzle";
    case "rain":
      return w.code === 61 || w.code === 80 || w.code === 66 ? "lightRain" : "rain";
    case "heavy-rain":
      return "heavyRain";
    case "thunder":
      return "thunderstorm";
  }
}

/** 16-point compass → 8-point label key ("from SE"). */
export const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;
export function compass(deg: number): (typeof COMPASS)[number] {
  return COMPASS[Math.round((((deg % 360) + 360) % 360) / 45) % 8]!;
}

/** Whether the label should show weather at all. */
export const hasWeather = (w: SylhetWeather | null): w is SylhetWeather => !!w && !w.stale && w.tempC !== null;

/** Shape check for the client (the route's JSON). */
export const weatherSchema = z.object({
  observedAt: z.string().nullable(),
  code: z.number().nullable(),
  tempC: z.number().nullable(),
  feelsC: z.number().nullable(),
  humidity: z.number().nullable(),
  cloudCover: z.number(),
  precipMm: z.number(),
  condition: z.enum(CONDITIONS),
  windKmh: z.number(),
  windFromDeg: z.number(),
  visibilityM: z.number().optional(),
  sunrise: z.string().nullable(),
  sunset: z.string().nullable(),
  stale: z.boolean(),
});
