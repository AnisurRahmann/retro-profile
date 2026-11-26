/**
 * Per-element backing for "loose text": text that sits directly on the sky (`data-on-sky`), as opposed to text
 * on a glass card. Each element gets only as much backing as the sky behind it needs, and only where it needs it:
 *
 * - "none": the text already reads (≥ 7:1 for --text, ≥ 4.8:1 for secondary text: --graphite, --on-sky).
 * - "halo": a text-shadow halo in --ink (1px, 6px, 16px at a, a, 0.6a) is enough; a comes from HALO_CURVE.
 * - "chip": a light glass chip behind the text, no border (--ink at CHIP_ALPHA or more, blur 10px, radius 5px,
 *   1px × 6px around the text), solved to CHIP_TARGET: comfortably over the 4.5 gate, not to the "none" 7:1.
 *
 * The background is estimated from the renderer's CPU-side model, never sampled from pixels at runtime: the
 * gradient colour at the element's height, the brightest cloud the 64×36 cloud mirror puts over its box, the
 * horizon glow, fog, the sun's disc and blooms (or its diffuse patch under a deck) and the moon's disc and glow when
 * they reach the box, and the city glow when the box overlaps the landscape at night. Lightning is left out (a
 * transient on the cloud layer, not a state anyone reads against).
 *
 * Pure: the DOM side is src/components/sky/backing-runner.ts. The gate is the Playwright pixel test
 * (tests/e2e/sky-backing.spec.ts), which measures what the browser actually painted.
 */
import { brand } from "../brand";
import {
  contrast,
  hexToRgb,
  luminance,
  oklabToRgb,
  over,
  toGamma,
  toLinear,
  type Lab,
  type RGB,
} from "./color";
import { sunColor } from "./gradient";
import type { SkyModel } from "./model";
import { CITY_GLOW, CITY_ON_CLOUD, CLOUD_LIT, MOONLIGHT } from "./palette";
import { groundColor, riverColor, sunLight } from "./landscape/colors";
import { RIVER } from "./landscape/shapes";
import { gradientLab, gradientRgb, HORIZON_AWAY, skyParam, type Horizon } from "./horizon";

export type Backing = "none" | "halo" | "chip";

export const INK = hexToRgb(brand.ink);
export const TEXT = hexToRgb(brand.text);
export const GRAPHITE = hexToRgb(brand.graphite);
/** Share of --text in --on-sky (globals.css mirrors it). */
export const ON_SKY_TEXT = 0.82;
/** --on-sky = color-mix(in srgb, --text 82%, --graphite): secondary text over the open sky. */
export const ON_SKY: RGB = TEXT.map(
  (t, i) => t * ON_SKY_TEXT + GRAPHITE[i]! * (1 - ON_SKY_TEXT),
) as RGB;

/** "none" thresholds: primary text (--text) and secondary text (--graphite, --on-sky). The pixel gate is 4.5. */
export const TARGET_PRIMARY = 7;
export const TARGET_SECONDARY = 4.8;
/** Is this text colour the primary text (--text) rather than a secondary one? */
export const isPrimary = (c: RGB) => Math.max(...c.map((v, i) => Math.abs(v - TEXT[i]!))) < 0.03;
export const targetFor = (c: RGB) => (isPrimary(c) ? TARGET_PRIMARY : TARGET_SECONDARY);

/** The chip's --ink alpha (v4: 0.5); solved higher, up to CHIP_MAX, where the sky needs it. */
export const CHIP_ALPHA = 0.5;
export const CHIP_MAX = 0.97;
/** The contrast a chip is solved to (any text colour): the 4.5 gate plus a margin for the model. */
export const CHIP_TARGET = 5;
/** Small text (≤ SMALL_PX: the caption, strip labels, footer) prefers a halo up to this alpha before a chip. */
export const SMALL_PX = 12;
export const SMALL_HALO_MAX = 0.85;

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

