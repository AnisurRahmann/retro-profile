/**
 * The backing model (src/lib/sky/backing.ts): for every sun elevation, condition, half of the day and height, the
 * backing it picks keeps loose text readable over the brightest sky the renderer can put behind it. The pixel
 * test (tests/e2e/sky-backing.spec.ts) is the gate against what the browser paints; this sweep is the model's own
 * guarantee and the gate for any palette retune.
 */
import { describe, expect, it } from "vitest";
import type { Phase } from "@/lib/sky/astro";
import { skyColors, smoothstep, sunColor } from "@/lib/sky/gradient";
import { fogAmount } from "@/lib/sky/model";
import { contrast, over, rgbToHex } from "@/lib/sky/color";
import {
  aaMix,
  backgroundFor,
  CHIP_ALPHA,
  CHIP_TARGET,
  SMALL_PX,
  CHIP_MAX,
  decide,
  GRAPHITE,
  haloFor,
  haloInk,
  INK,
  ON_SKY,
  parseCssColor,
  sizeBucket,
  skyAt,
  TEXT,
  type Scene,
} from "@/lib/sky/backing";
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

function model(e: number, phase: Phase, c: Condition, moon?: { fraction: number; altitudeDeg: number }) {
  // Worst-case haze: saturated humidity and 1 km visibility unless it's fog (which is 1 anyway).
  const fog = fogAmount({ condition: c, humidity: 100, visibilityM: 1000 });
  return {
    colors: skyColors(e, phase, c),
    glow: smoothstep(-8, -2, e) * (1 - smoothstep(4, 10, e)),
    cloudCover: COVER[c],
    fog,
    astro: { elevation: e, ...(moon ? { moon } : {}) } as never,
  };
}

/** Contrast of the text as rendered (anti-aliased toward the background at DPR 1) over its backing. */
const effective = (
  bg: [number, number, number],
  text: [number, number, number],
  d: ReturnType<typeof decide>,
  px: number,
  dpr = 2,
) => {
  const b = over(
    bg,
    INK,
    d.mode === "none" ? 0 : d.mode === "halo" ? haloInk(d.a, sizeBucket(px)) : d.a,
  );
  return contrast(over(text, b, aaMix(px, dpr)), b);
};

