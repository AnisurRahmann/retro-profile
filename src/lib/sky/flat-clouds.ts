/**
 * Flat clouds: the cloud model, pure. Clouds are cut from paper like the landscape: puff clusters on a flat base, long
 * stratus bands, a cumulonimbus in a storm, each in three flat tones (palette FLAT_CLOUD_*). Drawn by
 * src/components/sky/flat-cloud-layer.ts; the backing model (backing.ts) and the sun's and moon's occlusion read the
 * same geometry.
 *
 * Coordinates are CSS px in the viewport. The sky runs from the top of the viewport (y 0) to the clouds' horizon (y =
 * skyH: the far hills' skyline with the fixed band, the stage's ground in scene mode). A layer's band is a share of
 * that height above the horizon. The clouds never scroll (the sky's parallax is 0).
 *
 * - Puffs: 5–14 circles along a flat base, biggest near the middle (a hump, ±18% each), clipped flat below the base.
 *   Three layers, FAR (small, flat, mixed 55% toward the sky, slow), MID and NEAR. Each layer is a fixed number of
 *   slots spread along a wrap period a little wider than the viewport; a cloud leaves downwind and comes back upwind
 *   with a new shape (its generation), so the count never changes.
 * - Decks (overcast, drizzle, rain, heavy rain, thunder): 4–6 stacked rows of long rounded strips, thicker overhead,
 *   thinner toward the horizon, with thin gaps of sky. A rain deck's lowest row has a ragged underside (small
 *   hanging half-circles). Thunder adds one cumulonimbus with an anvil: in a gutter on a desktop, rising from behind
 *   the land on a phone.
 * - Deterministic: the seed is the day of the year and the layer.
 */
import { hexToLab, mixLab, type Lab } from "./color";
import {
  FLAT_CLOUD_DAY,
  FLAT_CLOUD_DRIZZLE,
  FLAT_CLOUD_FLASH_CAP,
  FLAT_CLOUD_GOLDEN,
  FLAT_CLOUD_NIGHT,
  FLAT_CLOUD_OVERCAST,
  FLAT_CLOUD_RAIN,
  FLAT_CLOUD_RIM,
  FLAT_CLOUD_THUNDER,
  FLAT_CLOUD_TWILIGHT,
  type FlatTones,
} from "./palette";
import { mulberry32 } from "./random";
import type { Condition } from "./weather";

export type LayerId = "far" | "mid" | "near";
export const LAYERS: readonly LayerId[] = ["far", "mid", "near"];

/**
 * Per layer: the size against a near cloud, how far its tones mix toward the sky behind it, its speed against the
 * near layer's, its band (share of the sky height above the horizon: the whole cloud stays inside it), its
 * width-to-height ratio (flatter with distance) and its share of the covered sky.
 */
export const LAYER = {
  far: { scale: 0.45, mix: 0.55, speed: 0.3, band: [0.08, 0.3], ratio: [3.5, 5.5], share: 0.25 },
  mid: { scale: 0.7, mix: 0.25, speed: 0.55, band: [0.25, 0.55], ratio: [2.8, 4.5], share: 0.3 },
  near: { scale: 1, mix: 0, speed: 1, band: [0.45, 0.85], ratio: [2.2, 3.6], share: 0.45 },
} as const satisfies Record<LayerId, { scale: number; mix: number; speed: number; band: readonly [number, number]; ratio: readonly [number, number]; share: number }>;

/** Each circle's radius breathes ±4% over 20–40 s, from its own phase: a cloud slowly changes shape. */
export const BREATH = { amp: 0.04, period: [20, 40] } as const;
/** The near layer's speed: 0.8 px/s per km/h of the east–west wind, never under 4 or over 40 px/s. */
export const SPEED = { perKmh: 0.8, min: 4, max: 40 } as const;
/** Gusts: the wind swells and drops by ±`amplitude` around its speed, at `hz` (Weather v6, W2). */
export const GUST = { amplitude: 0.2, hz: 0.07 } as const;
/** The wind's speed at time t (seconds), as a factor of its own: 1 ± 0.2 at 0.07 Hz. */
export const gust = (t: number) => 1 + GUST.amplitude * Math.sin(2 * Math.PI * GUST.hz * t);

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * clamp01(t);
const smooth = (e0: number, e1: number, x: number) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};