/** The smallest halo alpha (to 0.05, at most `max`) worth `need` ink, or null when even `max` isn't enough. */
export function haloFor(need: number, bucket: number, max = 1): number | null {
  if (need <= 0) return 0;
  for (let a = 0.05; a <= max + 0.0001; a += 0.05)
    if (haloInk(a, bucket) >= need) return Math.round(a * 100) / 100;
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

export type Decision = {
  mode: Backing;
  /** halo alpha, or the chip's ink alpha */ a: number;
  contrast: number;
};

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
  const bucket = sizeBucket(fontPx);
  // A halo, if one can make the "none" target; small text tries it up to SMALL_HALO_MAX, and settles for the chip's
  // target from a halo rather than wear a chip.
  const a = haloFor(
    inkNeeded(bg, text, min, 1, aa),
    bucket,
    fontPx <= SMALL_PX ? SMALL_HALO_MAX : 1,
  );
  if (a !== null) return { mode: "halo", a, contrast: on(haloInk(a, bucket)) };
  const goal = Math.min(min, CHIP_TARGET);
  if (fontPx <= SMALL_PX) {
    const s = haloFor(inkNeeded(bg, text, goal, 1, aa), bucket, SMALL_HALO_MAX);
    if (s === 0) return { mode: "none", a: 0, contrast: bare };
    if (s !== null) return { mode: "halo", a: s, contrast: on(haloInk(s, bucket)) };
  }
  const chip = Math.min(
    CHIP_MAX,
    Math.max(CHIP_ALPHA, Math.ceil(inkNeeded(bg, text, goal, CHIP_MAX, aa) * 100) / 100),
  );
  return { mode: "chip", a: chip, contrast: on(chip) };
}

// ── The background model ─────────────────────────────────────────────────────────────────────────────────────

type SkyInput = Pick<SkyModel, "colors" | "glow" | "cloudCover" | "fog" | "astro"> & { condition?: SkyModel["condition"] };

const lin = (c: RGB): RGB => c.map(toLinear) as RGB;
const gam = (c: RGB): RGB => c.map((v) => toGamma(Math.min(1, Math.max(0, v)))) as RGB;
const scale = (c: RGB, k: number): RGB => c.map((v) => v * k) as RGB;
const luma = (c: RGB) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
const smoothstep = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};
const brighter = (p: RGB, q: RGB) => (luminance(q) > luminance(p) ? q : p);

/** How likely a cloud sits behind a spot, from cover alone (until the renderer's cloud field runs). */
export const cloudPresence = (cover: number) => smoothstep(0.05, 0.35, cover);

/** The horizon as fractions of the viewport height (src/lib/sky/horizon.ts): gutter mode is { h: 1, b: 1 }. */
export const FLAT: Horizon = { h: 1, b: 1 };

/**
 * The CSS gradient's colour at height y (0 top … 1 bottom of the viewport), as the browser interpolates it, for a
 * horizon at hz.h that returns to the mid colour by hz.b (fractions of the viewport height).
 */
export function gradientAt(m: Pick<SkyModel, "colors">, y: number, hz: Horizon = FLAT): Lab {
  return gradientLab(m.colors, y, hz, HORIZON_AWAY);
}

/**
 * The brightest the sky layers can be at height y: the gradient, with the horizon glow, the brightest cloud
 * (cloudOver, at the cloud presence over the box) and the fog composited exactly as the shader does (linear-light
 * colours at their maximum alpha, then composited in sRGB by the browser).
 */
export function skyAt(
  m: SkyInput,
  y: number,
  clouds = cloudPresence(m.cloudCover),
  hz: Horizon = FLAT,
): RGB {
  const hRgb = gradientRgb(m.colors, y, hz, HORIZON_AWAY);
  const p = skyParam(y, hz, HORIZON_AWAY);
  const base = lin(hRgb);
  const H = lin(oklabToRgb(m.colors.horizon));
  let best = hRgb;
  // Horizon glow: horizon × 1.331 (linear) at alpha 0.75 · glow · exp(−((H − y) / 0.42)² · 2.2), under the sun,
  // centred on the horizon line (in gutter mode H = 1: the viewport bottom).
  const gy = y <= hz.b ? hz.h : HORIZON_AWAY;
  const storm = m.condition === "thunder";
  // A storm dims the dusk glow by half, and its cloud base over the top of the viewport is half as lit.
  const g = Math.min(1, m.glow) * (storm ? 0.5 : 1) * 0.75 * Math.exp(-(((gy - y) / 0.42) ** 2) * 2.2);
  if (g > 0) best = brighter(best, over(hRgb, gam(scale(H, 1.331)), g));
  if (clouds > 0) {
    const base = storm ? 1 - 0.5 * smoothstep(0.55, 0.2, y) : 1;
    best = brighter(best, cloudOver(hRgb, scale(cloudLit(m), base), clouds, cloudLight(m)));
  }
  // Fog: base desaturated 60%, × 1.19, at alpha fog · smoothstep(.35, 1, p) · (0.55, rising to 0.85 where the land
  // begins: about 85% down the viewport with the fixed band).
  const fy = m.fog * smoothstep(0.35, 1, p) * (0.55 + 0.3 * smoothstep(0.45, 1, Math.min(1, y / 0.85)));
  if (fy > 0) {
    const l = luma(base);
    best = brighter(
      best,
      over(hRgb, gam(scale(base.map((v) => l + (v - l) * 0.4) as RGB, 1.19)), fy),
    );
  }
  return best;
}

