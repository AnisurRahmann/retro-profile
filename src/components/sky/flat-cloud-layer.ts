/**
 * The flat cloud layer (Canvas 2D, between the atmosphere at z −3 and the particles at z −2). The model is
 * src/lib/sky/flat-clouds.ts. Each cloud is drawn once into a sprite at min(2, DPR) and placed on whole device
 * pixels per frame; a sprite is drawn again only when its tones or light change (the sky tick, the weather, a scrub
 * at most 10 times a second), when its puffs have breathed (every BREATH_S), or never in a still frame.
 *
 * A sprite is three flat tones, anti-aliased edges and nothing else (no blur, gradient or texture): CAP over the whole
 * silhouette, BODY over the silhouette moved away from the light by 6–10% of the cloud's height (so the cap is left
 * as a crisp crescent on the lit side), BASE as the flat band along its bottom, and at night a 1px moonlit RIM
 * outside the cap. Later tones are drawn source-atop, so every edge is the silhouette's own.
 *
 * Text clearing: a cloud that passes behind loose text ([data-on-sky], the box grown by 28px) is drawn thinner, by
 * the box's clearing factor (backing.ts clearingFor: as much of the cloud as the text can take without a chip),
 * easing back to whole over 36px as it leaves. The whole cloud fades, so its edges stay crisp: a feathered mask
 * left soft, smeared windows in the puffs and dark boxes in a deck. Zones are in document coordinates (the text
 * scrolls, the clouds don't).
 */
import { oklabToRgb, type Lab } from "@/lib/sky/color";
import {
  LAYER,
  breathR,
  cloudsAt,
  flashTones,
  mixTones,
  sdCloud,
  type Cloud,
  type LayerId,
  type Plan,
  type Tones,
} from "@/lib/sky/flat-clouds";

/** How often a breathing cloud is drawn again (s): its radii change ±4% over 20–40 s. */
export const BREATH_S = 0.5;
/** Text clearing: the box grows by `expand`; a cloud eases back to whole over `feather` beyond it (CSS px). */
export const CLEAR = { expand: 28, feather: 36 } as const;
const PAD = 2;

export type Zone = { x0: number; y0: number; x1: number; y1: number; f: number };

export type CloudFrame = {
  plan: Plan;
  off: Record<LayerId, number>;
  /** Seconds, for the breath; null holds every puff (a still frame). */
  t: number | null;
  /** The tones of the sky (unmixed), and the sky's colour at a viewport y (the far and mid layers mix toward it). */
  tones: Tones;
  /** A cumulonimbus's tones (thunder). */
  cbTones: Tones;
  sky: (y: number) => Lab;
  /** The light's place on screen (the sun, the moon or the zenith). */
  light: [number, number];
  /** A sheet flash (viewport px, its radius and strength 0..1) and a bolt's strength 0..1; id changes per strike. */
  flash: { x: number; y: number; r: number; k: number };
  bolt: number;
  strike: number;
  thunder: boolean;
  scrollY: number;
  /** The whole layer's alpha (haze thins it). */
  alpha: number;
};

type Sprite = { c: HTMLCanvasElement | OffscreenCanvas; key: string; base: number; used: number };

const css = (lab: Lab) => {
  const [r, g, b] = oklabToRgb(lab);
  const k = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 255);
  return `rgb(${k(r)},${k(g)},${k(b)})`;
};
const q = (lab: Lab) => lab.map((v) => Math.round(v * 400)).join(",");
/** A cloud's place in the breath cycle (0..1, from its key): clouds are drawn again on different frames. */
const stagger = (key: string) => {
  let x = 0;
  for (let i = 0; i < key.length; i++) x = (x * 31 + key.charCodeAt(i)) >>> 0;
  return (x % 997) / 997;
};

