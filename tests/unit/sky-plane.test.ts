import { describe, expect, it } from "vitest";
import {
  ARRIVAL_FROM_BOTTOM,
  bandArrival,
  CLIMB_DEG,
  createArrival,
  FADE_IN_S,
  GEAR_UP_S,
  gateAt,
  PITCH_ROTATE,
  planeAt,
  planePx,
  RESPAWN_S,
  ROLL_END_S,
  ROTATE_END_S,
  SCALE_END,
  TAKEOFF_S,
  TAXI_PX_S,
  TAXI_S,
  visibleShare,
  type TakeoffParams,
} from "@/lib/sky/landscape/plane";

const P: TakeoffParams = { x0: 1300, y0: 110, runwayY: 114, dir: -1, rollPx: 220 };

describe("planeAt: the take-off choreography (4.6 s)", () => {
  it("is parked at the gate before it starts", () => {
    expect(planeAt(-1, P)).toMatchObject({
      x: 1300,
      y: 110,
      pitchDeg: 0,
      scale: 1,
      gearDown: true,
      alpha: 1,
      state: "parked",
    });
  });

  it("taxis onto the threshold at 18 px/s in the first 0.5 s", () => {
    const a = planeAt(0.1, P);
    const b = planeAt(0.3, P);
    expect(a.state).toBe("taxi");
    expect((a.x - b.x) / 0.2).toBeCloseTo(TAXI_PX_S, 6);
    expect(planeAt(TAXI_S - 1e-9, P).y).toBeCloseTo(P.runwayY, 3);
  });

  it("rolls with constant acceleration (x = x₀ + ½at²) to the rotation point at the end of the visible runway", () => {
    const xT = P.x0 - TAXI_PX_S * TAXI_S;
    const d = (t: number) => xT - planeAt(t, P).x;
    const s1 = 0.5;
    const s2 = 1.0;
    // d ∝ s² from the start of the roll.
    expect(d(TAXI_S + s2) / d(TAXI_S + s1)).toBeCloseTo((s2 / s1) ** 2, 6);
    expect(d(ROLL_END_S - 1e-9)).toBeCloseTo(P.rollPx, 3);
    expect(planeAt(1.2, P)).toMatchObject({ state: "roll", pitchDeg: 0, y: P.runwayY });
  });

  it("rotates 0 → 9° between 2.0 and 2.35 s with the wheels still on the runway", () => {
    expect(planeAt(ROLL_END_S + 1e-6, P).pitchDeg).toBeCloseTo(0, 3);
    expect(planeAt(ROTATE_END_S - 1e-6, P).pitchDeg).toBeCloseTo(PITCH_ROTATE, 2);
    expect(planeAt(2.2, P).y).toBe(P.runwayY);
  });

  it("climbs on a 12° path, shrinking 1 → 0.55, gear up at 2.75 s, fading over the last 0.6 s", () => {
    const a = planeAt(3.0, P);
    const b = planeAt(3.2, P);
    expect(a.state).toBe("climb");
    expect((Math.atan2(a.y - b.y, a.x - b.x) * 180) / Math.PI).toBeCloseTo(CLIMB_DEG, 6);
    expect(b.y).toBeLessThan(a.y);
    expect(b.scale).toBeLessThan(a.scale);
    expect(planeAt(TAKEOFF_S - 1e-6, P).scale).toBeCloseTo(SCALE_END, 4);
    expect(planeAt(GEAR_UP_S - 0.01, P).gearDown).toBe(true);
    expect(planeAt(GEAR_UP_S + 0.01, P).gearDown).toBe(false);
    expect(planeAt(3.9, P).alpha).toBe(1);
    expect(planeAt(4.3, P).alpha).toBeCloseTo(0.5, 6);
    expect(planeAt(TAKEOFF_S, P)).toMatchObject({ state: "gone", alpha: 0 });
  });

  it("is a smooth path: no jumps between frames anywhere in the 4.6 s", () => {
    let prev = planeAt(0, P);
    for (let t = 1 / 120; t < TAKEOFF_S; t += 1 / 120) {
      const f = planeAt(t, P);
      expect(Math.hypot(f.x - prev.x, f.y - prev.y)).toBeLessThan(5);
      expect(Math.abs(f.pitchDeg - prev.pitchDeg)).toBeLessThan(1);
      prev = f;
    }
  });

  it("fades as it leaves the viewport", () => {
    const inside = planeAt(3.4, { ...P, bounds: { x0: -1e6, x1: 1e6, y0: -1e6 } });
    const edge = planeAt(3.4, { ...P, bounds: { x0: inside.x - 10, x1: 1e6, y0: -1e6 } });
    expect(inside.alpha).toBe(1);
    expect(edge.alpha).toBeCloseTo(0.25, 6);
  });

  it("is 90px long on phones and 100px above (v5.1 T5)", () => {
    expect(planePx(375)).toBe(90);
    expect(planePx(1440)).toBe(100);
  });
});

