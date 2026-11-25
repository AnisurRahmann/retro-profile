/**
 * The landscape band at the bottom of the viewport (fixed, 18vh desktop / 14svh mobile, 110–200 px): four
 * flat silhouette layers walked past by scrolling (src/lib/sky/landscape). Each layer's visible strip (plus
 * PAD px each side) is pre-rendered into a bitmap; a frame only translates the bitmaps (parallax) and draws the
 * small night lights, so scrolling never re-runs paths. A strip is re-rendered when the walk leaves its padding,
 * when the light changes (at most every 2 s; ≤ 30 fps while scrubbing) and on resize.
 *
 * Colour: each layer = mix(horizon, near, depth) in OKLab with depths 0.25 / 0.45 / 0.7 / 0.95, near = --ink
 * darkened 15%. Golden hour: a 1 px rim along the top of L2–L4 in the horizon colour at 50%, brightest toward
 * the sun.
 */
import { brand } from "@/lib/brand";
import { hexToLab, hexToRgb, mixLab, oklabToRgb, type Lab, type RGB } from "@/lib/sky/color";
import { layerColor, riverColor } from "@/lib/sky/landscape/colors";
import { PARALLAX, type LayerId } from "@/lib/sky/landscape/anchors";
import { BANK_Y, RIVER } from "@/lib/sky/landscape/shapes";
import { CITY_GLOW } from "@/lib/sky/palette";
import { ridgeL1, ridgeL2, ridgeL4, type Placed, type World } from "@/lib/sky/landscape/world";
import type { Shape } from "@/lib/sky/landscape/shapes";

const PAD = 256;
/** Transparent headroom above the band, for the plane climbing out. */
export const LIFT = 120;
/** The city glow's horizon in band units: the foot of the far hills (L1's ridge averages 34). */
export const GLOW_HORIZON = 50;
const LAYERS: LayerId[] = ["L1", "L2", "L3", "L4"];
export { DEPTH, layerColor, NEAR, riverColor } from "@/lib/sky/landscape/colors";

/** Band height for a viewport: 18vh desktop, 14svh mobile, clamped to 110–200 px (CSS mirrors it). */
export { bandHeight } from "@/lib/sky/landscape/anchors";

const css = (c: RGB, a = 1) => `rgba(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)},${a})`;

type Paths = { fill: Path2D | null; strokes: [Path2D, number][]; cuts: [Path2D, number, number | undefined][] };

export type Lighting = {
  horizon: Lab;
  /** Rim strength 0..1 (golden hour). */
  rim: number;
  /** Sun x on screen (px) for the rim's falloff. */
  sunX: number;
  /** Night 0..1. */
  night: number;
  /** City glow (sodium) at the horizon, alpha (cityGlowAlpha), and its reach above the horizon in px. */
  glow: number;
  glowReach: number;
  /** Moonlight rim strength (0.3 × illumination while the moon is up) and the moon's screen x. */
  moonRim: number;
  moonX: number;
};

/**
 * @param lift transparent headroom above the band (px).
 * @param fadeBottom the bottom this many px fade out (the stage scene).
 */
