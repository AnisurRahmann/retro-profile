/**
 * The flat cloud model (src/lib/sky/flat-clouds.ts): coverage per condition, determinism, a constant count while
 * the clouds drift off one side and back on the other, the wind, the breath and the tones.
 */
import { describe, expect, it } from "vitest";
import {
  BREATH,
  LAYER,
  NO_DRIFT,
  breathR,
  cloudTones,
  cloudsAt,
  coverage,
  coverageBand,
  flashTones,
  gust,
  inside,
  nearSpeed,
  planClouds,
  sdCloud,
  type LayerId,
} from "@/lib/sky/flat-clouds";
import { hexToLab, oklabToRgb } from "@/lib/sky/color";
import { FLAT_CLOUD_GOLDEN, FLAT_CLOUD_RIM } from "@/lib/sky/palette";
import { WX_DEFAULTS } from "@/lib/sky/store";
import type { Condition } from "@/lib/sky/weather";

// A 16:9 sky (1440 × 810) rasterised at 160 × 90; the header's text ends 48px down.
const VW = 1440;
const SKY = 810;
const plan = (condition: Condition, cover: number, day: number, vw = VW, skyH = SKY) =>
  planClouds({ condition, cover, day, vw, skyH, deckTop: 48, gutters: vw >= 1100 ? [[0, 336], [vw - 336, vw]] : undefined });
const SEEDS = [3, 41, 77, 102, 150, 199, 233, 271, 318, 360];

describe("coverage: the share of the sky (top to horizon) under cloud", () => {
  const cases: [string, Condition, number, number, number][] = [
    ["clear", "clear", WX_DEFAULTS.clear.cloudCover, 0, 0.03],
    ["partly", "partly", WX_DEFAULTS.partly.cloudCover, 0.18, 0.28],
    ["cloud cover 70", "partly", 0.7, 0.4, 0.55],
    ["overcast", "overcast", WX_DEFAULTS.overcast.cloudCover, 0.8, 0.92],
    ["drizzle", "drizzle", WX_DEFAULTS.drizzle.cloudCover, 0.8, 0.92],
    ["rain", "rain", WX_DEFAULTS.rain.cloudCover, 0.9, 1],
    ["heavy rain", "heavy-rain", WX_DEFAULTS["heavy-rain"].cloudCover, 0.9, 1],
    ["thunder", "thunder", WX_DEFAULTS.thunder.cloudCover, 0.9, 1],
    ["fog", "fog", WX_DEFAULTS.fog.cloudCover, 0, 0],
  ];
  for (const [name, c, cover, lo, hi] of cases)
    it(`keeps ${name} within ${lo * 100}–${hi * 100}% for 10 seeds`, () => {
      for (const day of SEEDS) {
        const v = coverage(cloudsAt(plan(c, cover, day), NO_DRIFT), VW, SKY, 160, 90);
        expect(v, `day ${day}`).toBeGreaterThanOrEqual(lo);
        expect(v, `day ${day}`).toBeLessThanOrEqual(hi);
      }
    });

  it("maps a live cloud cover linearly inside its condition's band", () => {
    expect(coverageBand("partly", 0.2).target).toBeCloseTo(0.18);
    expect(coverageBand("partly", 0.4).target).toBeCloseTo(0.23);
    expect(coverageBand("partly", 0.6).target).toBeCloseTo(0.4);
    expect(coverageBand("partly", 1).target).toBeCloseTo(0.55);
    expect(coverageBand("overcast", 0.8).target).toBeCloseTo(0.86);
    expect(coverageBand("clear", 0.1).target).toBeCloseTo(0.015);
    expect(coverageBand("fog", 1).target).toBe(0);
  });

  it("stays in its band while the wind carries the clouds", () => {
    const p = plan("partly", 0.45, 77);
    for (const near of [0, 300, 1700, 5200, -2400]) {
      const off = { far: near * LAYER.far.speed, mid: near * LAYER.mid.speed, near };
      const v = coverage(cloudsAt(p, off), VW, SKY, 160, 90);
      expect(v).toBeGreaterThanOrEqual(0.18);
      expect(v).toBeLessThanOrEqual(0.28);
    }
  });
});

