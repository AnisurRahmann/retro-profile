/**
 * The landscape band at the bottom of the viewport (fixed, 18vh desktop / 14svh mobile, 110–200 px): four
 * flat silhouette layers walked past by scrolling (src/lib/sky/landscape). Each layer's visible strip (plus
 * PAD px each side) is pre-rendered into a bitmap; a frame only translates the bitmaps (parallax) and draws the
 * small night lights, so scrolling never re-runs paths. A strip is re-rendered when the walk leaves its padding,
 * when the light changes (at most every 2 s; ≤ 30 fps while scrubbing) and on resize.
 *
 * Colour: each layer = mix(horizon, near, depth) in OKLab with depths 0.25 / 0.45 / 0.7 / 0.95, near = --ink
 * darkened 15%. Golden hour: a 1 px rim along the top of L2–L4 in the horizon colour at 50%, brightest toward
 * the sun. Moonlight (while the moon is up and the sun's rim is off): a 1 px rim along the top of every layer,
 * the far hills included, in MOON_RIM at 0.3 × illumination, brightest toward the moon (v5.1 T4).
 */
import { brand } from "@/lib/brand";
import {
  hexToLab,
  hexToRgb,
  mixLab,
  oklabToRgb,
  over,
  scaleL,
  type Lab,
  type RGB,
} from "@/lib/sky/color";
import {
  groundColor,
  layerColorLit,
  riverColor,
  teaRowColor,
} from "@/lib/sky/landscape/colors";
import { PARALLAX, type LayerId } from "@/lib/sky/landscape/anchors";
import { BANK_Y, RIVER } from "@/lib/sky/landscape/shapes";
/** The 1px glint's line, band units: just above the near bank's lowest point (ridgeL4 ≥ 87.2). */
const GLINT_Y = 87.4;
import { CITY_GLOW, LIGHTNING_RIM, MOON_RIM } from "@/lib/sky/palette";
import { ridgeL1, ridgeL2, ridgeL4, type Placed, type World } from "@/lib/sky/landscape/world";
import type { Shape } from "@/lib/sky/landscape/shapes";

const PAD = 256;
/** Transparent headroom above the band, for the plane climbing out. */
export const LIFT = 120;
/** The city glow's horizon in band units: the foot of the far hills (L1's ridge averages 34). */
export const GLOW_HORIZON = 50;
const LAYERS: LayerId[] = ["L1", "L2", "L3", "L4"];
export { layerColor, riverColor } from "@/lib/sky/landscape/colors";

/** Band height for a viewport: 18vh desktop, 14svh mobile, clamped to 110–200 px (CSS mirrors it). */
export { bandHeight } from "@/lib/sky/landscape/anchors";

const css = (c: RGB, a = 1) =>
  `rgba(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)},${a})`;

type Paths = {
  fill: Path2D | null;
  strokes: [Path2D, number][];
  cuts: [Path2D, number, number | undefined][];
};

export type Lighting = {
  horizon: Lab;
  /** Lightness multiplier (colors.ts sunLight) and the far hills' golden-hour wash (≤ 0.18). */
  k: number;
  wash: number;
  /** Rim strength 0..1 (golden hour). */
  rim: number;
  /** Sun x on screen (px) for the rim's falloff. */
  sunX: number;
  /** Night 0..1. */
  night: number;
  /** City glow (sodium) at the horizon, alpha (cityGlowAlpha), and its reach above the horizon in px. */
  glow: number;
  glowReach: number;
  /** Moonlight rim strength: the alpha of MOON_RIM along the layer's top edge (0.3 × illumination while the moon is
   * up), and the moon's screen x. */
  moonRim: number;
  moonX: number;
};

/** Heavy rain: how far the far hills (0.6) and the tea hills (0.35) fade into the sky's colour (W3). */
export const VEIL = { L1: 0.6, L2: 0.35 } as const;

/**
 * @param lift transparent headroom above the band (px).
 * @param fade the scenes' ground runs on below the band and fades into the sky over this many px (GROUND_FADE).
 */
