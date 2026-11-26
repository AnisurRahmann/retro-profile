import { describe, expect, it } from "vitest";
import {
  BOLT,
  GAP,
  INTRO,
  MAX_PULSES,
  SEPARATION,
  SHEET,
  bolt,
  boltAlpha,
  createLightningScheduler,
  newStrike,
  pulseTimes,
  sheetAlpha,
  strikeEnd,
  type Kind,
} from "@/lib/sky/lightning";
import { mulberry32 } from "@/lib/sky/random";

const times = (s: ReturnType<typeof newStrike>) => pulseTimes(s).map(([a]) => a);

describe("a cloud-to-ground bolt", () => {
  it("is a stepped leader at 0.35 for 70–110 ms, then a 60 ms return stroke, 0–2 re-strokes and a 280 ms afterglow", () => {
    for (let seed = 1; seed < 200; seed++) {
      const rng = mulberry32(seed);
      const s = newStrike("cg", 10, rng);
      expect(s.leaderMs).toBeGreaterThanOrEqual(70);
      expect(s.leaderMs).toBeLessThanOrEqual(110);
      expect(s.restrokes.length).toBeLessThanOrEqual(2);
      expect(boltAlpha(s, s.leaderMs / 2)).toBeLessThanOrEqual(0.35);
      expect(boltAlpha(s, s.leaderMs / 2)).toBeGreaterThanOrEqual(0.35 * 0.55);
      expect(boltAlpha(s, s.leaderMs)).toBe(1);
      expect(boltAlpha(s, s.leaderMs + 59)).toBeGreaterThan(0.5);
      expect(strikeEnd(s)).toBeLessThanOrEqual(110 + 30 + 180 + 45 + 280);
      expect(boltAlpha(s, strikeEnd(s))).toBe(0);
      expect(boltAlpha(s, -1)).toBe(0);
      // At most three bright pulses, all within 400 ms.
      expect(pulseTimes(s).length).toBeLessThanOrEqual(MAX_PULSES);
      for (const [start, len] of pulseTimes(s)) expect(start + len).toBeLessThan(400);
    }
    // With no re-stroke the stroke fades to 0.55 and the afterglow takes over.
    const one = { ...newStrike("cg", 0, mulberry32(3)), restrokes: [] };
    expect(boltAlpha(one, one.leaderMs + 59.9)).toBeLessThan(0.56);
    expect(boltAlpha(one, one.leaderMs + BOLT.strokeMs)).toBeGreaterThan(0.2);
  });

  it("is a channel 7 levels deep with 2–4 branches, from the cloud to the ground", () => {
    for (let seed = 1; seed < 50; seed++) {
      const rng = mulberry32(seed);
      const paths = bolt(rng, 700, 120, 780);
      const [main, ...branches] = paths as [number[], ...number[][]];
      expect(main).toHaveLength((2 ** BOLT.levels + 1) * 2);
      expect(main[0]).toBeCloseTo(700, 10);
      expect(main[1]).toBe(120);
      expect(main.at(-2)).toBeCloseTo(700, 10);
      expect(main.at(-1)).toBe(780);
      for (let i = 0; i < main.length; i += 2) {
        expect(Math.abs(main[i]! - 700)).toBeLessThan(660 * 0.12);
        expect(main[i + 1]).toBeGreaterThanOrEqual(120 - 13);
        expect(main[i + 1]).toBeLessThanOrEqual(780 + 13);
      }
      expect(branches.length).toBeGreaterThanOrEqual(2);
      expect(branches.length).toBeLessThanOrEqual(4);
      for (const b of branches) expect(b).toHaveLength((2 ** 4 + 1) * 2);
    }
  });
});

describe("a sheet flash inside the cloud", () => {
  it("is one or two pulses of 80–140 ms with a 30 ms rise and fall", () => {
    for (let seed = 1; seed < 200; seed++) {
      const s = newStrike("ic", 0, mulberry32(seed));
      expect(s.pulses.length).toBeGreaterThanOrEqual(1);
      expect(s.pulses.length).toBeLessThanOrEqual(2);
      expect(sheetAlpha(s, -1)).toBe(0);
      for (const [start, len] of s.pulses) {
        expect(len).toBeGreaterThanOrEqual(80);
        expect(len).toBeLessThanOrEqual(140);
        expect(sheetAlpha(s, start)).toBe(0);
        expect(sheetAlpha(s, start + 15)).toBeCloseTo(0.5, 10);
        expect(sheetAlpha(s, start + len / 2)).toBe(1);
        expect(start + len).toBeLessThan(400);
      }
      expect(sheetAlpha(s, strikeEnd(s))).toBe(0);
      expect(s.r).toBeGreaterThanOrEqual(0.18);
      expect(s.r).toBeLessThanOrEqual(0.35);
    }
    expect(SHEET.lift).toBe(0.25);
  });
});

