import { describe, expect, it } from "vitest";
import {
  ANCHOR_AT,
  bandHeight,
  closingWalk,
  END_MARGIN,
  gutterCentre,
  gutterWidth,
  landMode,
  MIN_GAP_VH,
  nearestPlace,
  PARALLAX,
  PHONE_HILL_TOP,
  POSTCARD_MARK,
  sceneBand,
  scenePlace,
  screenX,
  solveAnchors,
  stageWalk,
} from "@/lib/sky/landscape/anchors";
import {
  cityGlowAlpha,
  CITY_GLOW_REACH,
  fireflyCount,
  LATE_SHARE,
  LIT_SHARE,
  moonRimAlpha,
  MOON_RIM_ALPHA,
  windowLit,
  windowSchedule,
} from "@/lib/sky/landscape/lights";
import { keaneBridge } from "@/lib/sky/landscape/shapes";
import {
  HAZE,
  layerColor,
  layerColorLit,
  sunLight,
  teaRowColor,
  teaRowNight,
} from "@/lib/sky/landscape/colors";
import { CITY_GLOW, LAND_TEA_ROWS, MOON_RIM } from "@/lib/sky/palette";
import { cityGlowOver, gradientAt, type CityGlow } from "@/lib/sky/backing";
import { hexToLab, luminance, mixLab, oklabToRgb } from "@/lib/sky/color";
import { skyColors } from "@/lib/sky/gradient";
import { CONDITIONS } from "@/lib/sky/weather";
import { buildClosingScene, buildStageScene, buildWorld, ridgeL1 } from "@/lib/sky/landscape/world";

// Section tops (document px) for a 1440×900 home page.
const SECTIONS = {
  stage: 0,
  shipped: 622,
  bench: 1010,
  receipts: 1460,
  closer: 2100,
  footer: 2480,
};
const VW = 1440;
const VH = 900;

describe("landmark anchors, centre mode (pages without a stage, < 1100px)", () => {
  const anchors = solveAnchors(SECTIONS, VW, VH);

  it("centres each landmark when its section's top reaches 40% (or earlier, keeping 0.6 vh between landmarks)", () => {
    expect(anchors.map((a) => a.id)).toEqual(["tea", "bridge", "city", "city2", "airport"]);
    for (const [i, a] of anchors.entries()) {
      const top = SECTIONS[a.section as keyof typeof SECTIONS];
      expect(a.s).toBeLessThanOrEqual(Math.max(0, top - ANCHOR_AT * VH) + 1e-9);
      if (i > 0 && a.s > 0) expect(a.s - anchors[i - 1]!.s).toBeGreaterThanOrEqual(0);
      if (i < anchors.length - 1 && a.s > 0)
        expect(anchors[i + 1]!.s - a.s).toBeGreaterThanOrEqual(MIN_GAP_VH * VH - 1e-9);
      expect(screenX(a.x, a.s, PARALLAX[a.layer])).toBeCloseTo(VW / 2, 9);
    }
  });

  it("names the place whose section is nearest its 40% line", () => {
    expect(nearestPlace(anchors, 0)).toBe("tea");
    expect(nearestPlace(anchors, 262)).toBe("bridge");
    expect(nearestPlace(anchors, 650)).toBe("city");
    expect(nearestPlace(anchors, 1100)).toBe("city");
    expect(nearestPlace(anchors, 1740)).toBe("airport");
    expect(nearestPlace(anchors, 2200)).toBe("airport");
    expect(nearestPlace([], 0)).toBeNull();
  });

  it("keeps the sky still and the near layer fastest (real parallax)", () => {
    expect(PARALLAX.L1).toBeLessThan(PARALLAX.L2);
    expect(PARALLAX.L2).toBeLessThan(PARALLAX.L3);
    expect(PARALLAX.L3).toBeLessThan(PARALLAX.L4);
    expect(screenX(500, 1000, 0)).toBe(500);
  });
});

