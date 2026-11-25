/**
 * Per-element backing for "loose text": text that sits directly on the sky (`data-on-sky`), as opposed to text
 * on a glass card. Each element gets only as much backing as the sky behind it needs, and only where it needs it:
 *
 * - "none": the text already reads (≥ 7:1 for --text, ≥ 4.8:1 for secondary text: --graphite, --on-sky).
 * - "halo": a text-shadow halo in --ink (1px, 6px, 16px at a, a, 0.6a) is enough; a comes from HALO_CURVE.
 * - "chip": a crisp glass chip behind the text (--ink at CHIP_ALPHA or more, blur 8px, radius 6px).
 *
 * The background is estimated from the renderer's CPU-side model, never sampled from pixels at runtime: the
 * gradient colour at the element's height, the brightest cloud tops the 64×36 cloud mirror puts over its box,
 * the horizon glow, fog, the sun's disc and blooms and the moon's disc and glow when they reach the box, and the
 * city glow when the box overlaps the landscape at night. Lightning is left out (a ≤ 260 ms pulse on the cloud
 * layer, not a state anyone reads against).
 *
 * Pure: the DOM side is src/components/sky/backing-runner.ts. The gate is the Playwright pixel test
 * (tests/e2e/sky-backing.spec.ts), which measures what the browser actually painted.
 */
import { brand } from "../brand";
import { contrast, hexToRgb, luminance, oklabToRgb, over, rgbToOklab, toGamma, toLinear, type Lab, type RGB } from "./color";
import { dayness, sunColor } from "./gradient";
import type { SkyModel } from "./model";
import { CITY_GLOW } from "./palette";
import { layerColor, riverColor } from "./landscape/colors";
import { RIVER } from "./landscape/shapes";

export type Backing = "none" | "halo" | "chip";

export const INK = hexToRgb(brand.ink);
export const TEXT = hexToRgb(brand.text);
export const GRAPHITE = hexToRgb(brand.graphite);
/** Share of --text in --on-sky (globals.css mirrors it). */
export const ON_SKY_TEXT = 0.82;
/** --on-sky = color-mix(in srgb, --text 82%, --graphite): secondary text over the open sky. */
export const ON_SKY: RGB = TEXT.map((t, i) => t * ON_SKY_TEXT + GRAPHITE[i]! * (1 - ON_SKY_TEXT)) as RGB;

/** "none" thresholds: primary text (--text) and secondary text (--graphite, --on-sky). The pixel gate is 4.5. */
export const TARGET_PRIMARY = 7;
export const TARGET_SECONDARY = 4.8;
/** Is this text colour the primary text (--text) rather than a secondary one? */
export const isPrimary = (c: RGB) => Math.max(...c.map((v, i) => Math.abs(v - TEXT[i]!))) < 0.03;
export const targetFor = (c: RGB) => (isPrimary(c) ? TARGET_PRIMARY : TARGET_SECONDARY);

/** The chip's --ink alpha (the brief's 0.62); solved higher, up to CHIP_MAX, where the sky needs it. */
export const CHIP_ALPHA = 0.62;
export const CHIP_MAX = 0.97;

/**
 * Halo calibration: halo alpha a → the --ink alpha k the halo is "worth" behind the text, as the pixel gate
 * measures it (the 90th-percentile pixel of the glyphs' surround, 1.5–6 CSS px from a glyph). Measured with
 * scripts/probe/halo-calibrate.mts over four flat backgrounds (noon blue, dusk amber, light blue, light amber) at
 * 1440 DPR 1 and 375 DPR 2, every loose-text element on the home page; the minimum per size bucket (conservative).
 * The 1/6/16px shadows are thin around thin strokes, so the halo only fixes small deficits; bigger ones get a chip.
 * Rows: [a, k(small ≤ 13px), k(body 14–20px), k(display > 20px)].
 */
export const HALO_CURVE: readonly (readonly [number, number, number, number])[] = [
  [0, 0, 0, 0],
  [0.25, 0.001, 0.009, 0.016],
  [0.5, 0.01, 0.019, 0.033],
  [0.75, 0.016, 0.028, 0.051],
  [1, 0.028, 0.042, 0.071],
];
/** Size bucket for HALO_CURVE from the font size (CSS px). */
export const sizeBucket = (px: number) => (px <= 13 ? 1 : px <= 20 ? 2 : 3);