const mixRgb = (p: RGB, q: RGB, t: number): RGB => p.map((v, i) => v + (q[i]! - v) * t) as RGB;

/**
 * The lit colour of the clouds under this sky, as the shader has it: daylight's while the sun is above 2°, fading
 * out of them to the horizon colour × 1.2 by 6° under (a cloud after sunset is lit by the sky, not the sun), and at
 * night moonlight and the town's glow (the shader's `city`, at its most: a low deck's near the horizon). Golden hour (the horizon colour × 1.52) only while it is
 * still daylight. The brightest of these is counted, whatever the clouds do with it.
 */
function cloudLit(m: SkyInput): RGB {
  const e = m.astro.elevation;
  const twilight = smoothstep(-6, -2, e);
  const H = lin(oklabToRgb(m.colors.horizon));
  const moon = scale(lin(hexToRgb(MOONLIGHT)), 0.35 + 0.65 * (m.astro.moon?.fraction ?? 1));
  const city = scale(CITY_ON_CLOUD, 0.07);
  const night = moon.map((v, i) => v + city[i]!) as RGB;
  let lit = brighter(mixRgb(scale(H, 1.2), lin(hexToRgb(CLOUD_LIT)), twilight), night);
  if (m.glow * twilight > 0) lit = brighter(lit, scale(H, 1.521));
  return lit;
}

/**
 * How much of its lit colour a cloud can show. The shader's shade() is Lambert on the cloud's normal plus the
 * Henyey–Greenstein phase (g 0.65) toward the light, both × the light's strength (SkyRenderer's light(): the sun's
 * while it has any, else the moon's, else a quarter on a moonless night), and by moonlight only the edge that faces
 * the moon. Counted at its most: a normal facing the light, and the phase 45° from it (closer than that is the sun's
 * or the moon's own neighbourhood, which the disc and its glow cover).
 */
function cloudLight(m: SkyInput): number {
  const e = m.astro.elevation;
  const sun = smoothstep(-6, -1.5, e);
  const moon = m.astro.moon;
  const strength = Math.max(sun, moon && moon.altitudeDeg > 0 ? 0.35 + 0.65 * moon.fraction : 0.25 * (1 - sun));
  return strength * (0.7 - 0.42 * smoothstep(-6, -14, e) + 0.6 * 0.12);
}

/**
 * A cloud sheet over the sky at presence `p` (its density × alpha, 0..1), at most `k` lit: lit × k ×
 * (0.35 + 0.65·exp(−τ·2.2)), τ = density × thickness, at the LOW sheet's thickness and alpha (clouds.ts SHEET.low:
 * a thin edge lets more light through than a thick core, so brightness per unit of presence peaks at its edge).
 */
export function cloudOver(hRgb: RGB, lit: RGB, p: number, k = 1): RGB {
  return over(hRgb, gam(scale(lit, k * (0.35 + 0.65 * Math.exp(-((2.2 * 1.6) / 0.95) * p)))), p);
}

/** The sun as the particle layer draws it (bodies.ts): disc radius, the cloud's optical depth in front of it, and
 *  whether it is under a deck (no disc, a diffuse bright patch). */
export type SunDisc = { x: number; y: number; r: number; alt: number; tau: number; deck: boolean; fog: number };
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
/** The bloom sprite's alpha at its centre, its three blooms stacked (bodies.ts BLOOM_PEAK). */
export const BLOOM_PEAK = 1 - (1 - 0.35) * (1 - 0.12) * (1 - 0.05);
/**
 * The sun's diffuse patch under a deck: its radius as a share of the viewport width, its alpha at the centre, and how
 * fast a deck thins it. The brief had exp(−τ); under an overcast deck (τ ≈ 1.4) that is 3%, which measured as
 * rgb(72,80,93) at the sun against rgb(71,78,91) beside it: nothing. τ / 3 reads as a soft bright patch (DECISIONS).
 */
export const SUN_PATCH = { radius: 0.22, alpha: 0.12, thin: 3 } as const;
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
const distTo = (b: Box, x: number, y: number) =>
  Math.hypot(Math.max(b.x0 - x, 0, x - b.x1), Math.max(b.y0 - y, 0, y - b.y1));

