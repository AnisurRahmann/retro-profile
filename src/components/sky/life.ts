/**
 * Night life on the landscape band (drawn between its layers, src/components/sky/landscape.ts):
 * - lit windows (WINDOW_LIT, 1–2 px; 45% lit before 22:00, 10% by 01:00, back on between 05:00 and 06:30, a few
 *   cool white TVs flickering at 0.3 Hz; seeded by date: src/lib/sky/landscape/lights.ts),
 * - lamp posts glowing from sunset to sunrise, the bridge's deck lights mirrored in the river with shimmer,
 * - runway lights in a sequenced chase every 2 s,
 * - the sun's or moon's shimmer column on the river when it's within 12° of the horizon (1 px dashes, lengths
 *   re-jittered at 12 fps, alpha 0.3),
 * - the parked plane, which takes off (3 s, climbing out to the right, red and white nav lights at night) when
 *   "Book 30 min" is hovered or focused with the airport on screen.
 * Sprites are built once; frames allocate nothing.
 */
import { hexToRgb, type RGB } from "@/lib/sky/color";
import type { LayerId } from "@/lib/sky/landscape/anchors";
import { TV_HZ, windowLit, windowSchedule } from "@/lib/sky/landscape/lights";
import { planePath, RIVER } from "@/lib/sky/landscape/shapes";
import type { World } from "@/lib/sky/landscape/world";
import { TV_LIT, WINDOW_LIT } from "@/lib/sky/palette";
import { LIFT } from "./landscape";

const rgba = (c: RGB, a: number) => `rgba(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)},${a})`;
const hash = (a: number, b: number) => {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  return ((h ^ (h >>> 12)) >>> 0) / 4294967296;
};

export const TAKEOFF_S = 3;
/** After a take-off the apron stays empty this long, then the next plane is parked. */
const AWAY_S = 12;

export type LifeFrame = {
  t: number;
  /** Animation on (false under reduced motion: no shimmer, no take-off). */
  moving: boolean;
  w: number;
  world: World;
  /** Minutes past Dhaka midnight of the sky's time, and its date seed (day of year). */
  minutes: number;
  seed: number;
  /** 0 by day … 1 at night: windows. */
  dark: number;
  /** Lamps on (sunset → sunrise) 0..1. */
  lamps: number;
  /** Bodies near the horizon: screen x, strength 0..1 (within 12°), colour. */
  glints: { x: number; k: number; rgb: RGB; r: number }[];
  /** The silhouette colour of L3 (the plane). */
  l3: string;
};