describe("landmark anchors, gutter mode (≥ 1100px)", () => {
  const anchors = solveAnchors(SECTIONS, VW, VH, Infinity, "gutter");
  const g = gutterWidth(VW);

  it("picks the mode from the width and the stage", () => {
    expect(landMode(1440, true)).toBe("gutter");
    expect(landMode(1100, true)).toBe("gutter");
    expect(landMode(1099, true)).toBe("scene");
    expect(landMode(375, true)).toBe("scene");
    expect(landMode(375, false)).toBe("centre");
  });

  it("solves each landmark onto its gutter centre when its section's top is at 40%, alternating sides", () => {
    expect(g).toBe(336);
    const sides = Object.fromEntries(anchors.map((a) => [a.id, a.side]));
    expect(sides).toEqual({
      tea: "left",
      bridge: "right",
      city: "left",
      city2: "left",
      airport: "right",
    });
    for (const a of anchors) {
      const want = a.side === "left" ? g / 2 : VW - g / 2;
      expect(gutterCentre(VW, a.side)).toBe(want);
      expect(screenX(a.x, a.s, PARALLAX[a.layer])).toBeCloseTo(want, 9);
      // The centre is outside the 768px column.
      expect(Math.abs(want - VW / 2)).toBeGreaterThan(384);
    }
  });

  it("keeps landmarks out from behind the cards: each fits 90% of its gutter at its anchor (the bridge may run under)", () => {
    for (const vw of [1100, 1440, 1920]) {
      const an = solveAnchors(SECTIONS, vw, VH, Infinity, "gutter");
      const w = buildWorld(an, vw, VH, 3200, 162, "gutter");
      const gw = gutterWidth(vw);
      for (const m of w.marks) {
        const a = an.find((x) => (m.id === "clock" ? x.id === "bridge" : x.id === m.id))!;
        // Screen extent at the anchor's scroll.
        const x0 = m.x0 * w.s - a.s * PARALLAX.L3;
        const x1 = m.x1 * w.s - a.s * PARALLAX.L3;
        if (m.id === "bridge") {
          // It reaches into the gutter from under the column, ending at the clock tower.
          expect(x1).toBeGreaterThan(vw - gw);
          continue;
        }
        expect(x1 - x0, `${m.id} at ${vw}`).toBeLessThanOrEqual(0.9 * gw + 0.5);
        const inLeft = x0 >= -0.5 && x1 <= gw + 0.5;
        const inRight = x0 >= vw - gw - 0.5 && x1 <= vw + 0.5;
        expect(inLeft || inRight, `${m.id} at ${vw}: ${x0.toFixed(0)}–${x1.toFixed(0)}`).toBe(true);
      }
      expect(w.plane).not.toBeNull();
      expect(w.planeK).toBeLessThanOrEqual(1);
    }
  });

  it("builds a world whose landmarks don't overlap and are long enough for the page", () => {
    const w = buildWorld(anchors, VW, VH, 3200, 162, "gutter");
    const marks = [...w.marks].sort((a, b) => a.x0 - b.x0);
    for (let i = 1; i < marks.length; i++)
      expect(marks[i]!.x0).toBeGreaterThanOrEqual(marks[i - 1]!.x1 - 0.01);
    expect(w.length.L4 * w.s).toBeGreaterThanOrEqual(VW + (3200 - VH) * PARALLAX.L4);
    expect(w.lights.L3.filter((l) => l.kind === "window").length).toBeGreaterThan(20);
  });
});

describe("B1: every landmark is reachable, once", () => {
  it("for page heights of 1.5–6 viewports, reaches each landmark inside the scroll range, the airport at the bottom", () => {
    for (const [vw, vh] of [
      [1440, 900],
      [1920, 1080],
      [1100, 800],
    ] as const) {
      for (let pages = 1.5; pages <= 6; pages += 0.25) {
        const docH = pages * vh;
        const max = docH - vh;
        // Sections spread like the home page's: a stage, then Shipped … the closer near the end.
        const f = (k: number) => Math.round(docH * k);
        const sections = {
          stage: 0,
          shipped: f(0.2),
          bench: f(0.34),
          receipts: f(0.5),
          closer: f(0.78),
          footer: f(0.92),
        };
        const an = solveAnchors(sections, vw, vh, max, "gutter");
        for (const a of an) {
          expect(a.s, `${a.id} ${pages}`).toBeGreaterThanOrEqual(0);
          expect(a.s, `${a.id} ${pages}`).toBeLessThanOrEqual(max - END_MARGIN + 1e-9);
          // Reached: at its scroll it stands on its gutter centre.
          expect(screenX(a.x, a.s, PARALLAX[a.layer])).toBeCloseTo(gutterCentre(vw, a.side), 6);
        }
        expect(an.at(-1)!.id).toBe("airport");
        expect(an.at(-1)!.s).toBeCloseTo(max - END_MARGIN, 9);
        for (let i = 1; i < an.length; i++)
          if (an[i - 1]!.s > 0)
            expect(an[i]!.s - an[i - 1]!.s).toBeGreaterThanOrEqual(MIN_GAP_VH * vh - 1e-6);
        const w = buildWorld(an, vw, vh, docH, bandHeight(vw, vh), "gutter");
        const ids = w.marks.map((m) => m.id).sort();
        expect(ids, `${vw} ${pages}`).toEqual(["airport", "bridge", "city", "city2", "clock"]);
        // The airport's world position is where the solver put it (never nudged off its target).
        const port = w.marks.find((m) => m.id === "airport")!;
        const at = an.find((a) => a.id === "airport")!;
        expect(((port.x0 + port.x1) / 2) * w.s - at.s * PARALLAX.L3).toBeCloseTo(
          gutterCentre(vw, "right"),
          0,
        );
      }
    }
  });
});