describe("the scheduler", () => {
  /** Runs the scheduler for `seconds`, striking as soon as each kind is due. */
  const run = (seconds: number, thunder: boolean, heavy: boolean, seed = 1) => {
    const sch = createLightningScheduler(mulberry32(seed));
    const began: Record<Kind, number[]> = { cg: [], ic: [] };
    const first = sch.intro(0, true)!;
    expect(first).toBeGreaterThanOrEqual(INTRO.first[0]);
    expect(first).toBeLessThanOrEqual(INTRO.first[1]);
    // Not again within 20 s of the last one.
    sch.begin("cg", first);
    expect(sch.intro(first + 1000, false)).toBeNull();
    const back = sch.intro(first + INTRO.every, false)!;
    expect(back - (first + INTRO.every)).toBeGreaterThanOrEqual(INTRO.back[0]);
    let now = first;
    let next = { cg: sch.due("cg", now, thunder, heavy), ic: sch.due("ic", now, thunder, heavy) } as Record<Kind, number>;
    const end = seconds * 1000;
    while (true) {
      const kind: Kind = next.cg <= next.ic ? "cg" : "ic";
      if (next[kind] > end) break;
      // One that falls due while another is under way waits for its second (as the renderer holds it).
      now = sch.settle(next[kind]);
      sch.begin(kind, now);
      began[kind].push(now);
      next = { ...next, [kind]: sch.due(kind, now, thunder, heavy) } as Record<Kind, number>;
    }
    const all = [...began.cg, ...began.ic].sort((a, b) => a - b);
    return { sch, began, all };
  };
  const meanGap = (t: number[]) => t.slice(1).reduce((a, v, i) => a + (v - t[i]!), 0) / Math.max(1, t.length - 1);

  it("never shows more than three bright pulses in any one second over 10,000 simulated seconds", () => {
    for (const [thunder, heavy] of [
      [true, true],
      [true, false],
      [false, true],
    ]) {
      const { sch, all } = run(10_000, thunder!, heavy!);
      expect(sch.peakPerSecond()).toBeLessThanOrEqual(3);
      // … because no two strikes begin within SEPARATION.
      for (let i = 1; i < all.length; i++) expect(all[i]! - all[i - 1]!).toBeGreaterThanOrEqual(SEPARATION);
      expect(sch.onsets.length).toBeGreaterThan(300);
    }
  });

  it("under thunder: a CG about every 9 s (never under 4) and a sheet flash about every 5 s (never under 2)", () => {
    const { began } = run(10_000, true, false);
    expect(began.cg.length).toBeGreaterThan(800);
    expect(began.cg.length).toBeLessThan(1400);
    expect(meanGap(began.cg)).toBeGreaterThan(8400);
    expect(meanGap(began.cg)).toBeLessThan(9600);
    expect(meanGap(began.ic)).toBeGreaterThan(4600);
    expect(meanGap(began.ic)).toBeLessThan(5400);
    for (let i = 1; i < began.cg.length; i++) expect(began.cg[i]! - began.cg[i - 1]!).toBeGreaterThanOrEqual(GAP.cg.min);
    for (let i = 1; i < began.ic.length; i++) expect(began.ic[i]! - began.ic[i - 1]!).toBeGreaterThanOrEqual(GAP.ic.min);
  });

  it("under heavy rain without thunder: no CG, a sheet flash about every 25 s", () => {
    const { began } = run(10_000, false, true);
    expect(began.cg).toEqual([]);
    expect(began.ic.length).toBeGreaterThan(300);
    expect(began.ic.length).toBeLessThan(500);
  });

  it("counts its bright pulses from their onsets, not the strike's start", () => {
    const sch = createLightningScheduler(mulberry32(5));
    const s = sch.begin("cg", 0);
    expect(sch.onsets).toEqual(times(s).map((t) => t));
  });
});