/** The halo's effective ink alpha at halo alpha a, for a size bucket (linear between calibrated rows). */
export function haloInk(a: number, bucket: number): number {
  const c = HALO_CURVE;
  const x = Math.min(1, Math.max(0, a));
  for (let i = 1; i < c.length; i++) {
    const p = c[i - 1]!;
    const q = c[i]!;
    if (x <= q[0]) return p[bucket]! + ((q[bucket]! - p[bucket]!) * (x - p[0])) / (q[0] - p[0]);
  }
  return c[c.length - 1]![bucket]!;
}

/** The smallest halo alpha (to 0.05) worth `need` ink, or null when even a = 1 isn't enough. */
export function haloFor(need: number, bucket: number): number | null {
  if (need <= 0) return 0;
  for (let a = 0.05; a <= 1.0001; a += 0.05) if (haloInk(a, bucket) >= need) return Math.round(a * 100) / 100;
  return null;
}

/**
 * Anti-aliasing: at DPR < 2 small glyphs (≤ 14px) never reach their nominal colour; the pixel gate measured
 * --graphite at 12–14px rendering ~15% of the way toward the background. The model judges them by that colour.
 */
export const aaMix = (fontPx: number, dpr: number) => (fontPx <= 14 && dpr < 2 ? 0.15 : 0);
const rendered = (text: RGB, bg: RGB, aa: number) => (aa ? over(text, bg, aa) : text);

/** Minimum --ink alpha in [0, max] over `bg` that keeps `text` at `min`:1 (max + 1 when even `max` fails). */
export function inkNeeded(bg: RGB, text: RGB, min: number, max = 1, aa = 0): number {
  const ok = (a: number) => {
    const b = over(bg, INK, a);
    return contrast(rendered(text, b, aa), b) >= min;
  };
  if (ok(0)) return 0;
  if (!ok(max)) return max + 1;
  let lo = 0;
  let hi = max;
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) / 2;
    if (ok(mid)) hi = mid;
    else lo = mid;
  }
  return Math.ceil(hi * 1000) / 1000;
}

export type Decision = { mode: Backing; /** halo alpha, or the chip's ink alpha */ a: number; contrast: number };

/** Pick the lightest backing that keeps `text` readable over `bg` (as rendered at this size and DPR). */
export function decide(bg: RGB, text: RGB, fontPx: number, dpr = 2): Decision {
  const min = targetFor(text);
  const aa = aaMix(fontPx, dpr);
  const on = (k: number) => {
    const b = over(bg, INK, k);
    return contrast(rendered(text, b, aa), b);
  };
  const bare = on(0);
  if (bare >= min) return { mode: "none", a: 0, contrast: bare };
  const need = inkNeeded(bg, text, min, 1, aa);
  const bucket = sizeBucket(fontPx);
  const a = haloFor(need, bucket);
  if (a !== null) return { mode: "halo", a, contrast: on(haloInk(a, bucket)) };
  const chip = Math.min(CHIP_MAX, Math.max(CHIP_ALPHA, Math.ceil(inkNeeded(bg, text, min, CHIP_MAX, aa) * 100) / 100));
  return { mode: "chip", a: chip, contrast: on(chip) };
}

// ── The background model ─────────────────────────────────────────────────────────────────────────────────────

type SkyInput = Pick<SkyModel, "colors" | "glow" | "cloudCover" | "fog" | "astro">;

const lin = (c: RGB): RGB => c.map(toLinear) as RGB;
const gam = (c: RGB): RGB => c.map((v) => toGamma(Math.min(1, Math.max(0, v)))) as RGB;
const scale = (c: RGB, k: number): RGB => c.map((v) => v * k) as RGB;
const mixRgb = (p: RGB, q: RGB, t: number): RGB => p.map((v, i) => v + (q[i]! - v) * t) as RGB;
const luma = (c: RGB) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
const smoothstep = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};
const brighter = (p: RGB, q: RGB) => (luminance(q) > luminance(p) ? q : p);

/** How likely a cloud sits behind a spot, from cover alone (until the renderer's cloud field runs). */
export const cloudPresence = (cover: number) => smoothstep(0.05, 0.35, cover);