export function createFlatCloudLayer(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  let dpr = 1;
  let w = 0;
  let h = 0;
  let frameNo = 0;
  let lastOp = "";
  const sprites = new Map<string, Sprite>();
  const flashes = new Map<string, Sprite>();
  let flashStrike = -1;
  let shown: Cloud[] = [];
  let shownT: number | null = null;
  /** The text-clearing zones (document px) and the scroll the last frame was drawn at. */
  let zones: Zone[] = [];
  let shownScroll = 0;
  /** How much of a cloud's alpha is left near the zones (1 when it is 36px or more from all of them). */
  const kept = (x0: number, y0: number, x1: number, y1: number, scrollY: number) => {
    let k = 1;
    for (const z of zones) {
      const d = Math.hypot(
        Math.max(z.x0 - CLEAR.expand - x1, 0, x0 - z.x1 - CLEAR.expand),
        Math.max(z.y0 - scrollY - CLEAR.expand - y1, 0, y0 - (z.y1 - scrollY) - CLEAR.expand),
      );
      if (d >= CLEAR.feather) continue;
      const t = d / CLEAR.feather;
      k = Math.min(k, z.f + (1 - z.f) * t * t * (3 - 2 * t));
    }
    return k;
  };
  const keptOf = (c: Cloud, scrollY: number) => kept(c.x, c.base - c.shape.h, c.x + c.shape.w, c.base + c.shape.clip, scrollY);

  const make = (W: number, H: number) => {
    if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(W, H);
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    return c;
  };

  /** A cloud's tones: its layer mixes toward the sky at its height. */
  const tonesOf = (c: Cloud, f: CloudFrame) =>
    c.shape.kind === "cb" ? f.cbTones : mixTones(f.tones, f.sky(c.base - c.shape.h / 2), LAYER[c.shape.layer].mix);

  /** Away from the light, never upward by much: the cap is the cloud's top and its side toward the light. */
  const awayFrom = (c: Cloud, light: [number, number]): [number, number] => {
    const dx = c.x + c.shape.w / 2 - light[0];
    const dy = Math.max(c.base - c.shape.h / 2 - light[1], 0);
    const len = Math.hypot(dx, dy) || 1;
    let ux = dx / len;
    let uy = Math.max(dy / len, 0.35);
    const n = Math.hypot(ux, uy);
    ux /= n;
    uy /= n;
    return [Math.round(ux * 20) / 20, Math.round(uy * 20) / 20];
  };

  const draw1 = (c: Cloud, t: Tones, dir: [number, number], time: number | null) => {
    const s = c.shape;
    const top = s.h + PAD;
    const W = Math.ceil((s.w + 2 * PAD) * dpr);
    const baseRow = Math.ceil(top * dpr);
    const H = baseRow + Math.ceil((s.clip + PAD) * dpr);
    const sp = make(W, H);
    const g = sp.getContext("2d") as CanvasRenderingContext2D | null;
    if (!g) return { c: sp, base: baseRow };
    g.setTransform(dpr, 0, 0, dpr, PAD * dpr, baseRow);
    const path = new Path2D();
    for (const k of s.circles) {
      const r = breathR(k, time);
      path.moveTo(k.x + r, k.y);
      path.arc(k.x, k.y, r, 0, Math.PI * 2);
    }
    for (const b of s.boxes) path.roundRect(b.x, b.y, b.w, b.h, Math.min(b.rad, b.w / 2, b.h / 2));
    // The flat base: nothing below the clip line.
    g.beginPath();
    g.rect(-PAD, -top, s.w + 2 * PAD, top + s.clip);
    g.clip();
    const fill = (color: string, dx = 0, dy = 0) => {
      g.save();
      g.translate(dx, dy);
      g.fillStyle = color;
      g.fill(path);
      g.restore();
    };
    fill(css(t.rim ?? t.cap));
    g.globalCompositeOperation = "source-atop";
    if (t.rim) fill(css(t.cap), dir[0], dir[1]);
    const d = Math.max(1.5, s.capK * s.h);
    fill(css(t.body), dir[0] * d, dir[1] * d);
    g.fillStyle = css(t.base);
    g.fillRect(-PAD, -s.baseK * s.h, s.w + 2 * PAD, s.baseK * s.h + s.clip + PAD);
    return { c: sp, base: baseRow };
  };

  const spriteFor = (store: Map<string, Sprite>, c: Cloud, t: Tones, f: CloudFrame, extra = "") => {
    const dir = awayFrom(c, f.light);
    const breathes = c.shape.kind !== "band";
    const step = f.t === null || !breathes ? null : Math.floor(f.t / BREATH_S + stagger(c.key));
    const key = `${q(t.body)}|${q(t.cap)}|${q(t.base)}|${t.rim ? q(t.rim) : ""}|${dir}|${step ?? "-"}|${extra}`;
    let sp = store.get(c.key);
    if (!sp || sp.key !== key) {
      const r = draw1(c, t, dir, step === null ? null : step * BREATH_S);
      sp = { c: r.c, key, base: r.base, used: frameNo };
      store.set(c.key, sp);
    }
    sp.used = frameNo;
    return sp;
  };

  return {
    resize(cw: number, ch: number) {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = cw;
      h = ch;
      canvas.width = Math.max(1, Math.round(cw * dpr));
      canvas.height = Math.max(1, Math.round(ch * dpr));
      sprites.clear();
      flashes.clear();
    },
    /** Drop every sprite (a new plan). */
    reset() {
      sprites.clear();
      flashes.clear();
      shown = [];
    },
    draw(f: CloudFrame) {
      frameNo++;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = "source-over";
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const clouds = cloudsAt(f.plan, f.off);
      shown = clouds;
      shownT = f.t;
      shownScroll = f.scrollY;
      if (f.strike !== flashStrike) {
        flashes.clear();
        flashStrike = f.strike;
      }
      for (const c of clouds) {
        const t = tonesOf(c, f);
        const sp = spriteFor(sprites, c, t, f);
        const x = Math.round(c.x * dpr) - PAD * dpr;
        const y = Math.round(c.base * dpr) - sp.base;
        // Whole clouds are opaque paper: the haze thins the layer as one (below), never cloud by cloud.
        const a = keptOf(c, f.scrollY);
        ctx.globalAlpha = a;
        ctx.drawImage(sp.c, Math.round(x), y);
        // Lightning: a sheet flash lifts the clouds inside its radius (+25% L), a bolt every cloud (+8%), drawn as
        // the lifted sprite over the cloud at that strength.
        let k = 0;
        if (f.flash.k > 0) {
          const dx = c.x + c.shape.w / 2 - f.flash.x;
          const dy = c.base - c.shape.h / 2 - f.flash.y;
          k = f.flash.k * Math.exp(-((Math.hypot(dx, dy) / Math.max(f.flash.r, 1)) ** 2) * 2.2);
        }
        k = Math.min(1, k + 0.32 * f.bolt);
        if (k > 0.01) {
          const fl = spriteFor(flashes, c, flashTones(t, 0.25, f.thunder), f, `flash${f.strike}`);
          ctx.globalAlpha = a * k;
          ctx.drawImage(fl.c, Math.round(x), y);
        }
      }
      ctx.globalAlpha = 1;
      // The haze thins the layer as one: the canvas's own opacity (no full-screen pass), once it is shown.
      const op = f.alpha.toFixed(2);
      if (op !== lastOp && "ready" in canvas.dataset) {
        canvas.style.opacity = op;
        lastOp = op;
      }
      // Sprites of clouds that have left (or reshaped) go.
      if (frameNo % 30 === 0)
        for (const store of [sprites, flashes]) for (const [k, sp] of store) if (frameNo - sp.used > 30) store.delete(k);
    },
    /** The text-clearing zones, document px. */
    setZones(z: Zone[]) {
      zones = z.filter((k) => k.f < 0.999);
    },
    /**
     * How much of a disc (centre, radius r) the clouds drawn last cover, 0..1: linear across its radius, a far
     * cloud counted half (it is thin with distance and mixed into the sky), the clearing taken into account.
     */
    coverAt(x: number, y: number, r: number, scrollY?: number) {
      let best = 0;
      for (const c of shown) {
        const s = c.shape;
        if (x < c.x - r || x > c.x + s.w + r || y < c.base - s.h - r || y > c.base + s.clip + r) continue;
        const sd = sdCloud(c, x, y, shownT);
        const k = (r > 0 ? Math.min(1, Math.max(0, 0.5 - sd / (2 * r))) : sd <= 0 ? 1 : 0) * (s.layer === "far" ? 0.5 : 1);
        const v = k * keptOf(c, scrollY ?? shownScroll);
        if (v > best) best = v;
      }
      return best;
    },
    get count() {
      return shown.length;
    },
    get size(): [number, number] {
      return [w, h];
    },
  };
}

export type FlatCloudLayer = NonNullable<ReturnType<typeof createFlatCloudLayer>>;