/**
 * The near layer's drift, px/s on screen (signed: + is to the right). The wind blows toward from + 180°; the viewer
 * faces south, so a west wind carries the clouds left. A wind along the view (north or south) moves them at the
 * minimum speed the way its small east–west part goes, or to the right when it has none.
 */
export function nearSpeed(kmh: number, fromDeg: number): number {
  const to = ((fromDeg + 180) * Math.PI) / 180;
  const ew = -Math.sin(to) * kmh;
  const v = Math.min(SPEED.max, Math.max(SPEED.min, SPEED.perKmh * Math.abs(ew)));
  return Math.abs(ew) < 1e-6 ? v : Math.sign(ew) * v;
}

/**
 * The share of the sky (top of the viewport to the horizon) a condition covers: its band [lo, hi] and, for a cloud
 * cover 0..1, where in the band it falls (linearly).
 */
export function coverageBand(condition: Condition, cover: number): { lo: number; hi: number; target: number } {
  const band = (lo: number, hi: number, t: number) => ({ lo, hi, target: lerp(lo, hi, t) });
  switch (condition) {
    case "fog":
      return band(0, 0, 0);
    case "overcast":
    case "drizzle":
      return band(0.8, 0.92, (cover - 0.6) / 0.4);
    case "rain":
    case "heavy-rain":
    case "thunder":
      return band(0.9, 1, (cover - 0.9) / 0.1);
    default:
      if (condition === "clear" && cover < 0.2) return band(0, 0.03, cover / 0.2);
      return cover >= 0.6 ? band(0.4, 0.55, (cover - 0.6) / 0.4) : band(0.18, 0.28, (cover - 0.2) / 0.4);
  }
}
export const coverageTarget = (condition: Condition, cover: number) => coverageBand(condition, cover).target;

/** A deck condition: stratus bands, not puffs. */
export const isDeck = (c: Condition) => c === "overcast" || c === "drizzle" || c === "rain" || c === "heavy-rain" || c === "thunder";

// ── Geometry ────────────────────────────────────────────────────────────────────────────────────────────────────

/** A circle of a cloud, relative to its left edge and its base (y < 0 is above it), with its breath. */
export type Circle = { x: number; y: number; r: number; per: number; ph: number };
/** A rounded box of a cloud (a band's strip, an anvil), relative like a circle; rad is its corner radius. */
export type RBox = { x: number; y: number; w: number; h: number; rad: number };
export type Shape = {
  layer: LayerId;
  kind: "puff" | "band" | "cb";
  /** Width and height above the base. */
  w: number;
  h: number;
  circles: Circle[];
  boxes: RBox[];
  /** Everything below this (relative to the base) is cut off: 0 for a flat base, more for a hanging underside. */
  clip: number;
  /** The share of the height the BASE band takes (22–30%), and how far the cap's crescent reaches (6–10%). */
  baseK: number;
  capK: number;
};
/** A cloud on screen: its shape, its left edge and base (viewport px), and what it is (for caches). */
export type Cloud = { shape: Shape; x: number; base: number; key: string };

