import { describe, expect, it } from "vitest";
import { FOG_ALPHA, FOG_AT, FOG_CELL, FOG_PERIOD, FOG_STRETCH, GROUND_FOG, groundFog, groundFogX } from "@/lib/sky/fog";

describe("fog with depth", () => {
  it("fades the landscape by distance: the far hills 85%, the tea hills 60%, the town 30%, the near ground 8%", () => {
    expect(FOG_AT).toEqual({ L1: 0.85, L2: 0.6, L3: 0.3, L4: 0.08 });
  });

  it("has three bands of ground fog, 30, 60 and 110 px, each drifting at 2 px/s or more", () => {
    expect(GROUND_FOG.map((b) => b.h)).toEqual([30, 60, 110]);
    for (const b of GROUND_FOG) expect(b.speed).toBeGreaterThanOrEqual(2);
    expect(groundFogX(0, 10, 1)).toBeCloseTo(22, 10);
    expect(groundFogX(2, 10, 1)).toBeCloseTo(50, 10);
    // A calm wind still moves it: the wind factor never drops under one.
    for (let k = 0; k < 3; k++) expect(groundFogX(k, 10, 0) / 10).toBeGreaterThanOrEqual(2);
  });

  it("keeps every band's alpha within .18–.32 of the fog colour, and nothing above or below the band", () => {
    for (let k = 0; k < 3; k++) {
      const { h } = GROUND_FOG[k]!;
      for (let i = 0; i < 4000; i++) {
        const x = ((i * 0.6180339887) % 1) * FOG_PERIOD * 1.7;
        const y = ((i * 0.7548776662) % 1) * h;
        const a = groundFog(x, y, h, k);
        // Denser toward the ground: the weight (y / h)^0.7 is the band's own fade, not the noise's alpha.
        const weight = (y / h) ** 0.7;
        const noise = weight > 0.01 ? a / weight : FOG_ALPHA[0];
        expect(noise, `k${k} at ${x.toFixed(0)},${y.toFixed(1)}`).toBeGreaterThanOrEqual(FOG_ALPHA[0] - 1e-12);
        expect(noise).toBeLessThanOrEqual(FOG_ALPHA[0] + (FOG_ALPHA[1] - FOG_ALPHA[0]) * 1.35 + 1e-12);
      }
      expect(groundFog(100, -1, h, k)).toBe(0);
      expect(groundFog(100, h + 1, h, k)).toBe(0);
      expect(groundFog(100, h, h, k)).toBeGreaterThanOrEqual(FOG_ALPHA[0] - 1e-12);
    }
  });

  it("tiles every FOG_PERIOD px, so a band can drift for good", () => {
    for (let k = 0; k < 3; k++) {
      const { h } = GROUND_FOG[k]!;
      for (const [x, y] of [[0, 5], [137, 12], [959.5, 29], [300, h - 0.5]]) {
        expect(groundFog(x!, y!, h, k)).toBeCloseTo(groundFog(x! + FOG_PERIOD, y!, h, k), 12);
        expect(groundFog(x! - FOG_PERIOD, y!, h, k)).toBeCloseTo(groundFog(x!, y!, h, k), 12);
      }
    }
    expect(FOG_PERIOD).toBe(4 * FOG_CELL);
  });

  it("is stretched 12:1: along a band the noise varies a twelfth as fast as down it", () => {
    // The distance, in px, over which two samples stop correlating, measured down and across a tall band.
    const h = GROUND_FOG[2]!.h;
    const mid = h * 0.5;
    const run = (dx: number, dy: number) => {
      let n = 0;
      for (let i = 1; i < 400; i++) if (groundFog(300 + dx * i, mid + dy * i, h, 2) > 0) n = i;
      return n;
    };
    const across = run(1, 0);
    const down = run(0, 1);
    expect(across).toBeGreaterThan(5 * down);
    expect(FOG_STRETCH).toBe(12);
  });
});