describe("scene mode (< 1100px with a stage)", () => {
  it("walks the stage scene as the stage scrolls away, and the closing scene as it crosses the viewport", () => {
    expect(stageWalk(0, 650, 375)).toBe(0);
    expect(stageWalk(325, 650, 375)).toBeCloseTo(187.5, 9);
    expect(stageWalk(2000, 650, 375)).toBe(375);
    // Centred in the viewport: no walk; entering and leaving: ±0.15 vw.
    expect(closingWalk((812 - 200) / 2, 200, 812, 375)).toBeCloseTo(0, 9);
    expect(closingWalk(812, 200, 812, 375)).toBeCloseTo(-0.15 * 375, 9);
    expect(closingWalk(-200, 200, 812, 375)).toBeCloseTo(0.15 * 375, 9);
  });

  it("on a tablet puts the tea gardens, Keane Bridge and the clock tower on the stage's horizon, the airport in the closing band", () => {
    const stage = buildStageScene(768, 140);
    expect(stage.marks.map((m) => m.id).sort()).toEqual(["bridge", "clock"]);
    const bridge = stage.marks.find((m) => m.id === "bridge")!;
    // On screen at the top of the page.
    expect(bridge.x0 * stage.s).toBeGreaterThan(0);
    expect(bridge.x1 * stage.s).toBeLessThan(768 + 40);
    expect(stage.layers.L2.length).toBeGreaterThan(3); // shade trees over the tea mounds
    // The near foreground keeps its palms (the only things standing on the bank line itself, y = 0).
    expect(stage.layers.L4.some((it) => it.y === 0)).toBe(true);
    const closing = buildClosingScene(768, 200);
    expect(closing.marks.map((m) => m.id)).toEqual(["airport"]);
    for (const m of closing.marks) {
      expect(m.x0 * closing.s).toBeGreaterThanOrEqual(-1);
      expect(m.x1 * closing.s).toBeLessThanOrEqual(769);
    }
    expect(closing.plane).not.toBeNull();
    expect(closing.plane![0] * closing.s).toBeGreaterThan(0);
    expect(closing.plane![0] * closing.s).toBeLessThan(768);
  });

  it("on a phone (the postcard stage) shows only the tea gardens and Keane Bridge: centred, 1.6× its old size, nothing else", () => {
    const H = sceneBand(375, 812);
    expect(H).toBe(200);
    const stage = buildStageScene(375, H);
    expect(stage.marks.map((m) => m.id)).toEqual(["bridge"]);
    const [b] = stage.marks;
    expect(((b!.x0 + b!.x1) / 2) * stage.s).toBeCloseTo(375 / 2, 6);
    // The old 150px band drew its 192 units (five spans and both approach ramps) at 1.5 px/unit = 288px wide.
    expect((b!.x1 - b!.x0) * stage.s).toBeCloseTo(POSTCARD_MARK * 192 * 1.5, 6);
    expect(stage.layers.L2.length).toBeGreaterThan(3); // shade trees over the tea mounds
    // No clock tower on L3; no palms (y = 0) and no rickshaw (y ≈ 90) on the near layer.
    expect(stage.layers.L3.some((it) => it.shape.x1 - it.shape.x0 === 14)).toBe(false);
    expect(stage.layers.L4.filter((it) => it.y === 0)).toHaveLength(0);
    expect(stage.layers.L4.filter((it) => it.y > 80)).toHaveLength(0);
    // A short phone keeps the proportions (the scale follows the band height).
    expect(buildStageScene(320, H).marks[0]!.x1 - buildStageScene(320, H).marks[0]!.x0).toBeCloseTo(
      b!.x1 - b!.x0,
      9,
    );
  });

  it("PHONE_HILL_TOP is the far hills' highest point over a phone's width in the 200px scene", () => {
    const s = 200 / 100;
    let top = Infinity;
    for (let x = 0; x <= 375 / s; x += 0.05) top = Math.min(top, ridgeL1(x));
    expect(Math.abs(PHONE_HILL_TOP - top)).toBeLessThan(0.1);
  });

  it("names the stage scene's landmark nearest the centre", () => {
    expect(scenePlace(0, 650, 375)).toBe("bridge");
    expect(["tea", "bridge"]).toContain(scenePlace(650, 650, 375));
  });
});

