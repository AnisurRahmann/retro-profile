import SunCalc from "suncalc";
import { describe, expect, it } from "vitest";
import {
  ALT_REF,
  ARC,
  arcGeom,
  arcPoint,
  moonPass,
  nightPoint,
  SCENE_HORIZON,
  seasonScale,
  stageHeightFor,
  sunPass,
} from "@/lib/sky/arc";
import { PHONE_HILL_TOP, sceneBand } from "@/lib/sky/landscape/anchors";
import { solarNoon } from "@/lib/sky/astro";
import { dhakaDate } from "@/lib/sky/time";
import { SYLHET } from "@/lib/sky/weather";

const g = arcGeom(1440, 900, stageHeightFor(1440, 900));

describe("sky arc", () => {
  it("lays out under the header and above the stage bottom", () => {
    expect(g.apexY).toBe(64 + 28);
    expect(g.horizonY).toBeCloseTo(558 - 0.08 * 900, 6);
  });

  it("puts u = 0 and u = 1 on the horizon endpoints (6% / 94%), discs clamped to [8%, 92%]", () => {
    const e = arcPoint(0, 0, 45, g);
    const w = arcPoint(1, 0, 45, g);
    expect(e.x).toBeCloseTo(0.06 * 1440, 6);
    expect(w.x).toBeCloseTo(0.94 * 1440, 6);
    expect(e.y).toBe(g.horizonY);
    expect(w.y).toBe(g.horizonY);
    expect(e.cx).toBeCloseTo(0.08 * 1440, 6);
    expect(w.cx).toBeCloseTo(0.92 * 1440, 6);
    for (let u = -0.2; u <= 1.2; u += 0.01) {
      const p = arcPoint(u, 10, 45, g);
      expect(p.cx).toBeGreaterThanOrEqual(ARC.clamp[0] * 1440 - 1e-9);
      expect(p.cx).toBeLessThanOrEqual(ARC.clamp[1] * 1440 + 1e-9);
    }
  });

  it("is a quarter-ellipse each side: it climbs fast after sunrise", () => {
    // At u = 0.1 a quarter-ellipse has covered 1 − cos(0.1π) ≈ 4.9% of its half-width in x, but sin(0.1π) ≈ 31% of
    // its height would be reached by a body at that fraction of max altitude (a parabola would reach 36% x … ).
    const p = arcPoint(0.1, 0, 45, g);
    expect((p.x - 0.06 * 1440) / (0.44 * 1440)).toBeCloseTo(1 - Math.cos(0.1 * Math.PI), 6);
    // Height follows real altitude.
    const half = arcPoint(0.5, 22.5, 45, g);
    expect((g.horizonY - half.y) / (g.horizonY - g.apexY)).toBeCloseTo(0.5 * seasonScale(45), 6);
  });

  it("scales the apex with the season: 21 June reaches the apex, 21 December sits lower", () => {
    const june = sunPass(solarNoon(dhakaDate(2026, 6, 21, 12 * 60)));
    const dec = sunPass(solarNoon(dhakaDate(2026, 12, 21, 12 * 60)));
    expect(june.maxAlt).toBeCloseTo(ALT_REF, 0);
    expect(dec.maxAlt).toBeCloseTo(90 - SYLHET.lat - 23.44, 0);
    const pj = arcPoint(june.u, june.alt, june.maxAlt, g);
    const pd = arcPoint(dec.u, dec.alt, dec.maxAlt, g);
    expect(pj.y).toBeCloseTo(g.apexY, 0);
    expect(june.u).toBeCloseTo(0.5, 1);
    const ratio = (g.horizonY - pd.y) / (g.horizonY - pj.y);
    expect(ratio).toBeCloseTo(
      Math.sin((dec.maxAlt * Math.PI) / 180) / Math.sin((ALT_REF * Math.PI) / 180),
      2,
    );
    expect(ratio).toBeLessThan(0.7);
  });

  it("maps the sun from sunrise (u 0) to sunset (u 1)", () => {
    const t = SunCalc.getTimes(dhakaDate(2026, 12, 15, 12 * 60), SYLHET.lat, SYLHET.lon);
    expect(sunPass(t.sunrise).u).toBeCloseTo(0, 3);
    expect(sunPass(t.sunset).u).toBeCloseTo(1, 3);
    expect(sunPass(new Date(t.sunrise.getTime() - 60_000)).up).toBe(false);
    expect(sunPass(new Date(t.sunrise.getTime() + 60_000)).up).toBe(true);
  });
});

