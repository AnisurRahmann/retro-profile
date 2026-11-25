import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { sun } from "@/lib/sky/astro";
import { hexToLab, hexToRgb, labToHex, mixLab, rgbToHex, rgbToOklab, oklabToRgb, type Lab } from "@/lib/sky/color";
import { ELEVATION_SRC, firstPaintScript } from "@/lib/sky/first-paint";
import { clearSky, skyColors, toCss } from "@/lib/sky/gradient";
import { SKY_KEYFRAMES } from "@/lib/sky/palette";
import { dhakaDate } from "@/lib/sky/time";

const chroma = ([, a, b]: Lab) => Math.hypot(a, b);
const dE = (x: string, y: string) => {
  const [a, b] = [hexToLab(x), hexToLab(y)];
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
};

describe("OKLab", () => {
  it("round-trips sRGB", () => {
    for (const hex of ["#0b1220", "#d9813a", "#e6eaf2", "#2e5a92", "#000000", "#ffffff"]) {
      expect(rgbToHex(oklabToRgb(rgbToOklab(hexToRgb(hex))))).toBe(hex);
    }
  });
  it("matches reference values (Björn Ottosson's)", () => {
    const [L, a, b] = rgbToOklab([1, 1, 1]);
    expect(L).toBeCloseTo(1, 3);
    expect(a).toBeCloseTo(0, 3);
    expect(b).toBeCloseTo(0, 3);
    const red = rgbToOklab([1, 0, 0]);
    expect(red[0]).toBeCloseTo(0.628, 3);
    expect(red[1]).toBeCloseTo(0.2249, 3);
    expect(red[2]).toBeCloseTo(0.1258, 3);
  });
  it("mixes without going grey: dusk amber → navy keeps more chroma than an sRGB mix", () => {
    const amber = hexToLab("#d9813a");
    const navy = hexToLab("#22396a");
    const lab = mixLab(amber, navy, 0.5);
    const [r1, g1, b1] = hexToRgb("#d9813a");
    const [r2, g2, b2] = hexToRgb("#22396a");
    const srgb = rgbToOklab([(r1 + r2) / 2, (g1 + g2) / 2, (b1 + b2) / 2]);
    expect(lab[0]).toBeGreaterThan(srgb[0]); // sRGB midpoints are too dark
    expect(mixLab(amber, navy, 0)).toEqual(amber);
    expect(labToHex(mixLab(amber, navy, 1))).toBe("#22396a");
  });
});

describe("sky gradient", () => {
  it("hits every keyframe exactly at its elevation", () => {
    for (const k of SKY_KEYFRAMES) {
      const dawn = toCss(clearSky(k.elev, "morning"));
      const dusk = toCss(clearSky(k.elev, "evening"));
      expect(dawn.zenith).toBe(k.zenith.toLowerCase());
      expect(dawn.mid).toBe(k.mid.toLowerCase());
      expect(dawn.horizon).toBe(k.dawn.toLowerCase());
      expect(dusk.horizon).toBe(k.dusk.toLowerCase());
    }
  });
  it("clamps below night and above day", () => {
    expect(toCss(clearSky(-60, "evening"))).toEqual(toCss(clearSky(-18, "evening")));
    expect(toCss(clearSky(88, "morning"))).toEqual(toCss(clearSky(25, "morning")));
  });
  it("desaturates and darkens with weather", () => {
    const clear = clearSky(4, "evening");
    const over = skyColors(4, "evening", "overcast");
    const storm = skyColors(4, "evening", "thunder");
    expect(chroma(over.horizon)).toBeLessThan(chroma(clear.horizon) * 0.56);
    expect(storm.horizon[0]).toBeLessThan(clear.horizon[0]);
    expect(skyColors(4, "evening", "fog").horizon[0]).toBeGreaterThan(clear.horizon[0]);
    expect(skyColors(4, "evening", "partly")).toEqual(clear);
  });
  it("seeds the @property initial values in globals.css with the night keyframe", () => {
    const css = fs.readFileSync("src/app/globals.css", "utf8");
    const night = SKY_KEYFRAMES[0]!;
    for (const [name, hex] of [["zenith", night.zenith], ["mid", night.mid], ["horizon", night.dawn]] as const) {
      const m = css.match(new RegExp(`@property --sky-${name}\\s*{[^}]*initial-value:\\s*(#[0-9a-fA-F]{6})`));
      expect(m?.[1]?.toLowerCase(), name).toBe(hex.toLowerCase());
    }
  });
});