describe("window lights", () => {
  it("are deterministic for a date seed and differ between dates", () => {
    const a = Array.from({ length: 200 }, (_, i) => windowSchedule(i, 349));
    const b = Array.from({ length: 200 }, (_, i) => windowSchedule(i, 349));
    const c = Array.from({ length: 200 }, (_, i) => windowSchedule(i, 350));
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it("light 45% of windows before 22:00, 10% by 01:00, and wake between 05:00 and 06:30", () => {
    const n = 6000;
    const s = Array.from({ length: n }, (_, i) => windowSchedule(i, 120));
    const share = (min: number) =>
      Array.from({ length: n }, (_, i) => windowLit(i, min, 120)).filter(Boolean).length / n;
    expect(Math.abs(share(20 * 60 + 30) - LIT_SHARE)).toBeLessThan(0.025);
    expect(share(23 * 60 + 30)).toBeLessThan(share(20 * 60 + 30)); // the city goes to sleep
    expect(Math.abs(share(60) - LATE_SHARE)).toBeLessThan(0.02);
    expect(Math.abs(share(3 * 60) - LATE_SHARE)).toBeLessThan(0.02);
    expect(Math.abs(share(7 * 60) - LIT_SHARE)).toBeLessThan(0.025); // and wakes by 06:30
    for (const w of s) {
      expect(w.on).toBeGreaterThanOrEqual(5 * 60);
      expect(w.on).toBeLessThanOrEqual(6.5 * 60);
    }
    // A few lit windows are TVs.
    const tv = s.filter((w) => w.lit && w.tv).length / s.filter((w) => w.lit).length;
    expect(tv).toBeGreaterThan(0.06);
    expect(tv).toBeLessThan(0.2);
  });
});

describe("the night landscape", () => {
  it("lights Keane Bridge with 14 warm deck lights", () => {
    expect(keaneBridge().lights!.filter((l) => l.kind === "deck")).toHaveLength(14);
  });

  it("glows over the city from sunset: 0.16, more under low cloud, dimmer after 01:00", () => {
    expect(cityGlowAlpha(20 * 60, 0, 1)).toBeCloseTo(0.16, 9);
    expect(cityGlowAlpha(20 * 60, 1, 1)).toBeCloseTo(0.16 * 1.8, 9);
    expect(cityGlowAlpha(60, 0, 1)).toBeCloseTo(0.16 * 0.6, 9);
    expect(cityGlowAlpha(3 * 60, 0, 1)).toBeCloseTo(0.16 * 0.6, 9);
    expect(cityGlowAlpha(23 * 60 + 30, 0, 1)).toBeLessThan(0.16);
    expect(cityGlowAlpha(23 * 60 + 30, 0, 1)).toBeGreaterThan(0.096);
    expect(cityGlowAlpha(12 * 60, 0, 0)).toBe(0); // by day
  });

  it("shows the tea rows as their own green by day and as the hill 3% lighter at night: texture, never glowing lines (T4)", () => {
    const horizon = skyColors(10, "evening", "clear").horizon;
    const light = (e: number) => ({ horizon, k: sunLight(e) });
    const hill = (e: number) => layerColorLit(light(e), "L2");
    const chroma = (c: [number, number, number]) => Math.hypot(c[1], c[2]);
    // Night (at −6° and below): the hill's own chroma, exactly, and no more than 3% lighter.
    expect(teaRowNight(light(-30))).toBe(1);
    const night = teaRowColor(light(-30));
    expect(night[0]).toBeCloseTo(hill(-30)[0] + 0.03, 9);
    expect(night.slice(1)).toEqual(hill(-30).slice(1));
    // By day: the tea green's own chroma, hazed like the hills, 6% lighter than the hill (as before T4).
    expect(teaRowNight(light(30))).toBe(0);
    const day = teaRowColor(light(30));
    expect(day[0]).toBeCloseTo(hill(30)[0] + 0.06, 9);
    const teaGreen = mixLab(hexToLab(LAND_TEA_ROWS), horizon, HAZE.L2);
    expect(day.slice(1)).toEqual([teaGreen[1], teaGreen[2]]);
    // Dusk is between the two.
    const dusk = teaRowColor(light(-3));
    expect(0 < teaRowNight(light(-3)) && teaRowNight(light(-3)) < 1).toBe(true);
    expect(dusk[0]).toBeGreaterThan(hill(-3)[0] + 0.03);
    expect(dusk[0]).toBeLessThan(hill(-3)[0] + 0.06);
    expect(chroma(night)).toBeLessThan(chroma(day));
  });

  it("rims the top of the hills and the bridge with moonlight only while the moon is up: 0.3 × illumination in #C9D4E8 (T4)", () => {
    expect(MOON_RIM).toBe("#C9D4E8");
    expect(moonRimAlpha(true, 1, 1, 0)).toBeCloseTo(MOON_RIM_ALPHA, 9);
    expect(moonRimAlpha(true, 0.5, 1, 0)).toBeCloseTo(0.15, 9);
    expect(moonRimAlpha(false, 1, 1, 0)).toBe(0); // below the horizon
    expect(moonRimAlpha(true, 1, 0, 0)).toBe(0); // daylight
    expect(moonRimAlpha(true, 1, 1, 1)).toBe(0); // hidden by cloud
  });

  it("keeps the city glow at #E8A15A, 0.16 at the horizon, fading to 0 at 14% of the viewport height", () => {
    expect(CITY_GLOW).toBe("#E8A15A");
    expect(cityGlowAlpha(21 * 60, 0, 1)).toBeCloseTo(0.16, 9);
    expect(CITY_GLOW_REACH).toBe(0.14);
  });

  it("keeps every silhouette darker than the sky behind it at night, city glow included", () => {
    const fails: string[] = [];
    // 1440×900: the band (162px) starts at 738; ridge tops of each layer (band units); the glow's horizon at 50.
    const vh = 900;
    const top = 738;
    const s = 1.62;
    const tops: Record<string, number> = { L1: 20, L2: 48, L3: 30, L4: 40 };
    for (let e = -30; e <= -1; e++)
      for (const c of CONDITIONS)
        for (const phase of ["morning", "evening"] as const)
          for (const cover of [0, 1])
            for (const mins of [21 * 60, 2 * 60]) {
              const colors = skyColors(e, phase, c);
              const glow: CityGlow = {
                horizonY: top + 50 * s,
                reach: CITY_GLOW_REACH * vh,
                alpha: cityGlowAlpha(mins, cover, 1),
              };
              for (const layer of ["L1", "L2", "L3", "L4"] as const) {
                const sil = luminance(oklabToRgb(layerColor(colors.horizon, layer, sunLight(e))));
                for (let u = tops[layer]!; u <= 70; u += 5) {
                  const y = top + u * s;
                  const sky = cityGlowOver(oklabToRgb(gradientAt({ colors }, y / vh)), glow, y);
                  if (sil >= luminance(sky))
                    fails.push(
                      `${e}° ${c} ${phase} cover ${cover} ${layer} u=${u}: ${sil.toFixed(4)} ≥ ${luminance(sky).toFixed(4)}`,
                    );
                }
              }
            }
    expect(fails.slice(0, 10)).toEqual([]);
  });
});

describe("fireflies", () => {
  it("count by month, none in the wet", () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => fireflyCount(m, false))).toEqual([
      4, 4, 4, 10, 10, 18, 18, 18, 10, 10, 4, 4,
    ]);
    expect(fireflyCount(7, true)).toBe(0);
  });
});