/** A puff cluster: circles on a hump along a flat base, its width `w` and height `h`. */
function puffShape(layer: LayerId, w: number, h: number, rnd: () => number): Shape {
  const ratio = w / h;
  const n = Math.round(Math.min(14, Math.max(5, ratio * 2.4 + (rnd() - 0.5) * 2)));
  const rel: number[] = [];
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) / n;
    rel.push((0.42 + 0.58 * Math.sin(Math.PI * u) ** 1.2) * (1 + (rnd() * 2 - 1) * 0.18));
  }
  // Centres sit 0.3 r above the base: a circle's top is 1.3 r up, its lower part is cut off flat.
  const R = h / (1.3 * Math.max(...rel));
  const r = rel.map((k) => k * R);
  const x0 = r[0]!;
  const x1 = w - r[n - 1]!;
  const circles = r.map((ri, i) => ({
    x: n === 1 ? w / 2 : x0 + ((x1 - x0) * i) / (n - 1),
    y: -ri * (0.3 + rnd() * 0.08),
    r: ri,
    per: BREATH.period[0] + rnd() * (BREATH.period[1] - BREATH.period[0]),
    ph: rnd() * Math.PI * 2,
  }));
  return { layer, kind: "puff", w, h, circles, boxes: [], clip: 0, baseK: 0.22 + rnd() * 0.08, capK: 0.06 + rnd() * 0.04 };
}

/** A cumulonimbus: a tall stack of puffs under a flat anvil that runs downwind (dir ±1). */
function cbShape(w: number, h: number, dir: number, rnd: () => number): Shape {
  const circles: Circle[] = [];
  const tower = 0.62 * w;
  const tx = dir > 0 ? 0.05 * w : w - 0.05 * w - tower;
  const breath = () => ({ per: BREATH.period[0] + rnd() * (BREATH.period[1] - BREATH.period[0]), ph: rnd() * Math.PI * 2 });
  // Four tiers of puffs, narrower and higher, round a solid core that climbs into the anvil.
  const tiers = [
    { n: 4, r: 0.24, y: 0.16 },
    { n: 3, r: 0.23, y: 0.38 },
    { n: 3, r: 0.21, y: 0.58 },
    { n: 2, r: 0.2, y: 0.76 },
  ];
  tiers.forEach((t, k) => {
    const span = tower * (1 - 0.12 * k);
    const left = tx + (tower - span) / 2;
    for (let i = 0; i < t.n; i++) {
      const r = t.r * tower * (1 + (rnd() * 2 - 1) * 0.12);
      circles.push({ x: left + r + ((span - 2 * r) * i) / Math.max(1, t.n - 1), y: -t.y * h, r, ...breath() });
    }
  });
  // The anvil: flat on top, from over the tower out downwind; its underside rounded where it leaves the tower.
  const ah = 0.2 * h;
  const aw = 0.92 * w;
  const ax = dir > 0 ? 0 : w - aw;
  const core = { x: tx + 0.18 * tower, y: -0.92 * h, w: 0.64 * tower, h: 0.8 * h, rad: 0.25 * tower };
  return {
    layer: "near",
    kind: "cb",
    w,
    h,
    circles,
    boxes: [core, { x: ax, y: -h, w: aw, h: ah, rad: Math.min(ah / 2, 14) }],
    clip: 0,
    baseK: 0.18,
    capK: 0.05,
  };
}

// ── The plan: what a condition draws on this layout ─────────────────────────────────────────────────────────────

export type PlanInput = {
  condition: Condition;
  /** Cloud cover 0..1. */
  cover: number;
  /** Day of the year: the seed. */
  day: number;
  vw: number;
  skyH: number;
  /** A deck starts no higher than this (px): the header's text stays over open sky. */
  deckTop?: number;
  /** Gutters beside the column (desktop): where a cumulonimbus stands. */
  gutters?: [number, number][];
};

type PuffLayer = { id: LayerId; n: number; P: number; M: number; slots: number[]; h0: number };
type Row = { layer: LayerId; y: number; h: number; P: number; strips: { x: number; w: number; k: number }[]; hang: number; closed: boolean };
export type Plan = {
  input: PlanInput;
  target: number;
  /** The size every puff is scaled by, solved so the coverage meets its target. */
  s: number;
  puffs: PuffLayer[];
  rows: Row[];
  cb: Cloud | null;
  /** Shapes already built, by layer, slot and generation. */
  memo: Map<string, { shape: Shape; base: number }>;
};