export function createLandscape(canvas: HTMLCanvasElement, lift = LIFT, fadeBottom = 0) {
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
  let light: Lighting = { horizon: hexToLab(brand.ink), rim: 0, sunX: 0, night: 0, glow: 0, glowReach: 0, moonRim: 0, moonX: 0 };
  const glowRgb = hexToRgb(CITY_GLOW);
  const moonLab = hexToLab(brand.text);
  let lightKey = "";
  const colors = {} as Record<LayerId, string>;
  let river = "rgba(0,0,0,1)";

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

  const ridge = (layer: LayerId) => (layer === "L1" ? ridgeL1 : layer === "L2" ? ridgeL2 : layer === "L4" ? ridgeL4 : null);

  /** Everything solid on a layer between world units x0 and x1, in one style. */
  const solid = (g: CanvasRenderingContext2D, layer: LayerId, x0: number, x1: number, style: string | CanvasGradient) => {
    g.fillStyle = style;
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

  /** Punch-outs: tea rows on L2 (fine scallops following the mounds), the clock face. */
  const cuts = (g: CanvasRenderingContext2D, layer: LayerId, x0: number, x1: number) => {
    g.globalCompositeOperation = "destination-out";
    g.strokeStyle = "#000";
    if (layer === "L2") {
      g.lineWidth = 0.45;
      g.globalAlpha = 0.32;
      g.beginPath();
      for (let j = 0; j < 6; j++) {
        const off = 3 + j * 3.3;
        let x = Math.floor(x0 / 3) * 3;
        g.moveTo(x, ridgeL2(x) + off);
        for (; x <= x1; x += 3) g.quadraticCurveTo(x + 1.5, ridgeL2(x + 1.5) + off - 1.1, x + 3, ridgeL2(x + 3) + off);
      }
      g.stroke();
    }
    for (const it of world!.layers[layer]) {
      if (!it.shape.cut || it.x + it.shape.x1 * it.k < x0 || it.x + it.shape.x0 * it.k > x1) continue;
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
    // Rim: golden hour (the horizon colour at 50%, brightest toward the sun) or moonlight (the moon's colour at
    // 0.3 × illumination, on the moon's side): the layer in the rim colour, then the body 1 px lower.
    const moon = light.rim <= 0.02 && light.moonRim > 0.02;
    if ((light.rim > 0.02 || moon) && layer !== "L1") {
      const base = layerColor(light.horizon, layer);
      const tint = moon ? moonLab : light.horizon;
      const k = moon ? light.moonRim : 0.5 * light.rim;
      const hi = oklabToRgb(mixLab(base, tint, k));
      const lo = oklabToRgb(mixLab(base, tint, moon ? 0 : 0.15 * light.rim));
      const sunU = ((moon ? light.moonX : light.sunX) + offsetPx) / s;
      const span = w / s;
      const grad = g.createLinearGradient(sunU - span, 0, sunU + span, 0);
      grad.addColorStop(0, css(lo));
      grad.addColorStop(0.5, css(hi));
      grad.addColorStop(1, css(lo));
      solid(g, layer, x0, x1, grad);
      g.save();
      g.translate(0, 1 / s);
      solid(g, layer, x0, x1, body);
      g.restore();
    } else solid(g, layer, x0, x1, body);
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
      canvas.height = Math.round((H + lift) * dpr);
      world = wd;
      for (const l of LAYERS) strips[l].x0 = Number.NaN;
    },
    /** New light: recolours (re-renders) the strips when it has changed enough. */
    setLighting(l: Lighting) {
      light = l;
      const key = `${l.horizon.map((v) => Math.round(v * 200)).join()}|${Math.round(l.rim * 20)}|${Math.round(l.sunX / 40)}|${Math.round(l.night * 20)}|${Math.round(l.moonRim * 40)}|${Math.round(l.moonX / 40)}`;
      if (key === lightKey) return false;
      lightKey = key;
      for (const layer of LAYERS) colors[layer] = css(oklabToRgb(layerColor(l.horizon, layer)));
      river = css(oklabToRgb(riverColor(l.horizon)));
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
     * is at screen x · s − offset.
     */
    draw(walk: number, between: (g: CanvasRenderingContext2D, layer: LayerId | "river", offset: number) => void) {
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
        if (!(o >= st.x0 + 8 && o + w <= st.x0 + w + 2 * PAD - 8) || st.key !== lightKey) renderStrip(layer, o);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(st.c, Math.round((st.x0 - o) * dpr), Math.round(lift * dpr));
        ctx.setTransform(dpr, 0, 0, dpr, 0, lift * dpr);
        if (layer === "L2") {
          // The Surma: a band across the whole width, in front of the tea hills and behind the town's bank.
          ctx.fillStyle = river;
          ctx.fillRect(0, RIVER[0] * world.s, w, (RIVER[1] - RIVER[0]) * world.s);
          // A darker band along the far bank: the bank's reflection.
          ctx.fillStyle = colors.L3;
          ctx.globalAlpha = 0.45;
          ctx.fillRect(0, RIVER[0] * world.s, w, 2.2 * world.s);
          ctx.globalAlpha = 1;
          between(ctx, "river", walk * PARALLAX.L3);
        }
        between(ctx, layer, o);
      }
      if (fadeBottom > 0) {
        // The stage scene ends where the page goes on: its ground fades out instead of stopping on a hard line.
        const y1 = canvas.height;
        const y0 = y1 - fadeBottom * dpr;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        const fg = ctx.createLinearGradient(0, y0, 0, y1);
        fg.addColorStop(0, "rgba(0,0,0,0)");
        fg.addColorStop(1, "rgba(0,0,0,1)");
        ctx.globalCompositeOperation = "destination-out";
        ctx.fillStyle = fg;
        ctx.fillRect(0, y0, canvas.width, y1 - y0);
        ctx.globalCompositeOperation = "source-over";
      }
    },
    /** Re-render every strip now (the light changed while scrubbing). */
    invalidate() {
      for (const l of LAYERS) strips[l].key = "";
    },
    placedOn: (layer: LayerId): Placed[] => world?.layers[layer] ?? [],
    colorOf: (layer: LayerId) => colors[layer] ?? "rgba(0,0,0,1)",
  };
}

export type Landscape = NonNullable<ReturnType<typeof createLandscape>>;
