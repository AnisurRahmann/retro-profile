/**
 * Night life on the landscape band (drawn between its layers, src/components/sky/landscape.ts):
 * - lit windows (WINDOW_LIT, 1–2 px; 45% lit before 22:00, 10% by 01:00, back on between 05:00 and 06:30, a few
 *   cool white TVs flickering at 0.3 Hz; seeded by date: src/lib/sky/landscape/lights.ts),
 * - lamp posts glowing from sunset to sunrise, the bridge's deck lights mirrored in the river with shimmer,
 * - Osmani Airport (shapes.ts airport()): the runway's tarmac and dashed centreline, its edge lights (white, in a
 *   chase every 2 s), green threshold and red far-end lights, the terminal's and tower's glass (the sky's
 *   reflection by day, lit panes at night), the windsock leaning with the real wind,
 * - the sun's or moon's shimmer column on the river when it's within 12° of the horizon (1 px dashes, lengths
 *   re-jittered at 12 fps, alpha 0.3),
 * - the plane at the gate, which takes off (src/lib/sky/landscape/plane.ts: taxi, roll, rotate, climb, 4.6 s)
 *   when the renderer says so (every arrival at the airport, "Book 30 min"). From sunset to sunrise (v5.1 T5), in
 *   every state: a red beacon and a white wingtip strobe over the silhouette, a rim of the city's glow along its top,
 *   and a landing light on the runway while it rolls. 2.5 s after it's gone the next one fades in.
 * Sprites are built once; frames allocate nothing.
 */
import { hexToRgb, type RGB } from "@/lib/sky/color";
import type { LayerId } from "@/lib/sky/landscape/anchors";
import { TV_HZ, windowLit, windowSchedule } from "@/lib/sky/landscape/lights";
import { RIVER } from "@/lib/sky/landscape/shapes";
import { SPLASH } from "@/lib/sky/rain";
import { LIGHTNING_RIM } from "@/lib/sky/palette";
import {
  gateAt,
  PLANE_BODY,
  PLANE_GEAR,
  PLANE_LEN,
  PLANE_LIGHTS,
  planeAt,
  TAKEOFF_S,
  TAXI_PX_S,
  TAXI_S,
  type PlaneState,
  type TakeoffParams,
} from "@/lib/sky/landscape/plane";
import type { AirportGeom, World } from "@/lib/sky/landscape/world";
import { CITY_GLOW, RWY_GREEN, RWY_RED, TV_LIT, WINDOW_LIT } from "@/lib/sky/palette";
import { LIFT } from "./landscape";

const rgba = (c: RGB, a: number) =>
  `rgba(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)},${a})`;
const hash = (a: number, b: number) => {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  return ((h ^ (h >>> 12)) >>> 0) / 4294967296;
};

export { TAKEOFF_S };

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
  /** The silhouette colour of L3 (the plane), the runway's tarmac, the rim light, the glass's sky reflection. */
  l3: string;
  tones: { tarmac: string; rim: string; glass: string };
  /** The real wind (the windsock): km/h, and which way it blows on screen (−1 to the left). */
  wind: { kmh: number; side: -1 | 1 };
  /** The plane's length on screen, px (plane.ts planePx). */
  planePx: number;
  /** Rain: its slant (radians), its streaks per 100,000 px², and the splashes a second per 1,000 px of water (0: none). */
  rain: { slant: number; density: number; splashes: number };
  /** Lightning: a bolt's screen x and its brightness (0: none): its light on the water. */
  bolt: { x: number; k: number };
};