export function createLife(textRgb: RGB) {
  const warm = hexToRgb(WINDOW_LIT);
  const warmCss = rgba(warm, 1);
  const textCss = rgba(textRgb, 1);
  const tvCss = rgba(hexToRgb(TV_LIT), 1);
  const plane = new Path2D(planePath());
  let takeoffAt = -Infinity;
  let lastTakeoff = -Infinity;
  // Lamp glow sprite.
  const glow = document.createElement("canvas");
  glow.width = glow.height = 64;
  {
    const g = glow.getContext("2d")!;
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, rgba(warm, 0.55));
    grad.addColorStop(0.25, rgba(warm, 0.22));
    grad.addColorStop(0.6, rgba(warm, 0.06));
    grad.addColorStop(1, rgba(warm, 0));
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
  }

  const planeAt = (f: LifeFrame, o3: number) => {
    const p = f.world.plane;
    if (!p) return null;
    return { x: p[0] * f.world.s - o3, y: p[1] * f.world.s };
  };

  return {
    /** Start the take-off if the airport's plane is on screen (and it isn't already flying). o3: the L3 offset. */
    takeoff(t: number, f: LifeFrame | null, o3: number): boolean {
      if (!f || t - lastTakeoff < TAKEOFF_S + AWAY_S) return false;
      const p = planeAt(f, o3);
      if (!p || p.x < 0 || p.x > f.w) return false;
      takeoffAt = lastTakeoff = t;
      return true;
    },
    flying: (t: number) => t - takeoffAt < TAKEOFF_S,

    between(g: CanvasRenderingContext2D, layer: LayerId | "river", o: number, f: LifeFrame) {
      const s = f.world.s;
      if (layer === "river") {
        // Deck lights mirrored on the water (they shimmer).
        if (f.lamps > 0.01) {
          g.fillStyle = warmCss;
          const tick = Math.floor(f.t * 12);
          for (const l of f.world.lights.L3) {
            if (l.kind !== "deck") continue;
            const x = l.x * s - o;
            if (x < -6 || x > f.w + 6) continue;
            const y = (2 * RIVER[0] - l.y + 1.5) * s;
            const len = 2 + 3 * (f.moving ? hash(l.i, tick) : 0.5);
            g.globalAlpha = 0.35 * f.lamps;
            g.fillRect(Math.round(x - len / 2), Math.round(y), len, 1);
          }
        }
        // Sun / moon shimmer column.
        for (const b of f.glints) {
          if (b.k <= 0.01) continue;
          g.fillStyle = rgba(b.rgb, 1);
          const tick = f.moving ? Math.floor(f.t * 12) : 0;
          const y0 = (RIVER[0] + 2.6) * s;
          const y1 = RIVER[1] * s - 1;
          let row = 0;
          for (let y = y0; y < y1; y += 2, row++) {
            const depth = (y - y0) / Math.max(1, y1 - y0);
            const half = b.r * (0.7 + 1.6 * depth) * (0.45 + 0.55 * hash(row, tick));
            const jx = (hash(row + 99, tick) - 0.5) * 3;
            g.globalAlpha = 0.3 * b.k * (1 - 0.5 * depth);
            g.fillRect(Math.round(b.x - half + jx), Math.round(y), Math.max(1, Math.round(2 * half)), 1);
          }
        }
        g.globalAlpha = 1;
        return;
      }
      if (layer === "L3") {
        // Windows: warm, a few cool white TVs flickering gently.
        if (f.dark > 0.01) {
          const sz = s < 1.4 ? 1 : 1.5;
          for (const l of f.world.lights.L3) {
            if (l.kind !== "window") continue;
            const x = l.x * s - o;
            if (x < -2 || x > f.w + 2) continue;
            if (!windowLit(l.i, f.minutes, f.seed)) continue;
            if (windowSchedule(l.i, f.seed).tv) {
              const flicker = f.moving ? 0.75 + 0.2 * Math.sin(2 * Math.PI * TV_HZ * f.t + l.i * 1.7) + 0.05 * Math.sin(11 * f.t + l.i) : 0.85;
              g.fillStyle = tvCss;
              g.globalAlpha = 0.9 * f.dark * flicker;
            } else {
              g.fillStyle = warmCss;
              g.globalAlpha = 0.9 * f.dark;
            }
            g.fillRect(Math.round(x), Math.round(l.y * s), sz, sz);
          }
        }
        if (f.lamps > 0.01) {
          // Deck lights and the runway chase (a pulse running left to right every 2 s).
          const runway = f.world.lights.L3.filter((l) => l.kind === "runway");
          const n = runway.length;
          const head = ((f.moving ? f.t : 0) % 2) / 2;
          for (const l of f.world.lights.L3) {
            if (l.kind !== "deck" && l.kind !== "runway") continue;
            const x = l.x * s - o;
            if (x < -3 || x > f.w + 3) continue;
            let a = f.lamps;
            if (l.kind === "runway") {
              const j = runway.indexOf(l) / Math.max(1, n - 1);
              const d = (head - j + 1) % 1;
              a *= 0.3 + 0.7 * Math.exp(-d * 14);
              g.fillStyle = textCss;
            } else g.fillStyle = warmCss;
            g.globalAlpha = a;
            g.fillRect(Math.round(x - 0.5), Math.round(l.y * s - 0.5), 1.5, 1.5);
          }
        }
        // The plane: parked, or taking off (rolls, rotates, climbs out to the right, fading at the top).
        const p = planeAt(f, o);
        if (p) {
          const k = (f.t - takeoffAt) / TAKEOFF_S;
          const flying = f.moving && k >= 0 && k < 1;
          if (!flying && f.t - takeoffAt < TAKEOFF_S + AWAY_S && f.t >= takeoffAt) {
            // Just left: the apron is empty for a moment.
          } else {
            let x = p.x;
            let y = p.y;
            let rot = 0;
            let alpha = 1;
            if (flying) {
              const e = k * k;
              x += 420 * e + 40 * k;
              const lift = Math.max(0, k - 0.3) / 0.7;
              y -= (s * 100 + LIFT) * lift * lift;
              rot = -0.22 * Math.min(1, lift * 3);
              alpha = 1 - Math.max(0, (k - 0.8) / 0.2);
            }
            g.save();
            g.globalAlpha = alpha;
            g.translate(x, y);
            g.rotate(rot);
            g.scale(s * 0.62 * f.world.planeK, s * 0.62 * f.world.planeK);
            g.fillStyle = f.l3;
            g.fill(plane);
            if (f.dark > 0.3) {
              const on = Math.floor(f.t * 2) % 2 === 0;
              g.fillStyle = on ? "rgba(255,80,70,1)" : textCss;
              g.fillRect(-5.8, -13.6, 1.4, 1.4);
              if (flying && on) {
                g.fillStyle = textCss;
                g.fillRect(16, -2.6, 1.4, 1.4);
              }
            }
            g.restore();
          }
        }
        g.globalAlpha = 1;
        return;
      }
      if (layer === "L4" && f.lamps > 0.01) {
        for (const l of f.world.lights.L4) {
          if (l.kind !== "lamp") continue;
          const x = l.x * s - o;
          if (x < -30 || x > f.w + 30) continue;
          const y = l.y * s;
          const R = 15 * Math.max(0.8, s / 1.6);
          g.globalAlpha = f.lamps;
          g.drawImage(glow, x - R, y - R, 2 * R, 2 * R);
          g.fillStyle = warmCss;
          g.fillRect(Math.round(x - 1), Math.round(y - 0.5), 2, 1.5);
        }
        g.globalAlpha = 1;
      }
    },
  };
}

export type Life = ReturnType<typeof createLife>;