const seedOf = (day: number, layer: number, ...more: number[]) =>
  more.reduce((a, b) => Math.imul(a ^ b, 0x9e3779b1) >>> 0, Math.imul(day * 131 + layer * 7919 + 17, 0x85ebca6b) >>> 0);

/** A near cloud's typical height on this layout (px). */
export const nearHeight = (skyH: number, vw: number) => Math.min(150, Math.max(40, Math.min(0.16 * skyH, 0.18 * vw)));

/** A layer's band in viewport px: [top, bottom]. */
export const bandPx = (id: LayerId, skyH: number): [number, number] => [skyH * (1 - LAYER[id].band[1]), skyH * (1 - LAYER[id].band[0])];

/** The shape of a puff layer's slot in its generation g (deterministic), and its base. */
function puffAt(plan: Plan, L: PuffLayer, slot: number, gen: number): { shape: Shape; base: number } {
  const key = `${L.id}:${slot}:${gen}:${plan.s}`;
  const hit = plan.memo.get(key);
  if (hit) return hit;
  if (plan.memo.size > 600) plan.memo.clear();
  const rnd = mulberry32(seedOf(plan.input.day, LAYERS.indexOf(L.id) + 1, slot, gen + 1000));
  const spec = LAYER[L.id];
  const h = L.h0 * plan.s * (0.8 + 0.4 * rnd());
  const ratio = spec.ratio[0] + rnd() * (spec.ratio[1] - spec.ratio[0]);
  const w = Math.min(h * ratio, L.M, 0.95 * Math.max(plan.input.vw, 1));
  const shape = puffShape(L.id, w, Math.min(h, w / spec.ratio[0]), rnd);
  const [top, bottom] = bandPx(L.id, plan.input.skyH);
  const room = Math.max(0, bottom - top - shape.h);
  const out = { shape, base: top + shape.h + room * rnd() };
  plan.memo.set(key, out);
  return out;
}

const wrap = (v: number, p: number) => ((v % p) + p) % p;

/**
 * The clouds on screen for each layer's drift (px, integrated by the renderer). Puffs are wrapped into
 * [−M, vw + M): a cloud gone off one side comes back on the other, a generation later, in a new shape. `all` keeps
 * the puffs off screen too (every slot, once).
 */
export function cloudsAt(plan: Plan, off: Record<LayerId, number>, all = false): Cloud[] {
  const out: Cloud[] = [];
  const { vw } = plan.input;
  for (const L of plan.puffs)
    L.slots.forEach((x0, i) => {
      const u = x0 + off[L.id] + L.M;
      const gen = Math.floor(u / L.P);
      const x = wrap(u, L.P) - L.M;
      const { shape, base } = puffAt(plan, L, i, gen);
      if (all || (x < vw && x + shape.w > 0)) out.push({ shape, x, base, key: `${L.id}:${i}:${gen}` });
    });
  plan.rows.forEach((row, k) => {
    row.strips.forEach((st, i) => {
      const shape = stripShape(row, st.w, st.k, plan.input.day, k, i);
      for (const x of [wrap(st.x + off[row.layer], row.P), wrap(st.x + off[row.layer], row.P) - row.P])
        if (x < vw && x + st.w > 0) out.push({ shape, x, base: row.y + row.h, key: `row${k}:${i}` });
    });
  });
  if (plan.cb) out.push(plan.cb);
  return out;
}

/** A strip's rounded ends: a full half-circle on a thin strip, a rounded corner on a thick one. */
export const stripRad = (h: number) => Math.min(h / 2, 8 + 0.18 * h);

