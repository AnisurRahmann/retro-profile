import { describe, expect, it } from "vitest";
import { oklabToRgb, rgbToOklab, type RGB } from "@/lib/sky/color";
import { skyColors } from "@/lib/sky/gradient";
import {
  awayY,
  createHorizonTracker,
  GROUND_FADE,
  gradientRgb,
  horizonTarget,
  SKY_MID_AT,
  skyParam,
  springStep,
  type SceneLine,
} from "@/lib/sky/horizon";
import { SCENE_HORIZON } from "@/lib/sky/arc";

const dE = (p: RGB, q: RGB) => {
  const a = rgbToOklab(p);
  const b = rgbToOklab(q);
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
};

// A phone page in scene mode: a 150px stage scene at the bottom of a 617px stage, a 200px closing scene near the end.
const VH = 812;
const STAGE = { top: 617 - 150, h: 150 };
const CLOSING = { top: 4200, h: 200 };
const DOC = CLOSING.top + CLOSING.h + 48 + 120;
const scenesAt = (scroll: number): SceneLine[] =>
  [
    ["stage", STAGE],
    ["closing", CLOSING],
  ].map(([id, s]) => {
    const { top, h } = s as typeof STAGE;
    return { id: id as string, ground: top - scroll + SCENE_HORIZON * h, bottom: top - scroll + h };
  });

const STATES = [
  [-20, "morning"],
  [-8, "morning"],
  [-2, "morning"],
  [2, "evening"],
  [6, "evening"],
  [12, "evening"],
  [40, "evening"],
  [-4, "evening"],
] as const;

describe("skyParam", () => {
  it("runs zenith → mid → horizon down to the horizon line, and is the away sky under a scene", () => {
    const a = awayY(VH);
    const hz = { h: 400, b: 538 };
    expect(skyParam(0, hz, a)).toBe(0);
    expect(skyParam(220, hz, a)).toBeCloseTo(SKY_MID_AT, 5);
    expect(skyParam(400, hz, a)).toBe(1);
    expect(skyParam(538, hz, a)).toBeCloseTo(538 / a, 5);
    expect(skyParam(700, hz, a)).toBeCloseTo(700 / a, 5);
  });
  it("away: the bottom of the screen is the mid sky, not the horizon", () => {
    const a = awayY(VH);
    const p = skyParam(VH, { h: a, b: a }, a);
    expect(p).toBeLessThan(0.7);
  });
});

describe("horizonTarget", () => {
  it("follows the stage's ground at the top, is away mid-cards, follows the closing scene at the end", () => {
    expect(horizonTarget(scenesAt(0), VH)).toMatchObject({ id: "stage", h: STAGE.top + 60 });
    expect(horizonTarget(scenesAt(2000), VH)).toMatchObject({ id: "", h: awayY(VH) });
    expect(horizonTarget(scenesAt(DOC - VH), VH).id).toBe("closing");
  });
});

describe("scene mode: no horizon colour beneath a scene, and no jumps", () => {
  for (const [elev, phase] of STATES) {
    it(`${elev}° ${phase}`, () => {
      const c = skyColors(elev, phase, "clear");
      const H = oklabToRgb(c.horizon);
      const M = oklabToRgb(c.mid);
      const a = awayY(VH);
      const tracker = createHorizonTracker();
      let prev: RGB[] | null = null;
      // Scroll the whole page at 4px a frame (240 px/s), tracker stepping at 60 fps.
      for (let scroll = 0; scroll <= DOC - VH; scroll += 4) {
        const lines = scenesAt(scroll);
        const hz = tracker.step(horizonTarget(lines, VH), 1 / 60);
        for (const s of lines) {
          // Under the ground fade, and 2px below the scene's bottom (the end of the fade).
          for (const y of [s.bottom + 1, s.bottom + GROUND_FADE / 2, s.bottom + GROUND_FADE + 2]) {
            if (y < 0 || y >= VH) continue;
            const col = gradientRgb(c, y, hz, a);
            expect(skyParam(y, hz, a)).toBeLessThanOrEqual(0.7);
            if (dE(H, M) > 0.02) expect(dE(col, H)).toBeGreaterThan(dE(col, M));
          }
        }
        // Rows of open sky (not behind a scene band) never jump between frames.
        const rows: RGB[] = [];
        for (let y = 0; y < VH; y += 16) rows.push(gradientRgb(c, y, hz, a));
        if (prev) {
          for (let i = 0; i < rows.length; i++) {
            const y = i * 16;
            const behind = lines.some((s) => y >= s.ground - 70 && y <= s.bottom + GROUND_FADE);
            if (!behind) expect(dE(rows[i]!, prev[i]!)).toBeLessThan(0.03);
          }
        }
        prev = rows;
      }
    });
  }
});

describe("springStep", () => {
  it("is critically damped: no overshoot, settled in ~0.6 s at ω = 8", () => {
    let x = 400;
    let v = 0;
    let t = 0;
    while (t < 0.6) {
      [x, v] = springStep(x, v, 1 / 60);
      t += 1 / 60;
      expect(x).toBeGreaterThanOrEqual(0);
    }
    expect(x).toBeLessThan(400 * 0.05);
  });
  it("is exact for any dt (a dropped frame lands where two small steps would)", () => {
    const [a] = springStep(100, 0, 0.1);
    const [b, vb] = springStep(100, 0, 0.05);
    const [c] = springStep(b, vb, 0.05);
    expect(a).toBeCloseTo(c, 6);
  });
  it("eases a scene-to-scene hand-over instead of jumping", () => {
    const tr = createHorizonTracker();
    tr.step({ id: "stage", h: 300, b: 400 }, 1 / 60);
    const next = tr.step({ id: "closing", h: 700, b: 800 }, 1 / 60);
    expect(next.h).toBeLessThan(320);
    expect(tr.moving).toBe(true);
    for (let i = 0; i < 90; i++) tr.step({ id: "closing", h: 700, b: 800 }, 1 / 60);
    expect(tr.current.h).toBeCloseTo(700, 0);
  });
});