describe("first-paint script", () => {
  const noaa = new Function(`return ${ELEVATION_SRC}`)() as (t: number) => [number, number];

  it("estimates sun elevation within 1.5° of suncalc across a year at 30-minute steps", () => {
    let worst = 0;
    const start = Date.UTC(2026, 0, 1);
    for (let t = start; t < start + 365 * 86400_000; t += 30 * 60_000) {
      worst = Math.max(worst, Math.abs(noaa(t)[0] - sun(new Date(t)).elevationDeg));
    }
    console.info(`[first-paint] worst elevation error over 2026: ${worst.toFixed(3)}°`);
    expect(worst).toBeLessThanOrEqual(1.5);
  });

  it("agrees with suncalc on morning vs evening away from noon", () => {
    const start = Date.UTC(2026, 0, 1);
    for (let t = start; t < start + 365 * 86400_000; t += 97 * 60_000) {
      const s = sun(new Date(t));
      const [, h] = noaa(t);
      // Skip ~4 min around solar noon and ~20 min around solar midnight (suncalc's day-cycle boundary sits there,
      // and at night dawn and dusk horizons are the same colour anyway).
      if (Math.abs(h) < 1 || Math.abs(h) > 175) continue;
      expect(h < 0 ? "morning" : "evening").toBe(s.phase);
    }
  });

  const run = (src: string, search = "", now?: number) => {
    const props: Record<string, string> = {};
    const html = { style: { setProperty: (k: string, v: string) => (props[k] = v) }, dataset: {} as Record<string, string> };
    const RealDate = Date;
    class FakeDate extends RealDate {
      static override now = () => now ?? RealDate.now();
    }
    new Function("document", "location", "Date", src)({ documentElement: html }, { search }, FakeDate);
    return { props, state: html.dataset.sky };
  };

  it("is under 1.5 kB in production (the ?sky= parser adds ~120 B to dev and test builds only)", () => {
    expect(firstPaintScript(false).length).toBeLessThan(1500);
    expect(firstPaintScript(true).length - firstPaintScript(false).length).toBeLessThan(140);
  });

  it("sets scrim stops no lighter than the solved profile", async () => {
    const { scrimProfile } = await import("@/lib/sky/scrim");
    const { smoothstep } = await import("@/lib/sky/gradient");
    for (const mins of [6 * 60 + 25, 11 * 60, 16 * 60 + 55, 17 * 60 + 35]) {
      const t = dhakaDate(2026, 12, 15, mins);
      const { props } = run(firstPaintScript(false), "", t.getTime());
      const s = sun(t);
      const e = s.elevationDeg;
      const want = scrimProfile({ colors: clearSky(e, s.phase), glow: smoothstep(-8, -2, e) * (1 - smoothstep(4, 10, e)), cloudCover: 0, fog: 0, astro: { elevation: e } as never });
      want.forEach((a, i) => expect(Number(props[`--scrim-${i}`]), `${mins} stop ${i}`).toBeGreaterThanOrEqual(a - 0.02));
    }
  });

  it("sets the three sky variables close to the full OKLab pipeline", () => {
    for (const [mins, d] of [
      [2 * 60, 15],
      [5 * 60 + 45, 15],
      [6 * 60 + 25, 15],
      [11 * 60, 15],
      [16 * 60 + 55, 15],
      [17 * 60 + 35, 15],
    ] as const) {
      const t = dhakaDate(2026, 12, d, mins);
      const { props, state } = run(firstPaintScript(false), "", t.getTime());
      const s = sun(t);
      const want = toCss(clearSky(s.elevationDeg, s.phase));
      expect(dE(props["--sky-zenith"]!, want.zenith), `zenith ${mins}`).toBeLessThan(0.02);
      expect(dE(props["--sky-mid"]!, want.mid), `mid ${mins}`).toBeLessThan(0.02);
      expect(dE(props["--sky-horizon"]!, want.horizon), `horizon ${mins}`).toBeLessThan(0.03);
      expect(state).toBeTruthy();
    }
  });

  it("honours ?sky= only in the debug build", () => {
    const night = run(firstPaintScript(true), "?sky=2026-12-15T02:00", dhakaDate(2026, 12, 15, 12 * 60).getTime());
    expect(night.state).toBe("night");
    const prod = run(firstPaintScript(false), "?sky=2026-12-15T02:00", dhakaDate(2026, 12, 15, 12 * 60).getTime());
    expect(prod.state).toBe("day");
  });
});