describe("gateAt: the next plane", () => {
  it("is gone for 2.5 s after the take-off, then fades in over 600 ms", () => {
    expect(gateAt(10, -Infinity)).toEqual({ state: "parked", alpha: 1 });
    expect(gateAt(10, 10).state).toBe("taxi");
    expect(gateAt(10 + TAKEOFF_S + 0.1, 10)).toEqual({ state: "gone", alpha: 0 });
    expect(gateAt(10 + TAKEOFF_S + RESPAWN_S + FADE_IN_S / 2, 10).alpha).toBeCloseTo(0.5, 6);
    expect(gateAt(10 + TAKEOFF_S + RESPAWN_S + FADE_IN_S, 10)).toEqual({
      state: "parked",
      alpha: 1,
    });
  });
});

describe("the arrival in the fixed band (v5.1 T5)", () => {
  // 1440×900: the airport is 302px wide; at the bottom of the page it spans x 1110–1412.
  const at = (scroll: number) => bandArrival(visibleShare(1704 - 0.45 * scroll, 2006 - 0.45 * scroll, 1440), 1321 - scroll);

  it("measures how much of a landmark's width is on screen", () => {
    expect(visibleShare(100, 200, 1440)).toBe(1);
    expect(visibleShare(1400, 1500, 1440)).toBeCloseTo(0.4, 9); // its right 60px are off screen
    expect(visibleShare(1340, 1440, 1440)).toBe(1);
    expect(visibleShare(-50, 50, 1440)).toBeCloseTo(0.5, 9);
    expect(visibleShare(1500, 1600, 1440)).toBe(0);
    expect(visibleShare(100, 100, 1440)).toBe(0);
  });

  it("fires once at least half the airport is on screen and the page is within 400px of its bottom", () => {
    expect(ARRIVAL_FROM_BOTTOM).toBe(400);
    expect(at(0)).toEqual({ near: false, away: true });
    expect(at(400)).toEqual({ near: false, away: true }); // not on screen yet
    // Its left edge enters at scroll ≈ 588, a tenth of it by ≈ 655, half by ≈ 924.
    expect(at(650).away).toBe(true);
    expect(at(660)).toEqual({ near: false, away: false }); // more than a tenth on screen, but too high on the page
    expect(at(921)).toEqual({ near: false, away: false }); // just under half on screen
    expect(at(924)).toEqual({ near: true, away: false });
    expect(at(1321)).toEqual({ near: true, away: false }); // the bottom of the page
  });

  it("re-arms only once under a tenth of the airport is visible", () => {
    // Scrolling back up from the bottom: it stays armed-to-fire until a tenth of its width is left, then re-arms.
    expect(at(900).away).toBe(false);
    expect(at(660).away).toBe(false);
    expect(at(650).away).toBe(true);
  });
});

describe("createArrival: every arrival, once", () => {
  it("fires on arrival, not again until it has left, then again on the next arrival", () => {
    const a = createArrival();
    const fires: number[] = [];
    // Three visits: approach, stay, leave, come back.
    const visits = [
      [300, 200, 50, 10, 0, 20, 100, 260, 400],
      [200, 59, 30, 0, 250, 500],
      [100, 40, 300],
    ];
    let i = 0;
    for (const v of visits)
      for (const d of v) {
        if (a.update(d <= 60, d > 240, true)) fires.push(i);
        i++;
      }
    expect(fires).toHaveLength(3);
  });

  it("waits for the plane: an arrival while it's away fires once it's parked again", () => {
    const a = createArrival();
    expect(a.update(true, false, false)).toBe(false);
    expect(a.update(true, false, true)).toBe(true);
    expect(a.update(true, false, true)).toBe(false);
  });
});