describe("per-element backing", () => {
  it("keeps --text ≥ 7 (≥ CHIP_TARGET on a chip or ≤ 12px), --on-sky and --graphite ≥ 4.5 at every elevation, condition, phase and height", () => {
    const tones = [
      { name: "text", rgb: TEXT, min: 7 },
      { name: "on-sky", rgb: ON_SKY, min: 4.5 },
      { name: "graphite", rgb: GRAPHITE, min: 4.5 },
    ];
    const fails: string[] = [];
    const count = { none: 0, halo: 0, chip: 0 };
    let worst = { c: Infinity, where: "" };
    for (let e = -30; e <= 90; e += 1) {
      for (const c of CONDITIONS) {
        for (const phase of ["morning", "evening"] as const) {
          const m = model(e, phase, c);
          for (let i = 0; i <= 32; i++) {
            const y = i / 32;
            const bg = skyAt(m, y);
            for (const t of tones)
              for (const [px, dpr] of [
                [12, 1],
                [12, 2],
                [16, 1],
                [36, 1],
              ] as const) {
                const d = decide(bg, t.rgb, px, dpr);
                count[d.mode]++;
                const k = effective(bg, t.rgb, d, px, dpr);
                const where = `${e}° ${c} ${phase} y=${y.toFixed(2)} ${t.name} ${px}px@${dpr} ${d.mode} ${d.a}`;
                if (k < worst.c) worst = { c: k, where };
                if (
                  k < (d.mode === "chip" || px <= SMALL_PX ? Math.min(t.min, CHIP_TARGET) : t.min)
                )
                  fails.push(`${where}: ${k.toFixed(2)} over ${rgbToHex(bg)}`);
              }
          }
        }
      }
    }
    console.info(
      `[backing] worst ${worst.c.toFixed(2)}:1 at ${worst.where}; modes ${JSON.stringify(count)}`,
    );
    expect(fails.slice(0, 20)).toEqual([]);
    // 14 s on the base branch; v6's brighter cloud tops solve twice as many chips (about 20 s).
  }, 60_000);

  it("keeps text readable with the sun's disc or bloom and the moon behind it", () => {
    const fails: string[] = [];
    for (let e = -1; e <= 60; e += 3) {
      for (const c of ["clear", "partly", "fog"] as const) {
        const s: Scene = {
          m: model(e, "evening", c),
          vw: 1440,
          vh: 900,
          sun: { x: 700, y: 500, r: 16, alt: e, tau: 0, deck: false, fog: 0 },
          moon: { x: 300, y: 300, r: 14, visible: 1, glow: 1 },
          glows: [],
        };
        // Boxes on the sun, in its 3× bloom, its 8× bloom, and on the moon.
        for (const [x0, y0] of [
          [690, 490],
          [730, 500],
          [800, 500],
          [295, 295],
        ] as const) {
          const box = { x0, y0, x1: x0 + 80, y1: y0 + 16 };
          const bg = backgroundFor(s, box);
          for (const t of [TEXT, GRAPHITE]) {
            const d = decide(bg, t, 12, 1);
            const k = effective(bg, t, d, 12, 1);
            if (k < 4.5)
              fails.push(`${e}° ${c} box ${x0},${y0}: ${k.toFixed(2)} (${d.mode} ${d.a})`);
          }
        }
      }
    }
    expect(fails).toEqual([]);
  });

  it("picks none on a cloudless night, a halo for a small deficit, and a chip for graphite low over dusk", () => {
    expect(decide(skyAt(model(-30, "evening", "clear"), 0.5, 0), GRAPHITE, 14).mode).toBe("none");
    // Weather v6: a moonlit cloud is brighter than the night sky (measured rgb(55,63,78) under a 93% moon), so
    // graphite over one needs backing. Before v6 night clouds were darker than the sky and this was "none". With the
    // moon down a cloud is darker still, and takes none.
    const moonUp = model(-30, "evening", "clear", { fraction: 0.93, altitudeDeg: 40 });
    expect(decide(skyAt(moonUp, 0.5, 0.5), GRAPHITE, 14).mode).toBe("chip");
    expect(decide(skyAt(model(-30, "evening", "clear"), 0.5, 0.5), GRAPHITE, 14).mode).toBe("none");
    // A grey just too light for --graphite at 4.8:1: the halo covers it.
    let t = 0;
    while (contrast(GRAPHITE, over(INK, [1, 1, 1], t + 0.001)) >= 4.79) t += 0.001;
    const small = decide(over(INK, [1, 1, 1], t + 0.004), GRAPHITE, 14);
    expect(small.mode).toBe("halo");
    const dusk = decide(skyAt(model(2, "evening", "clear"), 0.95), GRAPHITE, 14);
    expect(dusk.mode).toBe("chip");
    expect(dusk.a).toBeGreaterThanOrEqual(CHIP_ALPHA);
    expect(dusk.a).toBeLessThanOrEqual(CHIP_MAX);
  });

  it("solves the smallest halo on the calibrated curve", () => {
    for (const b of [1, 2, 3]) {
      expect(haloFor(0, b)).toBe(0);
      const need = haloInk(0.6, b);
      const a = haloFor(need, b)!;
      expect(haloInk(a, b)).toBeGreaterThanOrEqual(need);
      expect(haloInk(a - 0.05, b)).toBeLessThan(need);
      expect(haloFor(haloInk(1, b) + 0.01, b)).toBeNull();
    }
  });

  it("reads computed colours in both forms Chrome returns", () => {
    expect(parseCssColor("rgb(230, 234, 242)")).toEqual([230 / 255, 234 / 255, 242 / 255]);
    expect(parseCssColor("color(srgb 0.9 0.91 0.94)")).toEqual([0.9, 0.91, 0.94]);
    expect(parseCssColor("oklch(0.5 0.1 200)")).toBeNull();
  });

  it("counts the sun's colour from its altitude", () => {
    const s: Scene = {
      m: model(5, "evening", "clear"),
      vw: 1440,
      vh: 900,
      sun: { x: 100, y: 100, r: 16, alt: 5, tau: 0, deck: false, fog: 0 },
      moon: null,
      glows: [],
    };
    const on = backgroundFor(s, { x0: 95, y0: 95, x1: 105, y1: 105 });
    expect(contrast(on, sunColor(5))).toBeLessThan(1.1);
  });
});
