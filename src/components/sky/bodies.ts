/**
 * The sun, its arc and the moon's extras, drawn on the particle canvas (above the atmosphere).
 *
 * Sun: a limb-darkened disc (edge at 82%) coloured by altitude (palette SUN_HIGH ≥ 30°, SUN_MID at 10°, SUN_LOW at 0°,
 * OKLab), three stacked blooms (3×, 8×, 20× the radius at 0.35, 0.12, 0.05, tinted toward the horizon colour
 * near sunrise and sunset), 24 corona rays turning once per 180 s at 0.06, and a 9 s breathing (bloom × 1 ± 0.04).
 * Cloud in front is the optical depth τ of the cloud sheets at the sun (the CPU cloud field): the disc is
 * exp(−1.8 τ) of itself, thin cloud spreads the bloom (Weather v6). Under a deck (overcast, rain, thunder) there is
 * no disc, no corona and no rays: only a diffuse bright patch where the sun is.
 * Crepuscular rays at golden hour with 0.2 < cover < 0.7: 6–10 faint wedges fanning upward, each as strong as
 * the gap in the cloud field along it (≤ 0.05).
 * Everything is pre-rendered into sprites (rebuilt when the colour moves), so a frame is a handful of drawImage
 * calls and no allocation.
 */
import type { RGB } from "@/lib/sky/color";
import { BLOOM_PEAK, SUN_PATCH } from "@/lib/sky/backing";
import { sunColor } from "@/lib/sky/gradient";
import { mulberry32 } from "./particles";

const rgba = (c: RGB, a: number, k = 1) =>
  `rgba(${Math.round(Math.min(1, c[0] * k) * 255)},${Math.round(Math.min(1, c[1] * k) * 255)},${Math.round(Math.min(1, c[2] * k) * 255)},${a})`;

type Sprite = HTMLCanvasElement;
const sprite = (w: number, h = w): Sprite => {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
};

export type SunState = {
  x: number;
  y: number;
  /** Disc radius, CSS px. */
  r: number;
  alt: number;
  up: boolean;
  /** Horizon glow 0..1 (sunrise/sunset): tints the bloom. */
  glow: number;
  horizon: RGB;
  /** Optical depth of the cloud sheets in front of the sun, 0 (clear) … 2 (a rain deck). */
  tau: number;
  /** Overcast, rain, heavy rain, thunder: no disc, only a diffuse bright patch. */
  deck: boolean;
  fog: number;
  cover: number;
  /** Altitude fade 0..1 (only cloud and altitude change the sun; nothing dims it behind text). */
  dim: number;
};

