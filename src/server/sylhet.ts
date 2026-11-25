import "server-only";
import fixture from "./fixtures/open-meteo-sylhet.json";
import { normalise, UNKNOWN_WEATHER, upstreamUrl, type SylhetWeather } from "@/lib/sky/weather";

/** Open-Meteo "current" values are 15-minutely, so refetching more often buys nothing (~96 upstream calls/day max). */
export const WEATHER_TTL_S = 900;

/** Last good value in this server instance, served with stale:true when the upstream fails. */
let lastGood: SylhetWeather | null = null;

/**
 * Current Sylhet weather, normalised. Never throws.
 * WEATHER_MOCK=1 (tests, e2e, screenshots) returns the recorded fixture without any network call.
 */
export async function getSylhetWeather(fetcher: typeof fetch = fetch): Promise<SylhetWeather> {
  if (process.env.WEATHER_MOCK === "1") return normalise(fixture) ?? UNKNOWN_WEATHER;
  try {
    const res = await fetcher(upstreamUrl(), {
      next: { revalidate: WEATHER_TTL_S },
      signal: AbortSignal.timeout(5000),
      headers: { accept: "application/json" },
    } as RequestInit);
    if (!res.ok) throw new Error(`open-meteo ${res.status}`);
    const w = normalise(await res.json());
    if (!w) throw new Error("open-meteo: unexpected shape");
    lastGood = w;
    return w;
  } catch (err) {
    console.warn(`[sylhet] weather fetch failed: ${err instanceof Error ? err.message : String(err)}`);
    return lastGood ? { ...lastGood, stale: true } : UNKNOWN_WEATHER;
  }
}

/** Test hook. */
export function _resetSylhetCache(): void {
  lastGood = null;
}
