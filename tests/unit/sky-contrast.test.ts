/**
 * The gate for any sky palette retuning: sweep every sun elevation, condition and half of the day, solve the
 * column scrim, and check text over the brightest sky the renderer can put behind the column.
 */
import { describe, expect, it } from "vitest";
import type { Phase } from "@/lib/sky/astro";
import { skyColors, smoothstep } from "@/lib/sky/gradient";
import { fogAmount } from "@/lib/sky/model";
import { brand } from "@/lib/brand";
import { contrast, hexToRgb, labToHex, oklabToRgb, over } from "@/lib/sky/color";
import { brightestSky, compositeOverScrim, SCRIM_MAX, SCRIM_STOPS, scrimProfile } from "@/lib/sky/scrim";
import { CONDITIONS, type Condition } from "@/lib/sky/weather";

/** Worst plausible cloud cover per condition (clear can still carry 20% wisps). */
const COVER: Record<Condition, number> = {
  clear: 0.2,
  partly: 0.6,
  overcast: 1,
  fog: 1,
  drizzle: 1,
  rain: 1,
  "heavy-rain": 1,
  thunder: 1,
};

function model(e: number, phase: Phase, c: Condition) {
  // Worst-case haze: saturated humidity and 1 km visibility unless it's fog (which is 1 anyway).
  const fog = fogAmount({ condition: c, humidity: 100, visibilityM: 1000 });
  return {
    colors: skyColors(e, phase, c),
    glow: smoothstep(-8, -2, e) * (1 - smoothstep(4, 10, e)),
    cloudCover: COVER[c],
    fog,
    thunder: c === "thunder",
    astro: { elevation: e } as never,
  };
}

describe("column contrast over the sky", () => {
  it("keeps --graphite ≥ 4.5:1 and --text ≥ 7:1 at every elevation, condition, phase and height", () => {
    const INK = hexToRgb(brand.ink);
    const TEXT = hexToRgb(brand.text);
    const GRAPHITE = hexToRgb(brand.graphite);
    let worst = { graphite: Infinity, text: Infinity, where: "", a: 0, sky: "" };
    let maxA = { a: 0, where: "" };
    const fails: string[] = [];
    for (let e = -30; e <= 90; e++) {
      for (const c of CONDITIONS) {
        for (const phase of ["morning", "evening"] as const) {
          // The moon disc can sit behind the column at night (here at 30% height); include it as the worst case.
          for (const moon of e < -6 ? [0, 1] : [0]) {
            const m = model(e, phase, c);
            const profile = scrimProfile(m, moon, 0.3);
            for (let i = 0; i <= 64; i++) {
              const y = i / 64;
              const k = Math.min(SCRIM_STOPS.length - 2, Math.floor(y * 4));
              const a = profile[k]! + (profile[k + 1]! - profile[k]!) * ((y - SCRIM_STOPS[k]!) / 0.25);
              const sky = oklabToRgb(brightestSky(m, Math.abs(y - 0.3) < 0.08 ? moon : 0, y));
              const comp = over(sky, INK, a);
              const g = contrast(GRAPHITE, comp);
              const t = contrast(TEXT, comp);
              const where = `${e}° ${c} ${phase}${moon ? " +moon" : ""} y=${y.toFixed(2)}`;
              if (g < worst.graphite) worst = { graphite: g, text: t, where, a, sky: labToHex(brightestSky(m, 0, y)) };
              if (a > maxA.a) maxA = { a, where };
              if (g < 4.5 || t < 7) fails.push(`${where}: graphite ${g.toFixed(2)} text ${t.toFixed(2)} (a ${a.toFixed(3)})`);
            }
          }
        }
      }
    }
    console.info(
      `[sky-contrast] worst: graphite ${worst.graphite.toFixed(2)}:1, text ${worst.text.toFixed(2)}:1 at ${worst.where} (scrim ${worst.a.toFixed(3)}, sky ${worst.sky}); max scrim ${maxA.a.toFixed(3)} at ${maxA.where}`,
    );
    expect(fails.slice(0, 20)).toEqual([]);
  });

  it("needs no scrim on a clear night and clamps at the maximum", () => {
    expect(compositeOverScrim(model(-30, "evening", "clear")).a).toBe(0);
    expect(compositeOverScrim(model(0, "evening", "clear")).a).toBeLessThanOrEqual(SCRIM_MAX);
  });
});
