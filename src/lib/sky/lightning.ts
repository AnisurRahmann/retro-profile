/**
 * Lightning (Weather v6, W4). Pure: the scheduler, a strike's envelope in time and a bolt's geometry, so the
 * photosafety rule can be tested over simulated hours. src/components/sky/SkyRenderer.tsx drives it.
 *
 * The viewer never sees more than three bright pulses in any second (WCAG 2.3.1). A strike has at most three (the
 * return stroke and up to two re-strokes, or two sheet pulses), every pulse falls within 450 ms of its strike
 * beginning, and no two strikes begin within SEPARATION of each other.
 */
import { mulberry32 } from "./random";

export type Kind = "cg" | "ic";

export type Strike = {
  kind: Kind;
  /** When it began (s). */
  t0: number;
  /** A CG: how long its stepped leader takes (ms) and when each re-stroke falls (ms after t0). */
  leaderMs: number;
  restrokes: number[];
  /** An IC: its pulses' starts and lengths (ms after t0). */
  pulses: [number, number][];
  /** An IC's centre (0..1 of the width and height) and radius (a share of the width). */
  x: number;
  y: number;
  r: number;
};

export const BOLT = {
  levels: 7,
  /** The stepped leader: 70–110 ms at a steady 0.35, drawn down from the cloud (no flicker: it is not a pulse). */
  leaderMs: [70, 110] as [number, number],
  leaderAlpha: 0.35,
  strokeMs: 60,
  /** 0–2 re-strokes, each after a dark gap of 50–90 ms from the end of the stroke before. */
  restrokeGap: [50, 90] as [number, number],
  restrokeMs: 45,
  afterglowMs: 280,
};

/** A sheet flash inside the cloud: 1–2 pulses of 80–140 ms, a 30 ms rise and fall, +0.25 L over 18–35% of the width. */
export const SHEET = {
  count: [1, 2] as [number, number],
  ms: [80, 140] as [number, number],
  gap: [60, 120] as [number, number],
  edge: 30,
  lift: 0.25,
  radius: [0.18, 0.35] as [number, number],
};

/** Mean and minimum gaps between strikes of a kind (ms). Heavy rain without thunder: no CG, a sheet flash every 25 s. */
export const GAP = { cg: { mean: 9000, min: 4000 }, ic: { mean: 5000, min: 2000 } } as const;
export const HEAVY_IC_MEAN = 25_000;
/** No two strikes begin within this (ms): with at most three pulses each, all within 400 ms, that is ≤ 3 a second. */
export const SEPARATION = 1400;
export const MAX_PULSES = 3;
/** The first impression: a CG 1.2–2.5 s after the first frame, again within 1.5 s of the stage coming back, at most once in 20 s. */
export const INTRO = { first: [1200, 2500] as [number, number], back: [300, 1500] as [number, number], every: 20_000 } as const;

const between = (rng: () => number, [a, b]: [number, number]) => a + rng() * (b - a);
const exponential = (rng: () => number, mean: number) => -mean * Math.log(1 - rng());

export function newStrike(kind: Kind, t0: number, rng: () => number): Strike {
  if (kind === "ic") {
    const pulses: [number, number][] = [];
    let at = 0;
    for (let i = 0, n = Math.round(between(rng, SHEET.count)); i < n; i++) {
      const len = between(rng, SHEET.ms);
      pulses.push([at, len]);
      at += len + between(rng, SHEET.gap);
    }
    return { kind, t0, leaderMs: 0, restrokes: [], pulses, x: rng(), y: 0.15 + rng() * 0.5, r: between(rng, SHEET.radius) };
  }
  const leaderMs = between(rng, BOLT.leaderMs);
  const restrokes: number[] = [];
  let at = leaderMs;
  let len = BOLT.strokeMs;
  for (let i = 0, n = Math.floor(rng() * 3); i < n; i++) {
    at += len + between(rng, BOLT.restrokeGap);
    restrokes.push(at);
    len = BOLT.restrokeMs;
  }
  return { kind, t0, leaderMs, restrokes, pulses: [], x: -1, y: 0, r: 0 };
}

/** A strike's bright pulses: when each begins and how long it is bright (ms after t0). */
export function pulseTimes(s: Strike): [number, number][] {
  return s.kind === "ic"
    ? s.pulses
    : [[s.leaderMs, BOLT.strokeMs], ...s.restrokes.map((r): [number, number] => [r, BOLT.restrokeMs])];
}

/** When a strike is over (ms after t0): a CG's afterglow has faded, an IC's last pulse has ended. */
export function strikeEnd(s: Strike): number {
  const last = pulseTimes(s).at(-1)!;
  return s.kind === "cg" ? last[0] + last[1] + BOLT.afterglowMs : last[0] + last[1];
}

/** A CG bolt's brightness 0..1 at `ms` since it began: its stepped leader at 0.35, the return stroke, its re-strokes, the afterglow. */
export function boltAlpha(s: Strike, ms: number): number {
  if (s.kind !== "cg" || ms < 0) return 0;
  if (ms < s.leaderMs) return BOLT.leaderAlpha;
  let a = 0;
  for (const [start, len] of pulseTimes(s)) if (ms >= start && ms < start + len) a = Math.max(a, 1 - 0.45 * ((ms - start) / len));
  if (a > 0) return a;
  // Between strokes the channel is dark; after the last, its core glows and fades.
  const ago = ms - (strikeEnd(s) - BOLT.afterglowMs);
  return ago >= 0 && ago < BOLT.afterglowMs ? 0.28 * (1 - ago / BOLT.afterglowMs) : 0;
}

