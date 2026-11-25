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
import { brightestSky, compositeOverScrim, HERO_TARGETS, ON_SKY, regionScrim, SCRIM_MAX, SCRIM_STOPS, scrimProfile, SUN_UNDER_TEXT } from "@/lib/sky/scrim";
import { layerColor, riverColor } from "@/components/sky/landscape";
import { sunColor } from "@/lib/sky/gradient";
import { mixLab, rgbToOklab } from "@/lib/sky/color";
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
          for (const moon of e < -6 ? [0, 1] : e > 0 ? [0, -1] : [0]) {
            const m = model(e, phase, c);
            // moon −1: the sun disc behind the column instead (dimmed to SUN_UNDER_TEXT), at 30% height.
            const sun = moon === -1 ? { y: 0.3, rgb: sunColor(e), alpha: SUN_UNDER_TEXT } : null;
            const profile = scrimProfile(m, Math.max(0, moon), 0.3, sun);
            for (let i = 0; i <= 64; i++) {
              const y = i / 64;
              const k = Math.min(SCRIM_STOPS.length - 2, Math.floor(y * 4));
              const a = profile[k]! + (profile[k + 1]! - profile[k]!) * ((y - SCRIM_STOPS[k]!) / 0.25);
              const sky = oklabToRgb(brightestSky(m, Math.abs(y - 0.3) < 0.08 ? Math.max(0, moon) : 0, y, undefined, sun));
              const comp = over(sky, INK, a);
              const g = contrast(GRAPHITE, comp);
              const t = contrast(TEXT, comp);
              const where = `${e}° ${c} ${phase}${moon === 1 ? " +moon" : moon === -1 ? " +sun" : ""} y=${y.toFixed(2)}`;
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

  it("keeps the hero readable over the open stage, with the sun beside or behind it (mobile)", () => {
    const INK = hexToRgb(brand.ink);
    const TEXT = hexToRgb(brand.text);
    // A 375×812 hero block spans roughly 32–65% of the viewport height; on desktop 42–58%.
    const blocks = [
      [0.32, 0.65],
      [0.42, 0.58],
    ] as const;
    let worst = { onSky: Infinity, text: Infinity, where: "", a: 0 };
    const fails: string[] = [];
    for (let e = -30; e <= 90; e += 2) {
      for (const c of CONDITIONS) {
        for (const phase of ["morning", "evening"] as const) {
          const m = model(e, phase, c);
          for (const [y0, y1] of blocks) {
            // The sun near the block: drawn dimmed, its bloom reaching the text at up to 0.2 (the controller's guard).
            for (const sun of e > -1 ? [null, { y: (y0 + y1) / 2, rgb: sunColor(e), alpha: Math.max(SUN_UNDER_TEXT, 0.2) }] : [null]) {
              const a = regionScrim(m, y0, y1, HERO_TARGETS, sun);
              for (let i = 0; i <= 16; i++) {
                const y = y0 + ((y1 - y0) * i) / 16;
                const disc = sun ? { ...sun, y } : null;
                const comp = over(oklabToRgb(brightestSky(m, 0, y, 1, disc)), INK, a);
                const g = contrast(ON_SKY, comp);
                const t = contrast(TEXT, comp);
                const where = `${e}° ${c} ${phase} block ${y0}–${y1}${sun ? " +sun" : ""} y=${y.toFixed(2)}`;
                if (g < worst.onSky) worst = { onSky: g, text: t, where, a };
                if (g < 4.5 || t < 7) fails.push(`${where}: on-sky ${g.toFixed(2)} text ${t.toFixed(2)} (a ${a.toFixed(3)})`);
              }
            }
          }
        }
      }
    }
    console.info(`[sky-contrast] hero worst: --on-sky ${worst.onSky.toFixed(2)}:1, --text ${worst.text.toFixed(2)}:1 at ${worst.where} (scrim ${worst.a.toFixed(3)})`);
    expect(fails.slice(0, 20)).toEqual([]);
  });

  it("keeps text over the landscape band readable: every layer, the river and the golden rim, under the scrim", () => {
    const INK = hexToRgb(brand.ink);
    const TEXT = hexToRgb(brand.text);
    const GRAPHITE = hexToRgb(brand.graphite);
    let worst = { g: Infinity, where: "" };
    const fails: string[] = [];
    for (let e = -30; e <= 90; e += 2) {
      for (const c of CONDITIONS) {
        for (const phase of ["morning", "evening"] as const) {
          const m = model(e, phase, c);
          // The band covers the bottom of the viewport; the scrim there is at least the lower stops' alpha.
          const a = Math.min(...scrimProfile(m).slice(3));
          const h = m.colors.horizon;
          const colors = (["L1", "L2", "L3", "L4"] as const).map((l) => layerColor(h, l));
          colors.push(riverColor(h), mixLab(layerColor(h, "L2"), h, 0.5)); // the rim at its brightest
          // The city's night glow, as drawn: the lifted horizon at ≤ 0.45 over the sky.
          if (e < -6) colors.push(rgbToOklab(over(oklabToRgb(h), oklabToRgb(mixLab(h, [0.62, 0.01, 0.03], 0.16)), 0.45)));
          for (const col of colors) {
            const comp = over(oklabToRgb(col), INK, a);
            const g = contrast(GRAPHITE, comp);
            const t = contrast(TEXT, comp);
            if (g < worst.g) worst = { g, where: `${e}° ${c} ${phase}` };
            if (g < 4.5 || t < 7) fails.push(`${e}° ${c} ${phase}: graphite ${g.toFixed(2)} text ${t.toFixed(2)}`);
          }
        }
      }
    }
    console.info(`[sky-contrast] landscape worst: --graphite ${worst.g.toFixed(2)}:1 at ${worst.where}`);
    expect(fails.slice(0, 20)).toEqual([]);
  });

  it("needs no scrim on a clear night and clamps at the maximum", () => {
    expect(compositeOverScrim(model(-30, "evening", "clear")).a).toBe(0);
    expect(compositeOverScrim(model(0, "evening", "clear")).a).toBeLessThanOrEqual(SCRIM_MAX);
  });
});