/** The CSS gradient's colour at height y (0 top … 1 bottom of the viewport), as the browser interpolates it. */
export function gradientAt(m: Pick<SkyModel, "colors">, y: number): Lab {
  const [z, mi, h] = [m.colors.zenith, m.colors.mid, m.colors.horizon].map(oklabToRgb) as [RGB, RGB, RGB];
  const c = y < 0.55 ? over(z, mi, Math.max(0, y) / 0.55) : over(mi, h, Math.min(1, (y - 0.55) / 0.45));
  return rgbToOklab(c);
}

/**
 * The brightest the sky layers can be at height y: the gradient, with the horizon glow, the brightest cloud tops
 * and golden undersides (alpha × `clouds`, the cloud presence over the box) and the fog composited exactly as the
 * shader does (linear-light colours at their maximum alpha, then composited in sRGB by the browser).
 */
export function skyAt(m: SkyInput, y: number, clouds = cloudPresence(m.cloudCover)): RGB {
  const hRgb = oklabToRgb(gradientAt(m, y));
  const base = lin(hRgb);
  const H = lin(oklabToRgb(m.colors.horizon));
  const day = dayness(m.astro.elevation);
  let best = hRgb;
  // Horizon glow: horizon × 1.331 (linear) at alpha 0.75 · glow · exp(−((1 − y) / 0.42)² · 2.2), under the sun.
  const g = Math.min(1, m.glow) * 0.75 * Math.exp(-(((1 - Math.min(1, y)) / 0.42) ** 2) * 2.2);
  if (g > 0) best = brighter(best, over(hRgb, gam(scale(H, 1.331)), g));
  if (clouds > 0) {
    const l = luma(base);
    const grey = base.map((v) => l + (v - l) * 0.5) as RGB;
    const night = scale(base, 0.55);
    const tops = scale(grey, 1.405);
    const under = mixRgb(scale(grey, 0.95), scale(H, 1.1), Math.min(1, m.glow) * 0.495);
    for (const c of [tops, under]) best = brighter(best, over(hRgb, gam(mixRgb(night, c, day)), 0.85 * clouds));
  }
  // Fog: base desaturated 60%, × 1.19, at alpha fog · 0.55 · smoothstep(.35, 1, y).
  const fy = m.fog * smoothstep(0.35, 1, y) * 0.55;
  if (fy > 0) {
    const l = luma(base);
    best = brighter(best, over(hRgb, gam(scale(base.map((v) => l + (v - l) * 0.4) as RGB, 1.19)), fy));
  }
  return best;
}

/** The sun as the particle layer draws it (bodies.ts): disc radius, cloud in front 0..1, altitude fade. */
export type SunDisc = { x: number; y: number; r: number; alt: number; cloud: number; fog: number };
/** The moon: disc radius, visibility 0..1 (cloud, fog, night), glow strength (the shader's mg). */
export type MoonDisc = { x: number; y: number; r: number; visible: number; glow: number };

/** bodies.ts bloom profile: 0 → 1, .35 → .95, .5 → .7, .7 → .32, .85 → .1, 1 → 0 of the bloom's radius. */
const PROFILE: [number, number][] = [
  [0, 1],
  [0.35, 0.95],
  [0.5, 0.7],
  [0.7, 0.32],
  [0.85, 0.1],
  [1, 0],
];
function profile(t: number): number {
  if (t >= 1) return 0;
  for (let i = 1; i < PROFILE.length; i++) {
    const [x1, y1] = PROFILE[i]!;
    const [x0, y0] = PROFILE[i - 1]!;
    if (t <= x1) return y0 + ((y1 - y0) * (t - x0)) / (x1 - x0);
  }
  return 0;
}

export type Box = { x0: number; y0: number; x1: number; y1: number };
const distTo = (b: Box, x: number, y: number) => Math.hypot(Math.max(b.x0 - x, 0, x - b.x1), Math.max(b.y0 - y, 0, y - b.y1));

/** The sun's disc and blooms over `bg` at distance d from its centre (bodies.ts: 3×, 8×, 20× r at .35, .12, .05). */
export function sunOver(bg: RGB, s: SunDisc, d: number): RGB {
  const fade = smoothstep(-0.9, 0.6, s.alt);
  if (fade <= 0) return bg;
  const col = sunColor(s.alt);
  const c = s.cloud;
  const grow = 1 + 0.6 * c;
  let a = 0;
  for (const [k, ak] of [
    [20, 0.05],
    [8, 0.12],
    [3, 0.35],
  ] as const)
    a = 1 - (1 - a) * (1 - ak * profile(d / (k * s.r * grow)));
  let out = over(bg, col, Math.min(1, a * (1 - 0.75 * c) * fade));
  if (d < s.r) out = over(out, col, (1 - 0.85 * c) * (1 - 0.5 * s.fog) * fade);
  return out;
}