describe("the arrangement", () => {
  it("is the same for the same day and layout (a reload shows the same sky), another on another day", () => {
    const a = cloudsAt(plan("partly", 0.45, 120), NO_DRIFT).map((c) => [c.key, c.x, c.base, c.shape.w, c.shape.h]);
    const b = cloudsAt(plan("partly", 0.45, 120), NO_DRIFT).map((c) => [c.key, c.x, c.base, c.shape.w, c.shape.h]);
    const c = cloudsAt(plan("partly", 0.45, 121), NO_DRIFT).map((c) => [c.key, c.x, c.base, c.shape.w, c.shape.h]);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it("keeps the count constant as clouds leave downwind and come back upwind in a new shape", () => {
    const p = plan("partly", 0.7, 33);
    const n = cloudsAt(p, NO_DRIFT, true).length;
    const near = p.puffs.find((l) => l.id === "near")!;
    const before = cloudsAt(p, NO_DRIFT, true).filter((c) => c.key.startsWith("near:0:"))[0]!;
    for (const step of [17, 250, near.P / 2, near.P, 3.3 * near.P, -1.7 * near.P]) {
      const off = { far: step * 0.3, mid: step * 0.55, near: step };
      const all = cloudsAt(p, off, true);
      expect(all.length).toBe(n);
      for (const L of p.puffs)
        for (const c of all.filter((k) => k.key.startsWith(`${L.id}:`))) {
          expect(c.x).toBeGreaterThanOrEqual(-L.M - 1e-6);
          expect(c.x).toBeLessThan(VW + L.M);
        }
    }
    // A whole period later the slot is a generation on: a new cloud.
    const later = cloudsAt(p, { far: 0, mid: 0, near: near.P }, true).find((c) => c.key.startsWith("near:0:"))!;
    expect(later.key).not.toBe(before.key);
  });

  it("builds puffs on a flat base: 5–14 circles, a hump, the layer's proportions, inside its band", () => {
    const p = plan("partly", 0.45, 9);
    for (const c of cloudsAt(p, NO_DRIFT, true)) {
      const s = c.shape;
      const spec = LAYER[s.layer as LayerId];
      expect(s.circles.length).toBeGreaterThanOrEqual(5);
      expect(s.circles.length).toBeLessThanOrEqual(14);
      expect(s.w / s.h).toBeGreaterThanOrEqual(spec.ratio[0] - 0.01);
      expect(s.w / s.h).toBeLessThanOrEqual(spec.ratio[1] * 1.6);
      // Flat: nothing under the base.
      expect(inside(c, c.x + s.w / 2, c.base + 1)).toBe(false);
      expect(inside(c, c.x + s.w / 2, c.base - 2)).toBe(true);
      // The biggest circles near the middle.
      const r = s.circles.map((k) => k.r);
      const mid = r[Math.floor(r.length / 2)]!;
      expect(mid).toBeGreaterThan(Math.min(r[0]!, r[r.length - 1]!));
      // The whole cloud in its layer's band (share of the sky height above the horizon).
      expect((SKY - c.base) / SKY).toBeGreaterThanOrEqual(spec.band[0] - 1e-6);
      expect((SKY - (c.base - s.h)) / SKY).toBeLessThanOrEqual(spec.band[1] + 1e-6);
    }
  });

  it("lays a deck as 4–6 bands of strips 28–70px thick, under the header, with a ragged underside in rain", () => {
    const o = plan("overcast", 0.97, 50);
    expect(o.puffs).toEqual([]);
    expect(Math.min(...o.rows.map((r) => r.y))).toBeGreaterThanOrEqual(48);
    for (const r of o.rows) {
      expect(r.h).toBeGreaterThanOrEqual(28 * 0.4);
      expect(r.h).toBeLessThanOrEqual(70);
      for (const s of r.strips) expect(s.w).toBeGreaterThanOrEqual(0.6 * VW - 1e-6);
    }
    const bands = new Set(o.rows.map((r) => r.layer + Math.round(r.y)));
    expect(bands.size).toBeGreaterThan(3);
    const rain = plan("heavy-rain", 1, 50);
    expect(rain.rows.at(-1)!.hang).toBeGreaterThan(0);
    expect(rain.rows.slice(0, -1).every((r) => r.hang === 0)).toBe(true);
  });

  it("stands a cumulonimbus in a gutter in thunder, flat-topped and taller than a near cloud", () => {
    const p = plan("thunder", 1, 60);
    const cb = p.cb!;
    expect(cb).toBeTruthy();
    const inGutter = (x: number) => x >= 0 && x <= 336 || x >= 1104 && x <= 1440;
    expect(inGutter(cb.x) && inGutter(cb.x + cb.shape.w)).toBe(true);
    const near = cloudsAt(plan("partly", 0.45, 60), NO_DRIFT, true).filter((c) => c.shape.layer === "near");
    const nearH = near.reduce((a, c) => a + c.shape.h, 0) / near.length;
    expect(cb.shape.h).toBeGreaterThan(1.3 * nearH);
    // Its anvil: a flat top.
    const top = cb.base - cb.shape.h + 1;
    expect(inside(cb, cb.x + cb.shape.boxes[0]!.x + cb.shape.boxes[0]!.w / 2, top)).toBe(true);
    // A phone has no gutter: it rises from behind the land.
    const phone = plan("thunder", 1, 60, 375, 652);
    expect(phone.cb!.base).toBeGreaterThan(652);
  });
});

describe("motion", () => {
  it("drifts the near layer at 0.8 px/s per km/h of the east–west wind, 4–40 px/s, east to the left", () => {
    expect(nearSpeed(15, 270)).toBeCloseTo(-12);
    expect(nearSpeed(15, 90)).toBeCloseTo(12);
    expect(nearSpeed(80, 270)).toBe(-40);
    expect(nearSpeed(2, 90)).toBe(4);
    // A wind along the view: the minimum speed, toward its small east–west part, or right when it has none.
    expect(nearSpeed(30, 0)).toBe(4);
    expect(nearSpeed(30, 180)).toBe(4);
    expect(nearSpeed(12, 10)).toBe(4);
    expect(nearSpeed(12, 350)).toBe(-4);
    expect(LAYER.mid.speed).toBe(0.55);
    expect(LAYER.far.speed).toBe(0.3);
  });

  it("swells the wind by ±20% at 0.07 Hz (Weather v6's gusts)", () => {
    const v = Array.from({ length: 2000 }, (_, i) => gust(i * 0.05));
    expect(Math.min(...v)).toBeCloseTo(0.8, 2);
    expect(Math.max(...v)).toBeCloseTo(1.2, 2);
    expect(gust(0)).toBe(1);
    expect(gust(1 / 0.07)).toBeCloseTo(1, 5);
  });

  it("breathes each circle ±4% over 20–40 s, and holds it in a still frame", () => {
    const c = cloudsAt(plan("partly", 0.45, 5), NO_DRIFT)[0]!.shape.circles[0]!;
    expect(c.per).toBeGreaterThanOrEqual(BREATH.period[0]);
    expect(c.per).toBeLessThanOrEqual(BREATH.period[1]);
    const r = Array.from({ length: 400 }, (_, i) => breathR(c, i * 0.25));
    expect(Math.max(...r) / c.r).toBeCloseTo(1.04, 2);
    expect(Math.min(...r) / c.r).toBeCloseTo(0.96, 2);
    expect(breathR(c, null)).toBe(c.r);
  });

  it("finds the signed distance to a silhouette: negative inside, the flat base cuts it", () => {
    const c = cloudsAt(plan("partly", 0.45, 5), NO_DRIFT)[0]!;
    expect(sdCloud(c, c.x + c.shape.w / 2, c.base - 4)).toBeLessThan(0);
    expect(sdCloud(c, c.x + c.shape.w / 2, c.base + 10)).toBeCloseTo(10, 0);
  });
});

describe("tones", () => {
  const hue = (lab: number[]) => (Math.atan2(lab[2]!, lab[1]!) * 180) / Math.PI;
  it("uses the day's tones by day, peach caps on violet bodies at golden hour", () => {
    const day = cloudTones(40, "partly");
    expect(oklabToRgb(day.body).map((v) => Math.round(v * 255))).toEqual([0xc7, 0xd1, 0xe4]);
    const g = cloudTones(2.5, "partly");
    expect(g.cap).toEqual(hexToLab(FLAT_CLOUD_GOLDEN.cap));
    // Peach (warm, orange-ish hue) against violet (a purple hue), and the cap clearly lighter.
    expect(hue(g.cap)).toBeGreaterThan(30);
    expect(hue(g.cap)).toBeLessThan(90);
    expect(hue(g.body)).toBeLessThan(-30);
    expect(g.cap[0] - g.body[0]).toBeGreaterThan(0.1);
  });

  it("lights night clouds only while the moon is up, with a moonlit rim by its illumination", () => {
    const dark = cloudTones(-20, "partly", { up: false, fraction: 0.9 });
    expect(dark.cap).toEqual(dark.body);
    expect(dark.rim).toBeNull();
    const lit = cloudTones(-20, "partly", { up: true, fraction: 0.9 });
    expect(lit.cap[0]).toBeGreaterThan(lit.body[0]);
    expect(lit.rim).not.toBeNull();
    expect(lit.rim![0]).toBeGreaterThan(lit.cap[0]);
    expect(lit.rim![0]).toBeLessThan(hexToLab(FLAT_CLOUD_RIM)[0]);
  });

  it("darkens a deck from overcast to thunder, and with the light", () => {
    const L = (c: Condition, e = 40) => cloudTones(e, c).body[0];
    expect(L("overcast")).toBeGreaterThan(L("drizzle"));
    expect(L("drizzle")).toBeGreaterThan(L("rain"));
    expect(L("rain")).toBeGreaterThan(L("thunder"));
    expect(L("overcast", -2)).toBeLessThan(L("overcast", 40));
    expect(L("overcast", -20)).toBeLessThan(L("overcast", -2));
  });

  it("lifts a cloud in a flash (+0.25 L), a thunder cloud's cap to the flash cap", () => {
    const t = cloudTones(30, "thunder");
    const f = flashTones(t, 0.25, true);
    expect(f.body[0]).toBeCloseTo(t.body[0] + 0.25);
    expect(f.cap[0]).toBeGreaterThan(t.cap[0] + 0.25);
    expect(f.base).toEqual(t.base);
  });
});