export function createLandscape(canvas: HTMLCanvasElement, lift = LIFT, fade = 0) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const cache = new Map<Shape, Paths>();
  const strips = Object.fromEntries(
    LAYERS.map((l) => [l, { c: document.createElement("canvas"), x0: Number.NaN, key: "" }]),
  ) as Record<LayerId, { c: HTMLCanvasElement; x0: number; key: string }>;
  let world: World | null = null;
  let w = 1,
    H = 1,
    dpr = 1;
  let light: Lighting = {
    horizon: hexToLab(brand.ink),
    k: 1,
    wash: 0,
    rim: 0,
    sunX: 0,
    night: 0,
    glow: 0,
    glowReach: 0,
    moonRim: 0,
    moonX: 0,
  };
  const glowRgb = hexToRgb(CITY_GLOW);
  const moonRgb = hexToRgb(MOON_RIM);
  let lightKey = "";
  const colors = {} as Record<LayerId, string>;
  let river = "rgba(0,0,0,1)";
  /** The near ground under L4's things (L4 lifted +3% L, so palms and posts read against it) and the water's edge. */
  let ground: RGB = [0, 0, 0];
  let glint = "rgba(0,0,0,0)";
  let rows = "rgba(0,0,0,0)";
  /** The airport's tones: tarmac (the ground a shade lighter), the rim light, the glass's sky reflection. */
  const tones = { tarmac: "rgba(0,0,0,1)", rim: "rgba(0,0,0,1)", glass: "rgba(0,0,0,1)" };

  const paths = (s: Shape): Paths => {
    let p = cache.get(s);
    if (!p) {
      p = {
        fill: s.fill ? new Path2D(s.fill) : null,
        strokes: (s.stroke ?? []).filter((k) => k.d).map((k) => [new Path2D(k.d), k.width]),
        cuts: (s.cut ?? []).map((k) => [new Path2D(k.d), k.alpha, k.width]),
      };
      cache.set(s, p);
    }
    return p;
  };

  const ridge = (layer: LayerId) =>
    layer === "L1" ? ridgeL1 : layer === "L2" ? ridgeL2 : layer === "L4" ? ridgeL4 : null;

  /** Everything solid on a layer between world units x0 and x1, in one style (L4's ground in `ridgeStyle`). */
  const solid = (
    g: CanvasRenderingContext2D,
    layer: LayerId,
    x0: number,
    x1: number,
    style: string | CanvasGradient,
    ridgeStyle = style,
  ) => {
    g.fillStyle = ridgeStyle;
    g.strokeStyle = style;
    const r = ridge(layer);
    if (r) {
      g.beginPath();
      g.moveTo(x0, 101);
      for (let x = x0; x <= x1 + 2; x += 2) g.lineTo(x, r(x));
      g.lineTo(x1 + 2, 101);
      g.closePath();
      g.fill();
    }
    g.fillStyle = style;
    if (layer === "L3") g.fillRect(x0, 68.5, x1 - x0, RIVER[0] + 0.5 - 68.5); // the far bank under the town
    for (const it of world!.layers[layer]) {
      if (it.x + it.shape.x1 * it.k < x0 || it.x + it.shape.x0 * it.k > x1) continue;
      const p = paths(it.shape);
      g.save();
      g.translate(it.x, it.y + it.base * (1 - it.k));
      if (it.k !== 1) g.scale(it.k, it.k);
      if (p.fill) g.fill(p.fill);
      for (const [sp, lw] of p.strokes) {
        g.lineWidth = lw;
        g.lineCap = "round";
        g.stroke(sp);
      }
      g.restore();
    }
  };

  /**
   * Tea bush rows on L2: scalloped rows following the mounds' contour, 6px apart (5–7 with the scallops), a little
   * lighter than the hill. Drawn, not punched out, so the sky never shows through the gardens.
   */
  const teaRows = (g: CanvasRenderingContext2D, x0: number, x1: number) => {
    const s = world!.s;
    const gap = 6 / s;
    const bump = 2.2 / s;
    const step = Math.max(2.5, 7 / s);
    g.strokeStyle = rows;
    g.lineWidth = 1.6 / s;
    g.lineCap = "round";
    g.beginPath();
    for (let j = 0; j < 7; j++) {
      const off = 2.2 + j * gap;
      let x = Math.floor(x0 / step) * step + (j % 2) * step * 0.5;
      g.moveTo(x, ridgeL2(x) + off);
      for (; x <= x1; x += step)
        g.quadraticCurveTo(
          x + step / 2,
          ridgeL2(x + step / 2) + off - bump,
          x + step,
          ridgeL2(x + step) + off,
        );
    }
    g.stroke();
  };

  /** Punch-outs: the clock face. */
  const cuts = (g: CanvasRenderingContext2D, layer: LayerId, x0: number, x1: number) => {
    g.globalCompositeOperation = "destination-out";
    g.strokeStyle = "#000";
    for (const it of world!.layers[layer]) {
      if (!it.shape.cut || it.x + it.shape.x1 * it.k < x0 || it.x + it.shape.x0 * it.k > x1)
        continue;
      g.save();
      g.translate(it.x, it.y + it.base * (1 - it.k));
      if (it.k !== 1) g.scale(it.k, it.k);
      for (const [cp, a, lw] of paths(it.shape).cuts) {
        g.globalAlpha = a;
        if (lw) {
          g.lineWidth = lw;
          g.stroke(cp);
        } else g.fill(cp);
      }
      g.restore();
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
  };

  /** Heavy rain veils the far hills and the tea hills: the sky's own colour over them (VEIL), after each strip. */
  const veilOver = (layer: LayerId, k: number) => {
    if (k <= 0.003) return;
    ctx.globalAlpha = VEIL[layer as keyof typeof VEIL] * k;
    ctx.fillStyle = css(oklabToRgb(light.horizon));
    ctx.fillRect(0, -lift, w, H + lift);
    ctx.globalAlpha = 1;
  };

  /**
   * Lightning: a 1px rim of LIGHTNING_RIM along a layer's top edge. The strip minus itself a pixel lower is that
   * edge; tinted and drawn back over the layer at `k` × 0.6. Only while a bolt is up.
   */
  const rimCanvas = document.createElement("canvas");
  const boltRim = (st: { c: HTMLCanvasElement; x0: number }, o: number, k: number) => {
    const oc = rimCanvas;
    if (oc.width !== st.c.width || oc.height !== st.c.height) {
      oc.width = st.c.width;
      oc.height = st.c.height;
    }
    const og = oc.getContext("2d")!;
    og.setTransform(1, 0, 0, 1, 0, 0);
    og.globalCompositeOperation = "source-over";
    og.clearRect(0, 0, oc.width, oc.height);
    og.drawImage(st.c, 0, 0);
    og.globalCompositeOperation = "destination-out";
    og.drawImage(st.c, 0, dpr);
    og.globalCompositeOperation = "source-in";
    og.fillStyle = css(hexToRgb(LIGHTNING_RIM));
    og.fillRect(0, 0, oc.width, oc.height);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 0.6 * k;
    ctx.drawImage(oc, Math.round((st.x0 - o) * dpr), Math.round(lift * dpr));
    ctx.globalAlpha = 1;
  };

  const renderStrip = (layer: LayerId, offsetPx: number) => {
    if (!world) return;
    const st = strips[layer];
    const s = world.s;
    const x0Px = offsetPx - PAD;
    const sw = w + 2 * PAD;
    if (st.c.width !== Math.round(sw * dpr) || st.c.height !== Math.round(H * dpr)) {
      st.c.width = Math.round(sw * dpr);
      st.c.height = Math.round(H * dpr);
    }
    const g = st.c.getContext("2d")!;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, st.c.width, st.c.height);
    g.setTransform(s * dpr, 0, 0, s * dpr, -x0Px * dpr, 0);
    const x0 = x0Px / s;
    const x1 = (x0Px + sw) / s;
    const body = colors[layer];
    // Rim: golden hour (the horizon colour at 50%, brightest toward the sun) or moonlight (MOON_RIM at
    // 0.3 × illumination over the layer, brightest toward the moon; the far hills too, so their outline reads
    // against the night sky): the layer in the rim colour, then the body 1 px lower.
    const moon = light.rim <= 0.02 && light.moonRim > 0.02;
    if ((light.rim > 0.02 || moon) && (moon || layer !== "L1")) {
      // Golden-hour light is this rim only: 1px of the horizon colour at 0.55 on the sun's side.
      const base = layerColorLit(light, layer);
      const lo = oklabToRgb(base);
      const hi = moon
        ? over(lo, moonRgb, light.moonRim)
        : oklabToRgb(mixLab(base, light.horizon, 0.55 * light.rim));
      const sunU = ((moon ? light.moonX : light.sunX) + offsetPx) / s;
      const span = w / s;
      const grad = g.createLinearGradient(sunU - span, 0, sunU + span, 0);
      grad.addColorStop(0, css(lo));
      grad.addColorStop(0.5, css(hi));
      grad.addColorStop(1, css(lo));
      solid(g, layer, x0, x1, grad);
      g.save();
      g.translate(0, 1 / s);
      solid(g, layer, x0, x1, body, layer === "L4" ? css(ground) : body);
      g.restore();
    } else solid(g, layer, x0, x1, body, layer === "L4" ? css(ground) : body);
    if (layer === "L2") teaRows(g, x0, x1);
    cuts(g, layer, x0, x1);
    st.x0 = x0Px;
    st.key = lightKey;
  };

  return {
    get height() {
      return H;
    },
    get world() {
      return world;
    },
    /** @param h the band height (the canvas is LIFT px taller). */
    resize(vw: number, h: number, wd: World) {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = vw;
      H = h;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round((H + lift + fade) * dpr);
      world = wd;
      for (const l of LAYERS) strips[l].x0 = Number.NaN;
    },
    /** New light: recolours (re-renders) the strips when it has changed enough. */
    setLighting(l: Lighting) {
      light = l;
      const key = `${l.horizon.map((v) => Math.round(v * 200)).join()}|${Math.round(l.k * 100)}|${Math.round(l.wash * 100)}|${Math.round(l.rim * 20)}|${Math.round(l.sunX / 40)}|${Math.round(l.night * 20)}|${Math.round(l.moonRim * 40)}|${Math.round(l.moonX / 40)}`;
      if (key === lightKey) return false;
      lightKey = key;
      for (const layer of LAYERS) colors[layer] = css(oklabToRgb(layerColorLit(l, layer)));
      rows = css(oklabToRgb(teaRowColor(l)));
      const l3 = layerColorLit(l, "L3");
      tones.tarmac = css(oklabToRgb([Math.min(1, l3[0] + 0.07), l3[1], l3[2]]));
      tones.rim = css(oklabToRgb(mixLab(l3, l.horizon, 0.55)));
      tones.glass = css(oklabToRgb(l.horizon));
      river = css(oklabToRgb(riverColor(l.horizon)));
      ground = oklabToRgb(groundColor(l));
      glint = css(oklabToRgb(scaleL(riverColor(l.horizon), 0.12)), 0.7);
      return true;
    },
    /** Screen x of a world-unit point on a layer at this walk (0 under reduced motion). */
    toScreen(layer: LayerId, xU: number, walk: number) {
      return xU * (world?.s ?? 1) - walk * PARALLAX[layer];
    },
    get lift() {
      return lift;
    },
    /**
     * Draw the band. `between(g, layer, offset)` runs after each layer (night lights, fireflies, the rickshaw,
     * reflections) with the context in CSS px, origin at the band's top-left; a world-unit point x on that layer
     * is at screen x · s − offset. `veil` (0..1) is the heavy rain's veil over the far hills and the tea hills;
     * `rim` (0..1) the lightning on every silhouette's top edge.
     */
    draw(
      walk: number,
      between: (g: CanvasRenderingContext2D, layer: LayerId | "river", offset: number) => void,
      veil = 0,
      rim = 0,
    ) {
      if (!world) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (light.glow > 0.003) {
        // Light pollution behind the skyline: sodium at the horizon (where the land meets the sky, the foot of the
        // far hills), fading to 0 glowReach px above, and level below it down to the bank. The silhouettes read
        // as dark shapes against it.
        const horizon = (lift + GLOW_HORIZON * world.s) * dpr;
        const bank = (lift + BANK_Y * world.s) * dpr;
        const top = Math.max(0, horizon - light.glowReach * dpr);
        const g = ctx.createLinearGradient(0, top, 0, horizon);
        g.addColorStop(0, css(glowRgb, 0));
        g.addColorStop(1, css(glowRgb, light.glow));
        ctx.fillStyle = g;
        ctx.fillRect(0, top, canvas.width, horizon - top);
        ctx.fillStyle = css(glowRgb, light.glow);
        ctx.fillRect(0, horizon, canvas.width, bank - horizon);
      }
      for (const layer of LAYERS) {
        const o = walk * PARALLAX[layer];
        const st = strips[layer];
        if (!(o >= st.x0 + 8 && o + w <= st.x0 + w + 2 * PAD - 8) || st.key !== lightKey)
          renderStrip(layer, o);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(st.c, Math.round((st.x0 - o) * dpr), Math.round(lift * dpr));
        ctx.setTransform(dpr, 0, 0, dpr, 0, lift * dpr);
        if (layer === "L1" || layer === "L2") veilOver(layer, veil);
        if (rim > 0.01) {
          boltRim(st, o, rim);
          ctx.setTransform(dpr, 0, 0, dpr, 0, lift * dpr);
        }
        if (layer === "L2") {
          // The Surma: a band across the whole width, in front of the tea hills and behind the town's bank.
          ctx.fillStyle = river;
          ctx.fillRect(0, RIVER[0] * world.s, w, (RIVER[1] - RIVER[0]) * world.s);
          // A darker band along the far bank: the bank's reflection.
          ctx.fillStyle = colors.L3;
          ctx.globalAlpha = 0.45;
          ctx.fillRect(0, RIVER[0] * world.s, w, 2.2 * world.s);
          ctx.globalAlpha = 1;
          // The water's edge: a 1px glint along the near bank (the ground's wavy edge hides parts of it).
          ctx.fillStyle = glint;
          ctx.fillRect(0, Math.round(GLINT_Y * world.s), w, 1);
          between(ctx, "river", walk * PARALLAX.L3);
        }
        between(ctx, layer, o);
      }
      if (fade > 0) {
        // A scene's ground doesn't stop on a line: it runs on under the band and fades into the sky below it
        // (which is the mid colour there, never the horizon's: src/lib/sky/horizon.ts).
        const y0 = (lift + H) * dpr;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        const fg = ctx.createLinearGradient(0, y0, 0, y0 + fade * dpr);
        fg.addColorStop(0, css(ground, 1));
        fg.addColorStop(0.45, css(ground, 0.55));
        fg.addColorStop(1, css(ground, 0));
        ctx.fillStyle = fg;
        ctx.fillRect(0, y0, canvas.width, fade * dpr);
      }
    },
    /** Re-render every strip now (the light changed while scrubbing). */
    invalidate() {
      for (const l of LAYERS) strips[l].key = "";
    },
    placedOn: (layer: LayerId): Placed[] => world?.layers[layer] ?? [],
    colorOf: (layer: LayerId) => colors[layer] ?? "rgba(0,0,0,1)",
    tones,
  };
}

export type Landscape = NonNullable<ReturnType<typeof createLandscape>>;
