import { describe, expect, it, vi } from "vitest";
import * as bodies from "@/components/sky/bodies";
import { createParticles, mulberry32, skyRotation } from "@/components/sky/particles";
import { bearingToX, fogAmount, skyModel, windVector } from "@/lib/sky/model";
import { dhakaDate } from "@/lib/sky/time";
import { UNKNOWN_WEATHER } from "@/lib/sky/weather";

// Lightning is src/lib/sky/lightning.ts now (Weather v6): tests/unit/sky-lightning.test.ts.

describe("wind", () => {
  it("drifts 0.6 px/s per km/h, away from where it blows from; east is screen-left", () => {
    const [x, y] = windVector(10, 90); // from the east → toward the west → rightwards
    expect(x).toBeCloseTo(6, 5);
    expect(y).toBeCloseTo(0, 5);
    const [nx, ny] = windVector(10, 0); // from the north → toward the south (the horizon) → down, scaled ×0.25
    expect(nx).toBeCloseTo(0, 5);
    expect(ny).toBeCloseTo(1.5, 5);
    const [ex] = windVector(15, 45); // NE wind → toward SW → right
    expect(ex).toBeGreaterThan(0);
  });
});

describe("screen mapping", () => {
  it("puts east at the left and west at the right", () => {
    expect(bearingToX(90)).toBe(0);
    expect(bearingToX(180)).toBe(0.5);
    expect(bearingToX(270)).toBe(1);
  });
  it("puts the December dusk glow bottom-right and the dawn glow bottom-left", () => {
    const dusk = skyModel(dhakaDate(2026, 12, 15, 16 * 60 + 55), UNKNOWN_WEATHER);
    const dawn = skyModel(dhakaDate(2026, 12, 15, 6 * 60 + 25), UNKNOWN_WEATHER);
    expect(dusk.sunX).toBeGreaterThan(0.75);
    expect(dawn.sunX).toBeLessThan(0.25);
    expect(dusk.glow).toBeGreaterThan(0.5);
    expect(skyModel(dhakaDate(2026, 12, 15, 11 * 60), UNKNOWN_WEATHER).glow).toBe(0);
  });
});

describe("fog", () => {
  it("is full in fog and humidity/visibility-driven haze otherwise", () => {
    expect(fogAmount({ condition: "fog", humidity: 50, visibilityM: 20_000 })).toBe(1);
    expect(fogAmount({ condition: "clear", humidity: 70 })).toBe(0);
    expect(fogAmount({ condition: "clear", humidity: 100 })).toBeCloseTo(0.35, 5);
    expect(fogAmount({ condition: "partly", humidity: 90, visibilityM: 2500 })).toBeCloseTo(0.175 + 0.2, 5);
  });
});

describe("stars", () => {
  it("rotate at the sidereal rate, from real time", () => {
    const perHour = skyRotation(3.6e6) - skyRotation(0);
    expect((perHour * 180) / Math.PI).toBeCloseTo(15.041, 3);
  });
  it("seed deterministically", () => {
    const a = mulberry32(349);
    const b = mulberry32(349);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
    expect(mulberry32(350)()).not.toBe(mulberry32(349)());
  });
});

describe("the moon", () => {
  it("is a disc with its soft glow only: no ring is stroked around it, and no halo function exists", () => {
    // A recording 2D context: every call is kept, every property write is accepted.
    const calls: string[] = [];
    const ctx = new Proxy<Record<string, unknown>>({}, {
      get: (_, k: string) => () => {
        calls.push(k);
      },
      set: () => true,
    });
    const canvas = { getContext: () => ctx, clientWidth: 375, clientHeight: 812, width: 0, height: 0 };
    vi.stubGlobal("window", { devicePixelRatio: 2 });
    let stars = 0;
    let decked = 0;
    try {
      const pts = createParticles(canvas as unknown as HTMLCanvasElement, [0.9, 0.92, 0.95])!;
      pts.resize(330);
      // A clear night with a full moon high in the sky, no rain, no meteors: stars and the moon are filled.
      pts.draw(
        1,
        Date.UTC(2026, 10, 25, 21, 30),
        {
          night: 1,
          cloudCover: 0.04,
          deck: 0,
          fog: 0,
          rainDensity: 0,
          rainSlant: 0,
          flash: 0,
          moon: { x: 0.76, y: 0.31, up: true, fraction: 1, waxing: true },
          moonVisible: 1,
          moonR: 12,
          moonDim: 1,
        },
        true,
        {},
        null,
      );
      // Under a stratus deck no star is drawn: only the moon's fills are left (a small star is a fillRect).
      const fills = (deck: number) => {
        const from = calls.length;
        pts.draw(
          1,
          Date.UTC(2026, 10, 25, 21, 30),
          {
            night: 1,
            cloudCover: 0.97,
            deck,
            fog: 0,
            rainDensity: 0,
            rainSlant: 0,
            flash: 0,
            moon: { x: 0.76, y: 0.31, up: true, fraction: 1, waxing: true },
            moonVisible: 1,
            moonR: 12,
            moonDim: 1,
          },
          true,
          {},
          null,
        );
        return calls.slice(from).filter((c) => c === "fill" || c === "fillRect").length;
      };
      stars = fills(0);
      decked = fills(1);
    } finally {
      vi.unstubAllGlobals();
    }
    expect(calls).toContain("fill");
    expect(stars).toBeGreaterThan(50);
    expect(decked).toBeLessThan(stars / 10);
    // A 22° halo was two stroked circles around the disc. Nothing strokes here.
    expect(calls).not.toContain("stroke");
    expect("drawHalo" in bodies).toBe(false);
  });
});