/** Strips are rebuilt on demand (cheap) so a plan stays plain data. */
const stripCache = new Map<string, Shape>();
function stripShape(row: Row, w: number, hk: number, day: number, k: number, i: number): Shape {
  const key = `${day}|${k}|${i}|${w.toFixed(1)}|${row.h.toFixed(1)}|${hk}|${row.hang}|${row.closed}`;
  let s = stripCache.get(key);
  if (!s) {
    const rnd = mulberry32(seedOf(day, 9, k, i));
    const circles: Circle[] = [];
    if (row.hang > 0) {
      // A ragged underside: small half-circles hanging from the strip's bottom edge, end to end.
      let x = row.h * 0.6;
      while (x < w - row.h * 0.6) {
        const r = row.hang * (0.7 + 0.6 * rnd());
        circles.push({ x: x + r, y: 0, r, per: 30, ph: 0 });
        x += r * (1.7 + 0.6 * rnd());
      }
    }
    s = {
      layer: row.layer,
      kind: "band",
      w,
      h: row.h * hk,
      circles,
      // A closed rain deck's strips meet with barely rounded ends: no notch of sky between them.
      boxes: [{ x: 0, y: -row.h * hk, w, h: row.h * hk, rad: row.closed ? 4 : stripRad(row.h * hk) }],
      clip: row.hang > 0 ? row.hang * 1.4 : 0,
      baseK: 0.25,
      capK: 0.08,
    };
    if (stripCache.size > 400) stripCache.clear();
    stripCache.set(key, s);
  }
  return s;
}

/** A circle's radius at time t (s): its breath. t null holds it (a still frame). */
export const breathR = (c: Circle, t: number | null) =>
  t === null ? c.r : c.r * (1 + BREATH.amp * Math.sin((2 * Math.PI * t) / c.per + c.ph));

/** Signed distance (px) from a point to a cloud's silhouette: negative inside. */
export function sdCloud(c: Cloud, px: number, py: number, t: number | null = null): number {
  const x = px - c.x;
  const y = py - c.base;
  const s = c.shape;
  let d = Infinity;
  for (const k of s.circles) d = Math.min(d, Math.hypot(x - k.x, y - k.y) - breathR(k, s.kind === "band" ? null : t));
  for (const b of s.boxes) {
    // A rounded box: the distance to its inner rectangle, less the corner radius.
    const r = Math.min(b.rad, b.w / 2, b.h / 2);
    const qx = Math.abs(x - (b.x + b.w / 2)) - (b.w / 2 - r);
    const qy = Math.abs(y - (b.y + b.h / 2)) - (b.h / 2 - r);
    d = Math.min(d, Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r);
  }
  return Math.max(d, y - s.clip);
}

/** Is a point under any cloud? (a cheap bounding test first) */
export function inside(c: Cloud, x: number, y: number): boolean {
  const s = c.shape;
  if (x < c.x - 1 || x > c.x + s.w + 1 || y < c.base - s.h - 1 || y > c.base + s.clip + 1) return false;
  return sdCloud(c, x, y) <= 0;
}

/**
 * The share of the sky (0..vw × 0..skyH) under cloud, rasterised on a gw × gh grid of cell centres.
 */
export function coverage(clouds: Cloud[], vw: number, skyH: number, gw = 160, gh = 90): number {
  const grid = new Uint8Array(gw * gh);
  for (const c of clouds) {
    const s = c.shape;
    const i0 = Math.max(0, Math.floor((c.x / vw) * gw));
    const i1 = Math.min(gw - 1, Math.ceil(((c.x + s.w) / vw) * gw));
    const j0 = Math.max(0, Math.floor(((c.base - s.h) / skyH) * gh));
    const j1 = Math.min(gh - 1, Math.ceil(((c.base + s.clip) / skyH) * gh));
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++) {
        const k = j * gw + i;
        if (!grid[k] && inside(c, ((i + 0.5) / gw) * vw, ((j + 0.5) / gh) * skyH)) grid[k] = 1;
      }
  }
  let n = 0;
  for (const v of grid) n += v;
  return n / grid.length;
}

/** No drift: every layer where it starts. */
export const NO_DRIFT: Record<LayerId, number> = { far: 0, mid: 0, near: 0 };

/** Mean coverage over a few drifts of the near layer's period: what the solver aims at. */
function meanCoverage(plan: Plan, P = plan.puffs.find((l) => l.id === "near")?.P ?? plan.input.vw, gw = 64, gh = 36) {
  let sum = 0;
  const k = [0, 0.29, 0.61];
  for (const f of k) sum += coverage(cloudsAt(plan, { far: f * P * 0.3, mid: f * P * 0.55, near: f * P }), plan.input.vw, plan.input.skyH, gw, gh);
  return sum / k.length;
}