describe("moon pass (suncalc.getMoonTimes)", () => {
  it("maps moonrise to u 0 and moonset to u 1, up in between, with the pass's real maximum", () => {
    for (const day of [3, 10, 15, 22, 28]) {
      const noon = dhakaDate(2026, 12, day, 12 * 60);
      const m = SunCalc.getMoonTimes(noon, SYLHET.lat, SYLHET.lon, true);
      const rise = m.rise!.getTime();
      const p0 = moonPass(new Date(rise + 60_000));
      expect(p0.up).toBe(true);
      expect(p0.u).toBeGreaterThanOrEqual(0);
      expect(p0.u).toBeLessThan(0.01);
      expect(Math.abs(p0.alt)).toBeLessThan(1.5);
      const p1 = moonPass(new Date(p0.set - 60_000));
      expect(p1.u).toBeGreaterThan(0.99);
      expect(p1.u).toBeLessThanOrEqual(1);
      const mid = moonPass(new Date((p0.rise + p0.set) / 2));
      expect(mid.up).toBe(true);
      expect(mid.alt).toBeGreaterThan(20);
      expect(mid.maxAlt).toBeGreaterThanOrEqual(mid.alt - 0.5);
      expect(moonPass(new Date(p0.set + 60_000)).up).toBe(false);
    }
  });

  it("on a 375×812 phone (the postcard stage) the arc spans the open sky band: 8% and 92% wide, 8px above the hills, its apex 28px under the text", () => {
    const stage = stageHeightFor(375, 812);
    expect(stage).toBe(812 - 40); // the first screen less 40px, so "Shipped" peeks in
    expect(stageHeightFor(375, 568)).toBe(600);
    const textBottom = 88 + 164; // the header + 24px, then the text block
    const m = arcGeom(375, 812, stage, true, textBottom);
    expect(m.apexY).toBe(textBottom + 28);
    const band = sceneBand(375, 812);
    expect(band).toBe(200);
    expect(m.horizonY).toBeCloseTo(stage - band + PHONE_HILL_TOP * (band / 100) - 8, 6);
    expect(m.horizonY - m.apexY).toBeGreaterThanOrEqual(300);
    expect(arcPoint(0, 0, 45, m).x).toBeCloseTo(0.08 * 375, 6);
    expect(arcPoint(1, 0, 45, m).x).toBeCloseTo(0.92 * 375, 6);
    expect(arcPoint(0.5, 45, 45, m).x).toBeCloseTo(187.5, 6);
    // The night continuation runs under the horizon from the west end back to the east end.
    expect(nightPoint(0, m, 10).x).toBeCloseTo(0.92 * 375, 6);
    expect(nightPoint(1, m, 10).x).toBeCloseTo(0.08 * 375, 6);
    // It follows the text block: a taller one lifts the arc with it, and a resize recomputes it.
    expect(arcGeom(375, 812, stage, true, textBottom + 20).apexY).toBe(textBottom + 20 + 28);
    expect(arcGeom(320, 568, 600, true, textBottom).horizonY).toBeCloseTo(600 - 200 + PHONE_HILL_TOP * 2 - 8, 6);
    // Unmeasured text block: a nominal one.
    expect(arcGeom(375, 812, stage, true).apexY).toBe(64 + 24 + 164 + 28);
    // 16:45 on 26 Nov: low in the west, right of centre, in the sky band, inside the screen, clear of the text.
    const t = new Date("2026-11-26T16:45:00+06:00");
    const p = sunPass(t);
    const pt = arcPoint(p.u, p.alt, p.maxAlt, m);
    expect(pt.cx).toBeGreaterThan(375 / 2);
    expect(pt.cx + 13).toBeLessThanOrEqual(375);
    expect(pt.y).toBeLessThan(m.horizonY);
    expect(pt.y - 13).toBeGreaterThan(textBottom);
    // Nothing on the arc reaches the text block, wherever it is: the apex is the highest point.
    for (let u = 0; u <= 1; u += 0.01) expect(arcPoint(u, 90, 90, m).y - 13).toBeGreaterThan(textBottom);
  });

  it("from 640px up the arc is as it was: header + 16 to the far hills' foot in the stage scene", () => {
    const stage = stageHeightFor(768, 1024);
    expect(stage).toBeCloseTo(0.7 * 1024, 6);
    const m = arcGeom(768, 1024, stage, true, 400);
    expect(m.apexY).toBe(64 + 16);
    expect(m.span).toBeUndefined();
    expect(m.horizonY).toBeCloseTo(stage - (1 - SCENE_HORIZON) * sceneBand(768, 1024), 6);
    expect(arcPoint(0, 0, 45, m).x).toBeCloseTo(ARC.east * 768, 6);
  });
});
