/**
 * Column scrim: the minimum --ink alpha behind the 768px column that keeps text readable over the brightest sky
 * the renderer can put there. Computed, never tuned by eye.
 */
import { brand } from "../brand";
import { contrast, desaturate, hexToRgb, labToHex, mixLab, oklabToRgb, over, rgbToOklab, scaleL, type Lab, type RGB } from "./color";
import { dayness } from "./gradient";
import type { SkyModel } from "./model";

export const SCRIM_MAX = 0.82;
/** Solver targets (the sweep test gates at 4.5 and 7, so these leave headroom). */
export const SCRIM_GRAPHITE = 4.8;
export const SCRIM_TEXT = 9;
/**
 * Clouds and the horizon glow are drawn at this fraction behind the column scrim (the shader mirrors it).
 * 1 = not damped: v2 dropped the damping because a half-strength cloud band behind the column was part of the
 * visible scrim band (D2); the scrim alone keeps the sweep green.
 */
export const COLUMN_DAMP = 1;
/** Width of the content column (CSS px); the moon and stars are dimmed behind it. */
export const MOON_COLUMN_PX = 768;
/** Moon disc alpha inside the column band (the particle layer dims it there). */
export const MOON_IN_COLUMN = 0.3;
/** The scrim fades in over this many px below the sky stage (and the stage itself is open sky). */
export const SCRIM_RAMP_PX = 160;
/** Desktop: the column scrim's sides fall off over this many px (smootherstep). */
export const SCRIM_FALLOFF_PX = 220;
/** Below this viewport width the column is the whole width: the scrim has no sides. */
export const COLUMN_BREAK = 808;
/** Text scrims (hero block, header row) may go darker than the column: they're small and feathered. */
export const TEXT_SCRIM_MAX = 0.9;

export const smootherstep = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * t * (t * (t * 6 - 15) + 10);
};

/** How much of the column scrim covers viewport x (1 inside the column, falling off over SCRIM_FALLOFF_PX). */
export function columnMask(x: number, vw: number): number {
  if (vw < COLUMN_BREAK) return 1;
  const d = Math.abs(x - vw / 2) - MOON_COLUMN_PX / 2;
  return 1 - smootherstep(0, SCRIM_FALLOFF_PX, d);
}

/** How much of the scrim covers viewport y, given where it starts (the stage bottom, scrolled). */
export const rampMask = (y: number, top: number) => smootherstep(top, top + SCRIM_RAMP_PX, y);

const INK = hexToRgb(brand.ink);
const TEXT = hexToRgb(brand.text);
const GRAPHITE = hexToRgb(brand.graphite);
/** Share of --text in --on-sky (the hero's secondary text over the open stage; globals.css mirrors it). */
export const ON_SKY_TEXT = 0.82;
/** --on-sky = color-mix(in srgb, --text 82%, --graphite). */
export const ON_SKY: RGB = TEXT.map((t, i) => t * ON_SKY_TEXT + GRAPHITE[i]! * (1 - ON_SKY_TEXT)) as RGB;

/** A text colour and the contrast the solver keeps it at. */
export type InkTarget = { rgb: RGB; min: number };
/** The column: --graphite (secondary) and --text (primary). */
export const COLUMN_TARGETS: InkTarget[] = [
  { rgb: GRAPHITE, min: 4.8 },
  { rgb: TEXT, min: 9 },
];
/** The hero over the open stage: --on-sky (secondary) and --text (the name). */
export const HERO_TARGETS: InkTarget[] = [
  { rgb: ON_SKY, min: 4.8 },
  { rgb: TEXT, min: 7.5 },
];

/** Lighten in linear light by factor k (k = 1.405 ≈ +12% OKLab L), back to OKLab. */
function linScale(c: Lab, k: number): Lab {
  return scaleL(c, Math.cbrt(k) - 1);
}

const lum = (c: Lab) => c[0];

type ScrimInput = Pick<SkyModel, "colors" | "glow" | "cloudCover" | "fog" | "astro"> & {
  /** Measured cloud presence 0..1 over the region (the renderer's cloud field); else estimated from cover. */
  clouds?: number;
};

/** How likely a cloud sits behind a given spot, from cover alone: wisps at < 5% don't count, 35%+ always does. */
export const cloudPresence = (cover: number) => smoothstepY(0.05, 0.35, cover);

/** The CSS gradient's colour at height y (0 top … 1 bottom), as the browser interpolates it (sRGB). */
export function gradientAt(m: Pick<SkyModel, "colors">, y: number): Lab {
  const [z, mi, h] = [m.colors.zenith, m.colors.mid, m.colors.horizon].map(oklabToRgb) as [RGB, RGB, RGB];
  const c = y < 0.55 ? over(z, mi, y / 0.55) : over(mi, h, (y - 0.55) / 0.45);
  return rgbToOklab(c);
}

/**
 * The brightest colour the sky can show behind the column at height y (default: the bottom, the worst case):
 * the gradient there, lifted by the horizon glow, the brightest cloud tops and the fog for the current weather,
 * mirroring the shader's falloffs. Lightning is left out: a ≤ 260 ms double pulse on the cloud layer, not a
 * state text has to be read against.
 */