/** The sun's disc and blooms over `bg` at distance d from its centre (bodies.ts: 3×, 8×, 20× r at .35, .12, .05). */
export function sunOver(bg: RGB, s: SunDisc, d: number, vw: number): RGB {
  const fade = smoothstep(-0.9, 0.6, s.alt);
  if (fade <= 0) return bg;
  const col = sunColor(s.alt);
  const bloom = (radius: number) => {
    let a = 0;
    for (const [k, ak] of [
      [20, 0.05],
      [8, 0.12],
      [3, 0.35],
    ] as const)
      a = 1 - (1 - a) * (1 - ak * profile(d / (k * radius)));
    return a;
  };
  if (s.deck || s.fog >= 0.9) {
    // No disc: a diffuse bright patch, the bloom sprite's shape out to SUN_PATCH.radius of the viewport width,
    // at SUN_PATCH.alpha × exp(−τ / SUN_PATCH.thin) in its centre.
    // In fog the patch is whole (no cloud to thin it).
    const a = ((s.fog >= 0.9 ? SUN_PATCH.alpha : SUN_PATCH.alpha * Math.exp(-s.tau / SUN_PATCH.thin)) * (bloom(SUN_PATCH.radius * vw / 20) / BLOOM_PEAK)) * fade;
    return a > 0.0005 ? over(bg, col, a) : bg;
  }
  const c = 1 - Math.exp(-s.tau);
  let out = over(bg, col, Math.min(1, bloom(s.r * (1 + 0.6 * c)) * (1 - 0.75 * c) * fade));
  if (d < s.r) {
    const disc = Math.exp(-1.8 * s.tau) * (1 - 0.5 * s.fog);
    out = over(out, col, (s.fog >= 0.9 ? Math.min(0.6, disc) : disc) * fade);
  }
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

/** The night city glow: CITY_GLOW at `alpha` at and below the horizon, fading to 0 at `reach` px above it. */
export type CityGlow = { horizonY: number; reach: number; alpha: number };
const GLOW_RGB = hexToRgb(CITY_GLOW);
export const GLOW_MARGIN = 1.3;
export function cityGlowOver(bg: RGB, g: CityGlow, y: number): RGB {
  if (g.alpha <= 0) return bg;
  const t = 1 - Math.min(1, Math.max(0, (g.horizonY - y) / g.reach));
  // × GLOW_MARGIN: the canvas composites the glow a little brighter than this model (pixel gate, 21:00 thunder).
  return t > 0 ? over(bg, GLOW_RGB, Math.min(1, g.alpha * t * GLOW_MARGIN)) : bg;
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
  /** The horizon, viewport px (src/lib/sky/horizon.ts); the viewport bottom when absent. */
  horizon?: Horizon;
};

/**
 * What a landscape band shows at viewport y, when it's solid: the river (its sky reflection is the brightest thing
 * below the far bank) or the near bank. Above the far bank silhouettes come and go, so the sky counts there.
 */
function landAt(s: Scene, y: number): RGB | null {
  for (const l of s.lands ?? []) {
    const u = ((y - l.top) / l.h) * 100;
    if (u >= 89 && u <= 100)
      return oklabToRgb(
        groundColor({ horizon: s.m.colors.horizon, k: sunLight(s.m.astro.elevation) }),
      );
    if (u >= RIVER[0] && u < 89) return oklabToRgb(riverColor(s.m.colors.horizon));
  }
  return null;
}

/** Horizontal margin (px) for cloud lookups: about a minute of drift at the minimum speed. */
export const CLOUD_MARGIN = 300;

/** The brightest background the sky can put behind a box (viewport px). */
export function backgroundFor(s: Scene, b: Box): RGB {
  const clouds = s.cloudsIn
    ? Math.max(
        0,
        s.cloudsIn({ x0: b.x0 - CLOUD_MARGIN, y0: b.y0, x1: b.x1 + CLOUD_MARGIN, y1: b.y1 }),
      )
    : undefined;
  let best: RGB = [0, 0, 0];
  const n = Math.max(2, Math.min(6, Math.ceil((b.y1 - b.y0) / 24)));
  const hz = s.horizon ? { h: s.horizon.h / s.vh, b: s.horizon.b / s.vh } : FLAT;
  for (let i = 0; i <= n; i++) {
    const y = b.y0 + ((b.y1 - b.y0) * i) / n;
    const land = landAt(s, y);
    let c = land ?? skyAt(s.m, y / s.vh, clouds ?? cloudPresence(s.m.cloudCover), hz);
    if (!land) for (const g of s.glows) c = cityGlowOver(c, g, y);
    best = brighter(best, c);
  }
  if (s.moon) best = moonOver(best, s.moon, distTo(b, s.moon.x, s.moon.y));
  if (s.sun) best = sunOver(best, s.sun, distTo(b, s.sun.x, s.sun.y), s.vw);
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