export function createLife(textRgb: RGB) {
  const warm = hexToRgb(WINDOW_LIT);
  const warmCss = rgba(warm, 1);
  const boltCss = rgba(hexToRgb(LIGHTNING_RIM), 1);
  const textCss = rgba(textRgb, 1);
  const tvCss = rgba(hexToRgb(TV_LIT), 1);
  const body = new Path2D(PLANE_BODY);
  const gear = new Path2D(PLANE_GEAR);
  const green = rgba(hexToRgb(RWY_GREEN), 1);
  const redRgb = hexToRgb(RWY_RED);
  const red = rgba(redRgb, 1);
  const glowCss = rgba(hexToRgb(CITY_GLOW), 1);
  /** The take-off in progress (or the last one): its start and its path. */
  let t0 = -Infinity;
  let path: TakeoffParams | null = null;
  let flights = 0;
  /** Test builds: hold the take-off at this many seconds in (the review's roll / rotation / climb frames). */
  let pinned: number | null = null;
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

  // The plane's lights: a soft radial glow that fades to nothing at its edge (drawn at 10px for the beacon, 14px for
  // the strobe, under a 3px dot).
  const lightGlow = (c: RGB) => {
    const cv = document.createElement("canvas");
    cv.width = cv.height = 64;
    const gc = cv.getContext("2d")!;
    const grad = gc.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, rgba(c, 0.85));
    grad.addColorStop(0.2, rgba(c, 0.5));
    grad.addColorStop(0.5, rgba(c, 0.16));
    grad.addColorStop(1, rgba(c, 0));
    gc.fillStyle = grad;
    gc.fillRect(0, 0, 64, 64);
    return cv;
  };
  const beaconGlow = lightGlow(redRgb);
  const strobeGlow = lightGlow(textRgb);

  /** The plane's path for a take-off starting now, in world px (x) and band px (y): roll to the visible runway's end (phones: earlier). */
  const pathFor = (ap: AirportGeom, f: LifeFrame, o3: number): TakeoffParams => {
    const s = f.world.s;
    const x0 = ap.gate[0] * s;
    const xT = x0 - TAXI_PX_S * TAXI_S;
    const end = Math.max(ap.runway.x0 * s + 6, o3 + 16);
    return {
      x0,
      y0: ap.gate[1] * s,
      runwayY: ap.runway.y * s,
      dir: -1,
      // Phones: rotate after at most 0.3 vw of roll (before the runway's end, like a real take-off), so the climb
      // crosses the screen instead of leaving it at once.
      rollPx: Math.max(40, Math.min(xT - end, f.w < 640 ? 0.3 * f.w : Infinity)),
    };
  };

  /** The airport set piece's live parts: tarmac, centreline, glass, the windsock (lights are drawn with the others). */
  const drawAirport = (g: CanvasRenderingContext2D, o: number, f: LifeFrame, ap: AirportGeom) => {
    const s = f.world.s;
    const r = ap.runway;
    const x0 = r.x0 * s - o;
    const x1 = r.x1 * s - o;
    if (x1 < -4 || x0 > f.w + 4) return;
    // Tarmac, a shade lighter than the ground, and the dashed centreline (white at 0.35).
    g.fillStyle = f.tones.tarmac;
    g.fillRect(x0, (r.y - r.hw) * s, x1 - x0, 2 * r.hw * s);
    g.fillStyle = textCss;
    g.globalAlpha = 0.35;
    const cy = Math.round(r.y * s - 0.5);
    for (let x = x0 + 4; x < x1 - 6; x += 10) g.fillRect(Math.round(x), cy, 5, 1);
    // Glass: the sky's reflection by day, lit panes at night.
    g.fillStyle = f.tones.glass;
    g.globalAlpha = 0.24 * (1 - f.dark);
    if (g.globalAlpha > 0.01)
      for (const [a, b, c, d] of ap.glass) g.fillRect(a * s - o, b * s, (c - a) * s, (d - b) * s);
    // The windsock: a mast, and a striped cone leaning downwind, 0–80° from hanging as the wind goes 0–30 km/h.
    const [wx, wy] = [ap.windsock[0] * s - o, ap.windsock[1] * s];
    const k = ap.k * s;
    const top = wy - 14 * k;
    g.globalAlpha = 1;
    g.strokeStyle = f.l3;
    g.lineWidth = Math.max(1, 0.6 * k);
    g.beginPath();
    g.moveTo(wx, wy);
    g.lineTo(wx, top);
    g.stroke();
    const th = (80 * Math.min(1, f.wind.kmh / 30) * Math.PI) / 180;
    const ux = Math.sin(th) * f.wind.side;
    const uy = Math.cos(th);
    const L = 8 * k;
    const quad = (a: number, b: number, w0: number, w1: number) => {
      g.beginPath();
      g.moveTo(wx + ux * a * L - uy * w0 * f.wind.side, top + uy * a * L + ux * w0 * f.wind.side);
      g.lineTo(wx + ux * b * L - uy * w1 * f.wind.side, top + uy * b * L + ux * w1 * f.wind.side);
      g.lineTo(wx + ux * b * L + uy * w1 * f.wind.side, top + uy * b * L - ux * w1 * f.wind.side);
      g.lineTo(wx + ux * a * L + uy * w0 * f.wind.side, top + uy * a * L - ux * w0 * f.wind.side);
      g.closePath();
      g.fill();
    };
    const hw = (q: number) => (1.3 - 0.7 * q) * k;
    g.fillStyle = f.l3;
    quad(0, 1, hw(0), hw(1));
    g.fillStyle = textCss;
    g.globalAlpha = f.dark > 0.5 ? 0.15 : 0.45;
    quad(0.2, 0.4, hw(0.2), hw(0.4));
    quad(0.6, 0.8, hw(0.6), hw(0.8));
    g.globalAlpha = 1;
  };

  /** The plane: parked at the gate, taking off, or fading back in. */
  const drawPlane = (g: CanvasRenderingContext2D, o: number, f: LifeFrame, ap: AirportGeom) => {
    const s = f.world.s;
    if (pinned !== null && !path) path = pathFor(ap, f, o);
    const from = pinned !== null ? f.t - pinned : t0;
    const since = f.moving ? f.t - from : Infinity;
    const gate = gateAt(f.t, from);
    if (gate.state === "gone" || (!f.moving && gate.state !== "parked")) return;
    const p0 = f.moving && since >= 0 && since < TAKEOFF_S ? path : null;
    const pf = p0 ? planeAt(since, { ...p0, bounds: { x0: o, x1: o + f.w, y0: -LIFT } }) : null;
    const x = (pf ? pf.x : ap.gate[0] * s) - o;
    const y = pf ? pf.y : ap.gate[1] * s;
    const alpha = pf ? pf.alpha : f.moving ? gate.alpha : 1;
    if (alpha <= 0.01 || x < -f.planePx || x > f.w + f.planePx) return;
    const k = (f.planePx / PLANE_LEN) * (pf ? pf.scale : 1);
    // Night: 0 by day … 1 from sunset to sunrise (LifeFrame.lamps). The strength of the lights.
    const night = f.lamps;
    // The landing light on the runway while it rolls (night): a soft wedge ahead of the nose, at 0.25.
    if (pf && night > 0.01 && (pf.state === "roll" || pf.state === "taxi")) {
      const lx = x + PLANE_LIGHTS.landing[0] * k;
      const len = 70;
      const grad = g.createLinearGradient(lx, 0, lx - len, 0);
      grad.addColorStop(0, rgba(textRgb, 0.25 * alpha * night));
      grad.addColorStop(1, rgba(textRgb, 0));
      g.fillStyle = grad;
      g.beginPath();
      g.moveTo(lx, y - 2 * k);
      g.lineTo(lx - len, y - 0.5);
      g.lineTo(lx - len, y + 3);
      g.closePath();
      g.fill();
    }
    g.save();
    g.globalAlpha = alpha;
    g.translate(x, y);
    // Nose to the left: pitching up is a clockwise turn on screen.
    g.rotate(((pf?.pitchDeg ?? 0) * Math.PI) / 180);
    g.scale(k, k);
    // A 1px rim light along the top, then the silhouette. At night the rim is the city glow at 0.5, so the dark
    // shape reads against the dark sky.
    g.translate(0, -1 / k);
    if (night < 0.99) {
      g.globalAlpha = alpha * (1 - night);
      g.fillStyle = f.tones.rim;
      g.fill(body);
    }
    if (night > 0.01) {
      g.globalAlpha = alpha * night * 0.5;
      g.fillStyle = glowCss;
      g.fill(body);
    }
    g.globalAlpha = alpha;
    g.translate(0, 1 / k);
    g.fillStyle = f.l3;
    g.fill(body);
    if (!pf || pf.gearDown) g.fill(gear);
    // The lights, on top of the silhouette and in every state (parked too), from sunset to sunrise: a red beacon, a
    // 3px dot in a 10px glow, on for 0.15 s every second; a white strobe, a 3px dot in a 14px glow, two flashes every
    // 1.2 s. Their sizes are screen px whatever the plane's scale. A still frame (t = 0) shows both on.
    if (night > 0.01) {
      const light = (at: readonly [number, number], on: boolean, glow: HTMLCanvasElement, r: number, css: string) => {
        if (!on) return;
        g.globalAlpha = alpha * night;
        const u = r / k;
        g.drawImage(glow, at[0] - u, at[1] - u, 2 * u, 2 * u);
        g.fillStyle = css;
        g.beginPath();
        g.arc(at[0], at[1], 1.5 / k, 0, Math.PI * 2);
        g.fill();
      };
      const sec = f.t % 1;
      const ph = f.t % 1.2;
      light(PLANE_LIGHTS.beacon, sec < 0.15, beaconGlow, 10, red);
      light(PLANE_LIGHTS.strobe, ph < 0.06 || (ph >= 0.14 && ph < 0.2), strobeGlow, 14, textCss);
    }
    g.restore();
  };

  return {
    /** Start a take-off now if a plane is parked at the gate (and none is flying). o3: the L3 offset. */
    takeoff(t: number, f: LifeFrame | null, o3: number): boolean {
      const ap = f?.world.airport;
      if (!f || !ap) return false;
      const gate = gateAt(t, t0);
      if (gate.state !== "parked" || gate.alpha < 1) return false;
      path = pathFor(ap, f, o3);
      t0 = t;
      flights++;
      return true;
    },
    flying: (t: number) => pinned !== null || (t - t0 >= 0 && t - t0 < TAKEOFF_S),
    /** Test builds: hold the take-off at `s` seconds in (null: let go). */
    pin(s: number | null) {
      pinned = s;
      if (s === null) path = null;
    },
    /** A plane is parked and fully there (a take-off can start). */
    ready: (t: number) => {
      const gate = gateAt(t, t0);
      return gate.state === "parked" && gate.alpha >= 1;
    },
    /** For tests and the review: the plane's state and how many take-offs so far. */
    plane: (t: number): { state: PlaneState; flights: number } => ({
      state: gateAt(t, t0).state,
      flights,
    }),

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
        // Rain on the water: SPLASH_RATE marks a second per 1,000 px, each a ring that widens and fades over
        // SPLASH.life. Read from the clock (no state), three birth ticks back.
        if (f.moving && f.rain.splashes > 0) {
          const tickS = 1 / 12;
          const per = ((f.rain.splashes * f.w) / 1000) * tickS;
          const whole = Math.floor(per);
          const now = Math.floor(f.t / tickS);
          g.strokeStyle = textCss;
          g.lineWidth = 1;
          for (let back = 2; back >= 0; back--) {
            const born = now - back;
            for (let k = 0; k <= whole; k++) {
              if (k >= whole && hash(k + 31, born) >= per - whole) continue;
              const age = f.t - (born + hash(k + 13, born)) * tickS;
              if (age < 0 || age > SPLASH.life) continue;
              const u = age / SPLASH.life;
              const r = SPLASH.r0 + (SPLASH.r1 - SPLASH.r0) * u;
              g.globalAlpha = SPLASH.alpha * (1 - u) * (1 - u);
              g.beginPath();
              g.ellipse(
                hash(k, born) * f.w,
                (RIVER[0] + 3 + hash(k + 7, born) * (RIVER[1] - RIVER[0] - 6)) * s,
                r,
                r * 0.32,
                0,
                0,
                Math.PI * 2,
              );
              g.stroke();
            }
          }
          g.globalAlpha = 1;
        }
        // A bolt's light on the water: a broken column under it, shimmering.
        if (f.bolt.k > 0.01) {
          const tick = f.moving ? Math.floor(f.t * 24) : 0;
          g.fillStyle = boltCss;
          const y0 = (RIVER[0] + 2.6) * s;
          const y1 = RIVER[1] * s - 1;
          let row = 0;
          for (let y = y0; y < y1; y += 2, row++) {
            const depth = (y - y0) / Math.max(1, y1 - y0);
            const half = 2.5 + 3 * hash(row, tick) + 2 * depth;
            g.globalAlpha = 0.5 * f.bolt.k * (1 - 0.5 * depth) * (0.55 + 0.45 * hash(row + 7, tick));
            g.fillRect(Math.round(f.bolt.x - half + (hash(row + 31, tick) - 0.5) * 4), Math.round(y), Math.ceil(2 * half), 1);
          }
          g.globalAlpha = 1;
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
            g.fillRect(
              Math.round(b.x - half + jx),
              Math.round(y),
              Math.max(1, Math.round(2 * half)),
              1,
            );
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
              const flicker = f.moving
                ? 0.75 +
                  0.2 * Math.sin(2 * Math.PI * TV_HZ * f.t + l.i * 1.7) +
                  0.05 * Math.sin(11 * f.t + l.i)
                : 0.85;
              g.fillStyle = tvCss;
              g.globalAlpha = 0.9 * f.dark * flicker;
            } else {
              g.fillStyle = warmCss;
              g.globalAlpha = 0.9 * f.dark;
            }
            g.fillRect(Math.round(x), Math.round(l.y * s), sz, sz);
          }
        }
        const ap = f.world.airport;
        if (ap) drawAirport(g, o, f, ap);
        if (f.lamps > 0.01) {
          // Deck lights, the runway's edge lights (a chase running toward the far end every 2 s), its green
          // threshold and red far end, and the glass panes.
          const runway = f.world.lights.L3.filter((l) => l.kind === "runway");
          const n = runway.length;
          const head = ((f.moving ? f.t : 0) % 2) / 2;
          for (const l of f.world.lights.L3) {
            if (l.kind === "window" || l.kind === "lamp") continue;
            const x = l.x * s - o;
            if (x < -3 || x > f.w + 3) continue;
            let a = f.lamps;
            let size = 1.5;
            if (l.kind === "runway") {
              const j = 1 - runway.indexOf(l) / Math.max(1, n - 1);
              const d = (head - j + 1) % 1;
              a *= 0.45 + 0.55 * Math.exp(-d * 14);
              g.fillStyle = textCss;
              size = 1.2;
            } else if (l.kind === "threshold") g.fillStyle = green;
            else if (l.kind === "rwyend") g.fillStyle = red;
            else if (l.kind === "pane") {
              g.fillStyle = warmCss;
              a = 0.85 * f.dark;
              g.globalAlpha = a;
              g.fillRect(
                Math.round(x - 0.75),
                Math.round(l.y * s - 1.5),
                Math.max(1, 1.2 * s * (ap?.k ?? 1)),
                Math.max(2, 2.6 * s * (ap?.k ?? 1)),
              );
              continue;
            } else g.fillStyle = warmCss;
            g.globalAlpha = a;
            g.fillRect(Math.round(x - size / 2), Math.round(l.y * s - size / 2), size, size);
          }
          g.globalAlpha = 1;
        }
        if (ap) drawPlane(g, o, f, ap);
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
          // Rain in the lamp's light: a few short streaks above its head, warm, at 0.5.
          if (f.rain.density > 0) {
            const tick = f.moving ? Math.floor(f.t * 10) : 0;
            const slope = Math.tan(f.rain.slant);
            g.strokeStyle = warmCss;
            g.lineWidth = 1;
            for (let k = 0; k < 5; k++) {
              const rx = x + (hash(l.i * 5 + k, tick) - 0.5) * 36;
              const ry = y - 8 - hash(l.i * 5 + k + 50, tick) * 44;
              g.globalAlpha = 0.5 * f.lamps * (0.4 + 0.6 * hash(l.i * 5 + k + 90, tick));
              g.beginPath();
              g.moveTo(rx, ry);
              g.lineTo(rx - 12 * slope, ry - 12);
              g.stroke();
            }
          }
        }
        g.globalAlpha = 1;
      }
    },
  };
}

export type Life = ReturnType<typeof createLife>;
