import { getSylhetWeather, WEATHER_TTL_S } from "@/server/sylhet";

// Rendered per request; the upstream fetch itself is cached for WEATHER_TTL_S by the Next data cache, and the
// CDN caches this response for the same window. Never prerendered, so builds never call Open-Meteo.
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const weather = await getSylhetWeather();
  return Response.json(weather, {
    headers: {
      "cache-control": weather.stale
        ? "public, s-maxage=60, stale-while-revalidate=300"
        : `public, s-maxage=${WEATHER_TTL_S}, stale-while-revalidate=3600`,
    },
  });
}