/** An IC sheet flash's strength 0..1 at `ms` since it began. */
export function sheetAlpha(s: Strike, ms: number): number {
  if (s.kind !== "ic" || ms < 0) return 0;
  let a = 0;
  for (const [start, len] of s.pulses) {
    const u = ms - start;
    if (u < 0 || u > len) continue;
    a = Math.max(a, Math.min(1, u / SHEET.edge, (len - u) / SHEET.edge));
  }
  return a;
}

/**
 * A channel from (x0, y0) to (x1, y1): midpoint displacement `levels` deep, each level's offset 0.7 of the one
 * before. Returns x, y pairs.
 */
export function channel(rng: () => number, x0: number, y0: number, x1: number, y1: number, levels: number, amp: number): number[] {
  let pts = [x0, y0, x1, y1];
  for (let level = 0; level < levels; level++) {
    const next: number[] = [];
    for (let i = 0; i + 3 < pts.length; i += 2) {
      const ax = pts[i]!;
      const ay = pts[i + 1]!;
      const dx = pts[i + 2]! - ax;
      const dy = pts[i + 3]! - ay;
      const len = Math.hypot(dx, dy) || 1;
      const off = (rng() - 0.5) * amp;
      next.push(ax, ay, (ax + dx / 2 - (dy / len) * off), (ay + dy / 2 + (dx / len) * off));
    }
    next.push(pts[pts.length - 2]!, pts[pts.length - 1]!);
    pts = next;
    amp *= 0.7;
  }
  return pts;
}

/** A cloud-to-ground bolt in CSS px: its channel from (x, yTop) to (x, yBottom), then 2–4 branches off it. */
export function bolt(rng: () => number, x: number, yTop: number, yBottom: number): number[][] {
  const h = yBottom - yTop;
  const main = channel(rng, x, yTop, x, yBottom, BOLT.levels, h * 0.16);
  const out = [main];
  const n = main.length / 2;
  for (let b = 0, count = 2 + Math.floor(rng() * 3); b < count; b++) {
    const i = 3 + Math.floor(rng() * (n - 6));
    out.push(
      channel(
        rng,
        main[i * 2]!,
        main[i * 2 + 1]!,
        main[i * 2]! + h * (0.08 + rng() * 0.14) * (rng() < 0.5 ? -1 : 1),
        main[i * 2 + 1]! + h * (0.1 + rng() * 0.16),
        4,
        h * 0.08,
      ),
    );
  }
  return out;
}

/**
 * When strikes fall. `due` is when the next of a kind may begin: an exponential gap of its mean after its minimum,
 * and never under SEPARATION after any strike. No CG under heavy rain without thunder.
 */
export function createLightningScheduler(rng: () => number = mulberry32(7)) {
  const last: Record<Kind, number> = { cg: Number.NEGATIVE_INFINITY, ic: Number.NEGATIVE_INFINITY };
  let lastAny = Number.NEGATIVE_INFINITY;
  /** Every bright pulse by its onset (ms), since the start: what the tests count. */
  const onsets: number[] = [];

  const due = (kind: Kind, now: number, thunder: boolean, heavy: boolean): number => {
    if (kind === "cg" && !thunder) return Infinity;
    const g = GAP[kind];
    const mean = kind === "ic" && heavy && !thunder ? HEAVY_IC_MEAN : g.mean;
    return Math.max(now, last[kind] + g.min + exponential(rng, mean - g.min), lastAny + SEPARATION);
  };

  /** The earliest a strike may begin at or after `now`. A strike that falls due while another is under way waits
   *  for this (the renderer holds it): a due time is computed before the strikes before it have begun. */
  const settle = (now: number) => Math.max(now, lastAny + SEPARATION);

  /** A strike begins now. */
  const begin = (kind: Kind, now: number): Strike => {
    const s = newStrike(kind, now / 1000, rng);
    last[kind] = now;
    lastAny = now;
    for (const [start] of pulseTimes(s)) onsets.push(now + start);
    return s;
  };

  /** The intro rule: when a CG may be called for (ms from now), or null if the last one was under 20 s ago. */
  const intro = (now: number, first: boolean): number | null =>
    now - last.cg < INTRO.every ? null : Math.max(now + between(rng, first ? INTRO.first : INTRO.back), lastAny + SEPARATION);

  /** The most bright pulses in any one second since the start. */
  const peakPerSecond = () => {
    const sorted = [...onsets].sort((a, b) => a - b);
    let peak = 0;
    for (let i = 0, j = 0; i < sorted.length; i++) {
      while (sorted[i]! - sorted[j]! >= 1000) j++;
      peak = Math.max(peak, i - j + 1);
    }
    return peak;
  };

  return { due, settle, intro, begin, peakPerSecond, onsets, lastCg: () => last.cg };
}

export type LightningScheduler = ReturnType<typeof createLightningScheduler>;
