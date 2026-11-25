import "server-only";
import { isNightElevation, sun } from "@/lib/sky/astro";
import { formatHM } from "@/lib/sky/time";
import { hasWeather, weatherWord } from "@/lib/sky/weather";
import { getSylhetWeather } from "@/server/sylhet";
import { ui } from "@/site";

export type SylhetNow = { time: string; weatherSummary: string; isNight: boolean };

/** What the sylhet_now tool returns: Asia/Dhaka time, a short weather line, and whether it's night there. */
export async function sylhetNow(date: Date = new Date()): Promise<SylhetNow> {
  const w = await getSylhetWeather();
  return {
    time: formatHM(date),
    weatherSummary: hasWeather(w) ? `${Math.round(w.tempC!)}°C, ${ui.sky.words[weatherWord(w)]}` : "unavailable",
    isNight: isNightElevation(sun(date).elevationDeg),
  };
}

/** Runs a data tool for the model. Never throws. */
export async function executeDataTool(name: string, _input: unknown, now: () => Date = () => new Date()): Promise<{ forModel: string; isError: boolean }> {
  try {
    if (name === "sylhet_now") return { forModel: JSON.stringify(await sylhetNow(now())), isError: false };
    return { forModel: JSON.stringify({ error: `unknown tool ${name}` }), isError: true };
  } catch {
    return { forModel: JSON.stringify({ error: "unavailable" }), isError: true };
  }
}
