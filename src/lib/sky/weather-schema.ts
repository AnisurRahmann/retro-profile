/** Server-side parsing of the Open-Meteo response (zod). Never import this from client code. */
import { z } from "zod";
import { conditionFor, dhakaIso, type SylhetWeather } from "./weather";

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