const MOON_GLOW: RGB = gam([0.62, 0.66, 0.76]);
/** The moon's disc (0.92 × visible, --text) and the shader's moon glow (0.16 · mg · exp(−(d / 110)² · 0.9)). */
export function moonOver(bg: RGB, m: MoonDisc, d: number): RGB {
  let out = bg;
  if (m.glow > 0) out = over(out, MOON_GLOW, m.glow * 0.16 * Math.exp(-((d / 110) ** 2) * 0.9));
  if (d < m.r && m.visible > 0) out = over(out, TEXT, 0.92 * m.visible);
  return out;
}

/** The night city glow (fix 3): CITY_GLOW at `alpha` at the horizon, fading to 0 at `reach` px above it. */
export type CityGlow = { horizonY: number; reach: number; alpha: number };
const GLOW_RGB = hexToRgb(CITY_GLOW);
export function cityGlowOver(bg: RGB, g: CityGlow, y: number): RGB {
  if (g.alpha <= 0 || y > g.horizonY + 2) return bg;
  const t = 1 - Math.min(1, Math.max(0, (g.horizonY - y) / g.reach));
  return t > 0 ? over(bg, GLOW_RGB, g.alpha * t) : bg;
}

export type Scene = {
  m: SkyInput;
  vw: number;
  vh: number;
  /** Cloud presence over a viewport rect (the renderer's cloud mirror), or undefined before it runs. */
  cloudsIn?: (b: Box) => number;
  sun: SunDisc | null;
  moon: MoonDisc | null;
  /** City glows behind landscape bands on screen (viewport px). */
  glows: CityGlow[];
  /** Landscape bands on screen (viewport px, without the take-off headroom): below the far bank, it's land. */
  lands?: { top: number; h: number }[];
};

/**
 * What a landscape band shows at viewport y, when it's solid: the river (its sky reflection is the brightest thing
 * below the far bank) or the near bank. Above the far bank silhouettes come and go, so the sky counts there.
 */
function landAt(s: Scene, y: number): RGB | null {
  for (const l of s.lands ?? []) {
    const u = ((y - l.top) / l.h) * 100;
    if (u >= 89 && u <= 100) return oklabToRgb(layerColor(s.m.colors.horizon, "L4"));
    if (u >= RIVER[0] && u < 89) return oklabToRgb(riverColor(s.m.colors.horizon));
  }
  return null;
}

/** Horizontal margin (px) for cloud lookups: about a minute of drift at the minimum speed. */
export const CLOUD_MARGIN = 300;

/** The brightest background the sky can put behind a box (viewport px). */
export function backgroundFor(s: Scene, b: Box): RGB {
  const clouds = s.cloudsIn ? Math.max(0, s.cloudsIn({ x0: b.x0 - CLOUD_MARGIN, y0: b.y0, x1: b.x1 + CLOUD_MARGIN, y1: b.y1 })) : undefined;
  let best: RGB = [0, 0, 0];
  const n = Math.max(2, Math.min(6, Math.ceil((b.y1 - b.y0) / 24)));
  for (let i = 0; i <= n; i++) {
    const y = b.y0 + ((b.y1 - b.y0) * i) / n;
    const land = landAt(s, y);
    let c = land ?? skyAt(s.m, y / s.vh, clouds ?? cloudPresence(s.m.cloudCover));
    if (!land) for (const g of s.glows) c = cityGlowOver(c, g, y);
    best = brighter(best, c);
  }
  if (s.moon) best = moonOver(best, s.moon, distTo(b, s.moon.x, s.moon.y));
  if (s.sun) best = sunOver(best, s.sun, distTo(b, s.sun.x, s.sun.y));
  return best;
}

/** Parse a computed CSS colour: rgb()/rgba() or color(srgb …). */
export function parseCssColor(v: string): RGB | null {
  let m = v.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
  if (m) return [+m[1]! / 255, +m[2]! / 255, +m[3]! / 255];
  m = v.match(/^color\(srgb\s+([\d.e-]+)\s+([\d.e-]+)\s+([\d.e-]+)/);
  if (m) return [+m[1]!, +m[2]!, +m[3]!];
  return null;
}