/** What a condition draws on this layout: the puff layers' slots and size, or a deck's rows (and the storm's tower). */
export function planClouds(input: PlanInput): Plan {
  const { condition, cover, day, vw, skyH } = input;
  const { lo, hi, target: t0 } = coverageBand(condition, cover);
  // Aimed inside its band: the sky on screen drifts a few points either way of what the solver meets.
  const target = hi - lo >= 0.1 ? Math.min(hi - 0.35 * (hi - lo), Math.max(lo + 0.35 * (hi - lo), t0)) : t0;
  const plan: Plan = { input, target, s: 1, puffs: [], rows: [], cb: null, memo: new Map() };
  if (target <= 0 || vw < 1 || skyH < 1) return plan;
  const H0 = nearHeight(skyH, vw);
  if (!isDeck(condition)) {
    LAYERS.forEach((id, li) => {
      const spec = LAYER[id];
      const h0 = H0 * spec.scale;
      const meanW = h0 * ((spec.ratio[0] + spec.ratio[1]) / 2);
      // Room for the widest cloud of the largest size the solver may reach, off each side.
      const M = Math.min(h0 * 1.6 * 1.2 * spec.ratio[1], 0.95 * vw);
      const P = vw + 2 * M;
      const area = 0.72 * meanW * h0;
      // A clear sky still carries a small far cloud or two.
      const n = Math.max(id === "far" ? 1 : 0, Math.round(Math.min(30, ((target * spec.share * vw * skyH) / area) * (P / vw))));
      if (n < 1) return;
      const rnd = mulberry32(seedOf(day, li + 1));
      // Stratified along the period: an even sky, whatever the drift.
      const slots = Array.from({ length: n }, (_, i) => -M + ((i + 0.15 + 0.7 * rnd()) * P) / n);
      plan.puffs.push({ id, n, P, M, slots, h0 });
    });
    // The size that meets the target (coverage grows about as the size squared). A clear sky's one or two small
    // far clouds are off screen as often as on: they keep a small size.
    if (hi <= 0.03) {
      plan.s = 0.7;
      return plan;
    }
    for (let i = 0; i < 4 && plan.puffs.length; i++) {
      const c = meanCoverage(plan);
      if (c <= 0) break;
      plan.s = Math.min(1.6, Math.max(0.55, plan.s * Math.sqrt(target / c)));
    }
    return plan;
  }
  // A deck: 4–6 bands from its top (under the header) to the horizon, thick overhead, thin toward the horizon. Each
  // band is a stack of strips 28–70px thick, their rounded ends staggered: layered stratus, not slabs.
  const rnd = mulberry32(seedOf(day, 4));
  const R = 4 + Math.floor(rnd() * 3);
  const rain = condition === "rain" || condition === "heavy-rain" || condition === "thunder";
  // Overhead (the top band) is the nearest and thickest: 70 → 28 down to the horizon, ±10%.
  const rel = Array.from({ length: R }, (_, k) => (1 - (0.6 * k) / (R - 1)) * (0.9 + 0.2 * rnd()));
  // A stratus deck shows thin gaps of sky between its bands and its strips; a rain deck is closed (no gaps but the
  // notches where two strips' rounded ends meet) and hangs a ragged underside over a strip of sky at the horizon.
  const gap = rain ? 0 : Math.max(2, 0.005 * skyH);
  const top = Math.max(0, input.deckTop ?? 0);
  const strips = (k: number, h: number) => {
    const r2 = mulberry32(seedOf(day, 5, k));
    const out: { x: number; w: number; k: number }[] = [];
    // Each strip starts somewhere else along its period: the ends of a band's strips never line up.
    let x = -r2() * vw * 0.6;
    const x0 = x;
    // At least the viewport plus the widest strip, so a row never shows its end.
    while (x - x0 < 2.45 * vw) {
      // 60–140% of the viewport; on a phone at least five times as long as it is thick, or its round ends eat it.
      const w = Math.max(vw * (0.6 + 0.8 * r2()), h * (5 + 2 * r2()));
      // A stratus strip is 86–100% of its row's thickness on a shared base (a band's top edge steps), and about
      // a third of its ends leave a thin gap of sky; a rain deck's are whole and closed.
      out.push({ x, w, k: rain ? 1 : 0.86 + 0.14 * r2() });
      // Strips never overlap (a thinned strip would show the overlap): they meet end to end, rounded ends leaving a
      // small notch of sky, or leave a thin gap.
      x += w + (rain || r2() < 0.65 ? 0 : Math.min(vw * (0.01 + 0.025 * r2()), 0.4 * h));
    }
    return { strips: out, P: x - x0 };
  };
  const sum = rel.reduce((a, b) => a + b, 0);
  const STRIP = { min: 28, max: 70 };
  const hangOf = (total: number) => (rain ? Math.min(12, Math.max(4, (0.3 * rel[R - 1]! * total) / sum / 2)) : 0);
  const build = (total: number) => {
    const hang = hangOf(total);
    let y = top;
    plan.rows = [];
    rel.forEach((k, i) => {
      const band = (k / sum) * total;
      const layer: LayerId = i < R / 3 ? "near" : i < (2 * R) / 3 ? "mid" : "far";
      const m = Math.max(1, Math.ceil(band / STRIP.max));
      const h = band / m;
      for (let j = 0; j < m; j++) {
        const last = i === R - 1 && j === m - 1;
        plan.rows.push({ layer, y, h, hang: last ? hang : 0, closed: rain, ...strips(i * 16 + j, h) });
        y += h;
      }
      y += gap;
    });
  };
  // The bands' total height that meets the target, solved on the rasterised coverage; never past the horizon.
  const most = skyH - top - gap * (R - 1);
  let total = Math.min(most, target * skyH);
  for (let i = 0; i < 5; i++) {
    build(total);
    // A stratus deck's thin gaps need a fine grid to be counted; a closed rain deck doesn't.
    const c = meanCoverage(plan, plan.rows[0]?.P ?? vw, rain ? 64 : 160, rain ? 36 : 90);
    if (c <= 0) break;
    total = Math.min(most - 1.4 * hangOf(total), total * (target / c));
  }
  build(total);
  if (condition === "thunder") {
    const g = input.gutters?.find(() => true);
    const tall = (1.5 + 0.5 * rnd()) * H0;
    const dir = rnd() < 0.5 ? -1 : 1;
    if (g && g[1] - g[0] > 120) {
      const w = Math.min(0.85 * (g[1] - g[0]), 1.4 * tall);
      const side = input.gutters!.length > 1 && rnd() < 0.5 ? input.gutters![1]! : g;
      plan.cb = { shape: cbShape(w, tall, dir, rnd), x: (side[0] + side[1]) / 2 - w / 2, base: bandPx("near", skyH)[1], key: "cb" };
    } else {
      // A phone: it rises from behind the land, beside the column of text.
      const w = Math.min(0.7 * vw, 1.4 * tall);
      plan.cb = { shape: cbShape(w, tall, dir, rnd), x: vw * 0.58 - w / 2, base: skyH + 0.06 * tall, key: "cb" };
    }
  }
  return plan;
}