export function createSun(dpr: () => number) {
  const BLOOM_PX = 0.5; // bloom sprite resolution (it's all soft)
  const rays = mulberry32(24);
  const rayLen = Array.from({ length: 24 }, () => 1.7 + rays() * 1.5);
  let disc: Sprite | null = null;
  let bloom: Sprite | null = null;
  let corona: Sprite | null = null;
  let wedge: Sprite | null = null;
  let key = "";

  const build = (s: SunState) => {
    const d = dpr();
    const col = sunColor(s.alt);
    const tint = Math.min(1, s.glow) * 0.6;
    const bc: RGB = [0, 1, 2].map((i) => col[i]! + (s.horizon[i]! - col[i]!) * tint) as RGB;
    // Disc with limb darkening.
    const R = s.r;
    disc = sprite((2 * R + 4) * d);
    let g = disc.getContext("2d")!;
    g.scale(d, d);
    const c = R + 2;
    let grad = g.createRadialGradient(c, c, 0, c, c, R);
    // A hotter centre, limb-darkened to 82% at the edge.
    const hot: RGB = [0, 1, 2].map((i) => col[i]! + (1 - col[i]!) * 0.35) as RGB;
    grad.addColorStop(0, rgba(hot, 1));
    grad.addColorStop(0.35, rgba(col, 1));
    grad.addColorStop(0.55, rgba(col, 1, 0.97));
    grad.addColorStop(0.85, rgba(col, 1, 0.9));
    grad.addColorStop(1, rgba(col, 1, 0.82));
    g.fillStyle = grad;
    g.beginPath();
    g.arc(c, c, R, 0, Math.PI * 2);
    g.fill();
    // Three blooms, 3×, 8×, 20×.
    const BR = 20 * R;
    bloom = sprite(2 * BR * BLOOM_PX);
    g = bloom.getContext("2d")!;
    g.scale(BLOOM_PX, BLOOM_PX);
    for (const [k, a] of [
      [20, 0.05],
      [8, 0.12],
      [3, 0.35],
    ] as const) {
      // A soft, roughly Gaussian falloff (a hard-edged ring reads as a sticker).
      grad = g.createRadialGradient(BR, BR, 0, BR, BR, k * R);
      grad.addColorStop(0, rgba(bc, a));
      grad.addColorStop(0.35, rgba(bc, a * 0.95));
      grad.addColorStop(0.5, rgba(bc, a * 0.7));
      grad.addColorStop(0.7, rgba(bc, a * 0.32));
      grad.addColorStop(0.85, rgba(bc, a * 0.1));
      grad.addColorStop(1, rgba(bc, 0));
      g.fillStyle = grad;
      g.fillRect(0, 0, 2 * BR, 2 * BR);
    }
    // Corona: 24 soft rays of varied length (drawn at full alpha; 0.06 is applied when compositing).
    const CR = 3.4 * R;
    corona = sprite(2 * CR * d);
    g = corona.getContext("2d")!;
    g.scale(d, d);
    g.translate(CR, CR);
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const L = rayLen[i]! * R;
      const lg = g.createLinearGradient(0, 0, Math.cos(a) * L, Math.sin(a) * L);
      lg.addColorStop(0, rgba(bc, 1));
      lg.addColorStop(1, rgba(bc, 0));
      g.fillStyle = lg;
      g.beginPath();
      const w = 0.09;
      g.moveTo(Math.cos(a - w) * R * 0.9, Math.sin(a - w) * R * 0.9);
      g.lineTo(Math.cos(a) * L, Math.sin(a) * L);
      g.lineTo(Math.cos(a + w) * R * 0.9, Math.sin(a + w) * R * 0.9);
      g.closePath();
      g.fill();
    }
    // Crepuscular wedge: pointing up (−y), fading out along its length.
    wedge = sprite(120, 400);
    g = wedge.getContext("2d")!;
    const wg = g.createLinearGradient(60, 400, 60, 0);
    wg.addColorStop(0, rgba(bc, 1));
    wg.addColorStop(0.5, rgba(bc, 0.4));
    wg.addColorStop(1, rgba(bc, 0));
    g.fillStyle = wg;
    g.beginPath();
    g.moveTo(58, 400);
    g.lineTo(0, 0);
    g.lineTo(120, 0);
    g.lineTo(62, 400);
    g.closePath();
    g.fill();
  };

  return {
    /**
     * @param t seconds (animation clock; 0 under reduced motion)
     * @param rayGap gap in the clouds along a ray at angle a (0 = clouded … 1 = clear), for crepuscular rays
     */
    draw(
      ctx: CanvasRenderingContext2D,
      s: SunState,
      t: number,
      day: number,
      rayGap: (a: number) => number,
    ) {
      if (!s.up || s.dim <= 0.001) return;
      const k = `${Math.round(s.alt)}|${Math.round(s.glow * 20)}|${s.r}|${s.horizon.map((v) => Math.round(v * 40)).join()}|${dpr()}`;
      if (k !== key) {
        build(s);
        key = k;
      }
      const c = 1 - Math.exp(-s.tau);
      // In fog (not in common haze: that keeps its dim disc and corona) the sun is pale, at most 0.6, and rayless:
      // no corona, no crepuscular rays, a diffuse patch only.
      const foggy = s.fog >= 0.9;
      const clear = Math.exp(-1.8 * s.tau) * (1 - 0.5 * s.fog) * s.dim;
      const discA = s.deck ? 0 : foggy ? Math.min(0.6, clear) : clear;
      const breath = 1 + 0.04 * Math.sin((t * Math.PI * 2) / 9);
      const bScale = (1 + 0.6 * c) * (1 + 0.3 * s.fog) * breath;
      const prev = ctx.globalCompositeOperation;
      ctx.globalCompositeOperation = "lighter";
      // Crepuscular rays.
      if (!s.deck && !foggy && s.glow > 0.25 && s.cover > 0.2 && s.cover < 0.7 && wedge) {
        const rng = mulberry32(day * 977);
        const n = 6 + Math.floor(rng() * 5);
        for (let i = 0; i < n; i++) {
          const a = -Math.PI / 2 + (rng() - 0.5) * 2.2; // fanning upward
          const len = 0.22 + rng() * 0.2;
          const alpha = 0.05 * s.glow * rayGap(a) * s.dim;
          if (alpha < 0.002) continue;
          ctx.globalAlpha = alpha;
          ctx.save();
          ctx.translate(s.x, s.y);
          ctx.rotate(a + Math.PI / 2);
          const L = len * ctx.canvas.clientHeight;
          ctx.drawImage(wedge, -L * 0.12, -L, L * 0.24, L);
          ctx.restore();
        }
      }
      if (bloom) {
        // Thin cloud spreads the glow. Under a deck only a diffuse bright patch is left where the sun is: 22% of the
        // viewport wide, at SUN_PATCH.alpha · exp(−τ / SUN_PATCH.thin).
        const B = s.deck || foggy ? SUN_PATCH.radius * ctx.canvas.clientWidth : 20 * s.r * bScale;
        ctx.globalAlpha = foggy
          ? (SUN_PATCH.alpha / BLOOM_PEAK) * s.dim
          : s.deck
            ? ((SUN_PATCH.alpha * Math.exp(-s.tau / SUN_PATCH.thin)) / BLOOM_PEAK) * s.dim
            : Math.min(1, s.dim * (1 - 0.75 * c));
        ctx.drawImage(bloom, s.x - B, s.y - B, 2 * B, 2 * B);
      }
      if (corona && !s.deck && !foggy) {
        const C = 3.4 * s.r * breath;
        ctx.globalAlpha = 0.06 * discA;
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(((t / 180) % 1) * Math.PI * 2);
        ctx.drawImage(corona, -C, -C, 2 * C, 2 * C);
        ctx.restore();
      }
      ctx.globalCompositeOperation = prev;
      if (disc && !s.deck) {
        ctx.globalAlpha = discA;
        const D = s.r + 2;
        ctx.drawImage(disc, s.x - D, s.y - D, 2 * D, 2 * D);
      }
      ctx.globalAlpha = 1;
    },
  };
}

export type Sun = ReturnType<typeof createSun>;

/** The arc: 1px dots (2 on, 7 off) in --text at 9% between the horizon points; the night dip dashed, while scrubbing. */
export function drawArc(
  ctx: CanvasRenderingContext2D,
  day: { x: number; y: number }[],
  night: { x: number; y: number }[],
  text: string,
  nightAlpha: number,
) {
  ctx.strokeStyle = text;
  ctx.lineWidth = 1;
  ctx.lineCap = "round";
  ctx.setLineDash([0.01, 9]);
  ctx.lineWidth = 2;
  // 9%, brightening to 22% while the sky is being scrubbed (the phone's arc handle, the strip, the time-lapse).
  ctx.globalAlpha = 0.09 + 0.13 * nightAlpha;
  ctx.beginPath();
  day.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.stroke();
  if (nightAlpha > 0.005) {
    ctx.setLineDash([5, 7]);
    ctx.lineWidth = 1;
    ctx.lineCap = "butt";
    ctx.globalAlpha = 0.09 * nightAlpha;
    ctx.beginPath();
    night.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
}