export function brightestSky(m: ScrimInput, moonInColumn = 0, y = 1, damp = COLUMN_DAMP): Lab {
  const h = y >= 1 ? m.colors.horizon : gradientAt(m, y);
  const day = dayness(m.astro.elevation);
  const candidates: Lab[] = [h];
  // Horizon glow: up to +10% L at its centre (horizon × 1.331 linear at alpha ≤ 0.75), falling off upward.
  const g = damp * Math.min(1, m.glow) * Math.exp(-(((1 - y) / 0.42) ** 2) * 2.2);
  if (g > 0) candidates.push(mixLab(h, linScale(m.colors.horizon, 1.331), g));
  const cp = m.clouds ?? cloudPresence(m.cloudCover);
  if (cp > 0) {
    // Day cloud tops: the local sky greyed halfway, +12% L. Golden undersides lean to horizon × 1.1.
    const top = linScale(desaturate(h, 0.5), 1.405);
    candidates.push(mixLab(h, top, damp * 0.85 * day * cp));
    candidates.push(mixLab(h, linScale(m.colors.horizon, 1.1), damp * 0.85 * m.glow * 0.9 * cp));
  }
  const fy = m.fog * smoothstepY(0.35, 1, y);
  if (fy > 0) candidates.push(mixLab(h, linScale(desaturate(h, 0.6), 1.19), Math.min(1, fy * 0.55)));
  let best = candidates.reduce((a, b) => (lum(b) > lum(a) ? b : a));
  // The moon disc, dimmed inside the column.
  if (moonInColumn > 0) best = rgbToOklab(over(oklabToRgb(best), TEXT, MOON_IN_COLUMN * moonInColumn));
  return best;
}

function smoothstepY(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/** Minimum alpha a in [0, max] such that --ink at a over `sky` keeps every target (default: graphite ≥ 4.8:1, text ≥ 9:1). */
export function solveScrim(sky: RGB, max = SCRIM_MAX, targets: InkTarget[] = COLUMN_TARGETS): number {
  const ok = (a: number) => {
    const c = over(sky, INK, a);
    return targets.every((t) => contrast(t.rgb, c) >= t.min);
  };
  if (ok(0)) return 0;
  if (!ok(max)) return max;
  let lo = 0;
  let hi = max;
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    if (ok(mid)) hi = mid;
    else lo = mid;
  }
  return Math.ceil(hi * 1000) / 1000;
}

export function scrimFor(m: ScrimInput, moonInColumn = 0): number {
  return solveScrim(oklabToRgb(brightestSky(m, moonInColumn)));
}

/** Scrim stops at 0, 25, 50, 75 and 100% of the viewport height. */
export const SCRIM_STOPS = [0, 0.25, 0.5, 0.75, 1];

/**
 * Per-height scrim, following the gradient: the sky is dark at the zenith and brightest at the horizon, so the
 * scrim only darkens where it has to. Each stop is the maximum solve over its neighbourhood (sampled every 1/32
 * of the height up to the neighbouring stops), so linear interpolation between stops never undershoots.
 * The moon only counts near its own height.
 */
export function scrimProfile(m: ScrimInput, moonInColumn = 0, moonY = 0.5): number[] {
  const N = 32;
  const need: number[] = [];
  for (let i = 0; i <= N; i++) {
    const y = i / N;
    need.push(solveScrim(oklabToRgb(brightestSky(m, Math.abs(y - moonY) < 0.08 ? moonInColumn : 0, y))));
  }
  return SCRIM_STOPS.map((y, k) => {
    const lo = Math.round((SCRIM_STOPS[k - 1] ?? y) * N);
    const hi = Math.round((SCRIM_STOPS[k + 1] ?? y) * N);
    return Math.max(...need.slice(lo, hi + 1));
  });
}

/** For logs and the sweep test. */
export function compositeOverScrim(m: Parameters<typeof brightestSky>[0], moonInColumn = 0) {
  const sky = oklabToRgb(brightestSky(m, moonInColumn));
  const a = solveScrim(sky);
  const c = over(sky, INK, a);
  return { a, sky: labToHex(rgbToOklab(sky)), graphite: contrast(GRAPHITE, c), text: contrast(TEXT, c) };
}

/**
 * Alpha for a text scrim (hero block, header row) over the open stage sky: the maximum solve over the block's
 * height range (viewport fractions), with clouds and glow at full strength (nothing is damped over the stage).
 * `extra(y)` can add a brighter candidate at a height (the sun or moon disc and bloom behind the block).
 */
export function regionScrim(
  m: ScrimInput,
  y0: number,
  y1: number,
  targets: InkTarget[] = COLUMN_TARGETS,
  extra?: (y: number) => Lab | null,
): number {
  let a = 0;
  for (let i = 0; i <= 8; i++) {
    const y = Math.min(1, Math.max(0, y0 + ((y1 - y0) * i) / 8));
    let sky = brightestSky(m, 0, y, 1);
    const e = extra?.(y);
    if (e && lum(e) > lum(sky)) sky = e;
    a = Math.max(a, solveScrim(oklabToRgb(sky), TEXT_SCRIM_MAX, targets));
  }
  return a;
}