// ── Tones ───────────────────────────────────────────────────────────────────────────────────────────────────────

export type Tones = { body: Lab; cap: Lab; base: Lab; rim: Lab | null };

const labs = (t: FlatTones) => ({ body: hexToLab(t.body), cap: hexToLab(t.cap), base: hexToLab(t.base) });
/** The time of day's tones by sun elevation: night, civil twilight, golden hour, day. */
const KEYS: { e: number; t: () => ReturnType<typeof labs> }[] = [
  { e: -10, t: () => labs(FLAT_CLOUD_NIGHT) },
  { e: -4, t: () => labs(FLAT_CLOUD_TWILIGHT) },
  { e: 2.5, t: () => labs(FLAT_CLOUD_GOLDEN) },
  { e: 10, t: () => labs(FLAT_CLOUD_DAY) },
];
const DECKS: Partial<Record<Condition, { body: string; base: string }>> = {
  overcast: FLAT_CLOUD_OVERCAST,
  drizzle: FLAT_CLOUD_DRIZZLE,
  rain: FLAT_CLOUD_RAIN,
  "heavy-rain": FLAT_CLOUD_RAIN,
  thunder: FLAT_CLOUD_THUNDER,
};

function timeTones(e: number) {
  if (e <= KEYS[0]!.e) return KEYS[0]!.t();
  const last = KEYS[KEYS.length - 1]!;
  if (e >= last.e) return last.t();
  let i = 0;
  while (KEYS[i + 1]!.e < e) i++;
  const a = KEYS[i]!.t();
  const b = KEYS[i + 1]!.t();
  const k = smooth(KEYS[i]!.e, KEYS[i + 1]!.e, e);
  return { body: mixLab(a.body, b.body, k), cap: mixLab(a.cap, b.cap, k), base: mixLab(a.base, b.base, k) };
}

/** How light a time of day is against the day's (OKLab L of the body): a deck darkens with it. */
const dayL = () => hexToLab(FLAT_CLOUD_DAY.body)[0];

/**
 * A cloud's tones for the sky: elevation (degrees), condition, the moon. Puffs take the time of day's tones; a deck
 * takes its weather's, darkened as the light goes and tinted toward the time of day (OKLab). At night the cap is
 * there only while the moon is up, by its illumination, with a 1px moonlit rim.
 */
export function cloudTones(e: number, condition: Condition, moon: { up: boolean; fraction: number } = { up: false, fraction: 0 }): Tones {
  const t = timeTones(e);
  const night = 1 - smooth(-10, -4, e);
  const lit = moon.up ? moon.fraction : 0;
  const nightCap = mixLab(t.body, t.cap, 1 - night * (1 - lit));
  const deck = DECKS[condition];
  if (deck) {
    const w = smooth(-6, 10, e);
    const k = t.body[0] / dayL();
    const tint = (hex: string): Lab => {
      const [L, a, b] = hexToLab(hex);
      return [L * k, a + (t.body[1] - a) * 0.5 * (1 - w), b + (t.body[2] - b) * 0.5 * (1 - w)];
    };
    const body = tint(deck.body);
    return { body, cap: body, base: tint(deck.base), rim: null };
  }
  return { body: t.body, cap: nightCap, base: t.base, rim: night * lit > 0.02 ? mixLab(nightCap, hexToLab(FLAT_CLOUD_RIM), 0.6 * lit * night) : null };
}

/** Tones mixed `k` of the way toward the sky behind (the far and mid layers). */
export function mixTones(t: Tones, sky: Lab, k: number): Tones {
  if (k <= 0) return t;
  return { body: mixLab(t.body, sky, k), cap: mixLab(t.cap, sky, k), base: mixLab(t.base, sky, k), rim: t.rim ? mixLab(t.rim, sky, k) : null };
}

/** A flash: CAP and BODY lifted (OKLab L + dL); a thunder cloud's cap goes to FLAT_CLOUD_FLASH_CAP. */
export function flashTones(t: Tones, dL: number, thunder: boolean): Tones {
  const up = (c: Lab): Lab => [Math.min(1, c[0] + dL), c[1], c[2]];
  return { body: up(t.body), cap: thunder ? up(hexToLab(FLAT_CLOUD_FLASH_CAP)) : up(t.cap), base: t.base, rim: t.rim };
}

/** The lightest of a cloud's tones (what text over it is judged against). */
export const brightest = (t: Tones): Lab => [t.body, t.cap, t.base, ...(t.rim ? [t.rim] : [])].reduce((a, b) => (b[0] > a[0] ? b : a));
