/**
 * Slow life: things that move often enough to notice and slowly enough to stay calm. All of it is off under
 * reduced motion; buffers are fixed-size, so frames allocate nothing.
 * - Birds (day and golden hour, no rain): one flock of 3–7 at most every 90 s, 4–7 px, a two-frame flap at 3–5 Hz,
 *   a loose V with per-bird jitter, crossing in 35–55 s at mid-sky height, never across the hero text block.
 * - A plane overhead at night every 3–6 min: tiny, high, 60–80 s across, red light blinking and a white strobe
 *   at 1 Hz.
 * - Fireflies at night over the tea gardens (L2): warm 1.5 px dots in --signal, each blinking with a 300 ms
 *   attack and 900 ms decay every 2–6 s. Count by month (lights.ts); none in rain or thunder.
 * - A rickshaw passing on the near bank (L4) every 2–4 min by day and evening, 18 s across, wheels turning; it
 *   moves in L4's world, so it respects parallax while you scroll.
 */
import { type RGB } from "@/lib/sky/color";
import { rickshaw } from "@/lib/sky/landscape/shapes";
import { ridgeL2, ridgeL4 } from "@/lib/sky/landscape/world";

const rgba = (c: RGB, a: number) => `rgba(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)},${a})`;

const FLOCK_MAX = 7;
const FLY_MAX = 18;
const SPOKE_FRAMES = 8;

export type SkyLife = {
  t: number;
  w: number;
  h: number;
  /** Day/golden birds allowed; night (plane overhead); fireflies count; rickshaw hours. */
  birds: boolean;
  night: boolean;
  /** Hero text block in viewport px (birds keep out of its height). */
  hero: { y0: number; y1: number } | null;
  ink: string;
};

export type LandLife = {
  t: number;
  w: number;
  s: number;
  fireflies: number;
  rickshaw: boolean;
  l4: string;
};

export function createAmbient(rng: () => number, signal: RGB, text: RGB, opts: { force?: boolean } = {}) {
  const red = "rgba(255,84,72,1)";
  const white = rgba(text, 1);
  const glowCss = rgba(signal, 1);
  // Birds.
  const flock = { on: false, t0: 0, dur: 45, dir: 1, y: 0, n: 0, hz: 4, size: 5 };
  const bx = new Float32Array(FLOCK_MAX);
  const by = new Float32Array(FLOCK_MAX);
  const bph = new Float32Array(FLOCK_MAX);
  const bsz = new Float32Array(FLOCK_MAX);
  let nextFlock = opts.force ? 0 : 15 + rng() * 40;
  // Plane overhead.
  const jet = { on: false, t0: 0, dur: 70, dir: 1, y: 0 };
  let nextJet = opts.force ? 0 : 40 + rng() * 140;
  // Fireflies (world units on L2; blink clock in seconds).
  const fx = new Float32Array(FLY_MAX);
  const fy = new Float32Array(FLY_MAX);
  const fNext = new Float32Array(FLY_MAX);
  const fLast = new Float32Array(FLY_MAX).fill(-10);
  const fDrift = new Float32Array(FLY_MAX);
  let fSeeded = false;
  // Rickshaw.
  const ride = { on: false, dir: 1, speed: 0, t0: 0 };
  let nextRide = opts.force ? 0 : 30 + rng() * 120;
  let rideOffset = 0;
  const wheels: Path2D[][] = [];
  for (let i = 0; i < SPOKE_FRAMES; i++) {
    const sh = rickshaw((i / SPOKE_FRAMES) * (Math.PI / 3));
    wheels.push([new Path2D(sh.fill!), new Path2D(sh.stroke![0]!.d)]);
  }
  // The rider, pedalling (two leg frames).
  const rider = [
    new Path2D("M14.6 -23.4a1.6 1.6 0 1 1 0.01 0Z M14 -21.8L14.6 -13.6L16.6 -13.4L15.6 -21.6Z M15.2 -20.2L20 -15.2L20.6 -15.8L15.8 -21Z M14.8 -13.6L16 -9.2L12.6 -6.4L13.2 -5.8L17 -9L15.8 -13.8Z"),
    new Path2D("M14.6 -23.4a1.6 1.6 0 1 1 0.01 0Z M14 -21.8L14.6 -13.6L16.6 -13.4L15.6 -21.6Z M15.2 -20.2L20 -15.2L20.6 -15.8L15.8 -21Z M14.8 -13.6L13 -9.6L11.4 -5.6L12.2 -5.4L14 -9.2L15.8 -13.8Z"),
  ];

  const startFlock = (t: number, s: SkyLife) => {
    flock.on = true;
    flock.t0 = t;
    flock.dur = 35 + rng() * 20;
    flock.dir = rng() < 0.5 ? 1 : -1;
    flock.n = 3 + Math.floor(rng() * 5);
    flock.hz = 3 + rng() * 2;
    // Mid-sky, clear of the hero text block.
    const lo = s.h * 0.18;
    const hi = Math.min(s.h * 0.42, (s.hero?.y0 ?? s.h) - 40);
    flock.y = hi > lo ? lo + rng() * (hi - lo) : lo;
    for (let i = 0; i < flock.n; i++) {
      const rank = Math.ceil(i / 2);
      const side = i % 2 ? 1 : -1;
      bx[i] = -rank * (14 + rng() * 6);
      by[i] = rank * side * (7 + rng() * 4) * 0.6;
      bph[i] = rng();
      bsz[i] = 4 + rng() * 3;
    }
  };

  return {
    /** The rickshaw is riding (it's the only fast mover: the loop asks for the display rate while it does). */
    active: () => ride.on,

    sky(ctx: CanvasRenderingContext2D, s: SkyLife) {
      const t = s.t;
      // Birds.
      if (!flock.on && s.birds && t >= nextFlock) startFlock(t, s);
      if (flock.on) {
        const k = (t - flock.t0) / flock.dur;
        if (k >= 1) {
          flock.on = false;
          nextFlock = t + 90 + rng() * 90;
        } else {
          const x0 = flock.dir > 0 ? -60 + (s.w + 160) * k : s.w + 60 - (s.w + 160) * k;
          ctx.strokeStyle = s.ink;
          ctx.lineWidth = 1.2;
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          ctx.globalAlpha = 0.75;
          ctx.beginPath();
          for (let i = 0; i < flock.n; i++) {
            const x = x0 + bx[i]! * flock.dir + Math.sin(t * 0.7 + i) * 2;
            const y = flock.y + by[i]! + Math.sin(t * 1.1 + i * 1.7) * 2.5;
            const up = Math.floor((t + bph[i]! / flock.hz) * flock.hz * 2) % 2 === 0;
            const w = bsz[i]! / 2;
            ctx.moveTo(x - w, y + (up ? -w * 0.7 : w * 0.25));
            ctx.quadraticCurveTo(x - w * 0.4, y - (up ? w * 0.2 : -w * 0.1), x, y);
            ctx.quadraticCurveTo(x + w * 0.4, y - (up ? w * 0.2 : -w * 0.1), x + w, y + (up ? -w * 0.7 : w * 0.25));
          }
          ctx.stroke();
        }
      }
      // Plane overhead at night.
      if (!jet.on && s.night && t >= nextJet) {
        jet.on = true;
        jet.t0 = t;
        jet.dur = 60 + rng() * 20;
        jet.dir = rng() < 0.5 ? 1 : -1;
        jet.y = s.h * (0.08 + rng() * 0.1);
      }
      if (jet.on) {
        const k = (t - jet.t0) / jet.dur;
        if (k >= 1) {
          jet.on = false;
          nextJet = t + 180 + rng() * 180;
        } else {
          const x = jet.dir > 0 ? -20 + (s.w + 40) * k : s.w + 20 - (s.w + 40) * k;
          const y = jet.y - 14 * k;
          ctx.globalAlpha = 0.35;
          ctx.fillStyle = s.ink;
          ctx.fillRect(x - 3, y - 0.5, 6, 1);
          const ph = t % 1;
          if (ph < 0.5) {
            ctx.globalAlpha = 0.85;
            ctx.fillStyle = red;
            ctx.fillRect(x - 0.8 * jet.dir - 0.6, y - 0.6, 1.3, 1.3);
          }
          if (ph > 0.6 && ph < 0.68) {
            ctx.globalAlpha = 1;
            ctx.fillStyle = white;
            ctx.fillRect(x + 2.4 * jet.dir - 0.7, y - 0.7, 1.5, 1.5);
          }
        }
      }
      ctx.globalAlpha = 1;
    },

    /** Fireflies after L2; the rickshaw after L4. `o` is that layer's walk offset (px). */
    land(g: CanvasRenderingContext2D, layer: "L2" | "L4", o: number, l: LandLife) {
      const t = l.t;
      if (layer === "L2" && l.fireflies > 0) {
        const n = Math.min(FLY_MAX, l.fireflies);
        const x0 = o / l.s;
        const span = l.w / l.s;
        if (!fSeeded) {
          for (let i = 0; i < FLY_MAX; i++) {
            fx[i] = x0 + rng() * span;
            fy[i] = 4 + rng() * 14;
            fNext[i] = t + rng() * 4;
            fDrift[i] = (rng() - 0.5) * 0.6;
          }
          fSeeded = true;
        }
        g.fillStyle = glowCss;
        for (let i = 0; i < n; i++) {
          // Keep them over the visible strip as you walk.
          if (fx[i]! < x0 - 10 || fx[i]! > x0 + span + 10) {
            fx[i] = x0 + rng() * span;
            fLast[i] = -10;
          }
          fx[i] = fx[i]! + fDrift[i]! * 0.016;
          if (t >= fNext[i]!) {
            fLast[i] = t;
            fNext[i] = t + 2 + rng() * 4;
          }
          const d = t - fLast[i]!;
          const a = d < 0.3 ? d / 0.3 : d < 1.2 ? 1 - (d - 0.3) / 0.9 : 0;
          if (a <= 0.01) continue;
          const x = fx[i]! * l.s - o;
          const y = (ridgeL2(fx[i]!) - fy[i]! + 10) * l.s;
          g.globalAlpha = a * 0.25;
          g.fillRect(x - 2, y - 2, 4, 4);
          g.globalAlpha = a;
          g.fillRect(x - 0.75, y - 0.75, 1.5, 1.5);
        }
        g.globalAlpha = 1;
      }
      if (layer === "L4") {
        if (!ride.on && l.rickshaw && t >= nextRide) {
          ride.on = true;
          ride.dir = rng() < 0.5 ? 1 : -1;
          ride.speed = (l.w + 80) / 18;
          ride.t0 = t;
          // Start just off screen, in L4's world at the current walk.
          rideOffset = o;
        }
        if (ride.on) {
          const x = (ride.dir > 0 ? rideOffset - 50 : rideOffset + l.w + 50) + ride.dir * ride.speed * (t - ride.t0) - o;
          if (x < -80 || x > l.w + 80) {
            if (t - ride.t0 > 2) {
              ride.on = false;
              nextRide = t + 120 + rng() * 120;
            }
          } else {
            const travelled = ride.speed * (t - ride.t0);
            const spin = (travelled / (5.6 * l.s)) % (Math.PI / 3);
            const frame = Math.floor((spin / (Math.PI / 3)) * SPOKE_FRAMES) % SPOKE_FRAMES;
            const [body, spokes] = wheels[frame] as [Path2D, Path2D];
            const xw = (x + o) / l.s;
            g.save();
            g.translate(x, (ridgeL4(xw) + 0.6) * l.s);
            g.scale(ride.dir * l.s * 0.95, l.s * 0.95);
            g.fillStyle = l.l4;
            g.strokeStyle = l.l4;
            g.lineWidth = 0.7;
            g.fill(body);
            g.stroke(spokes);
            g.fill(rider[Math.floor(travelled / 10) % 2]!);
            g.restore();
          }
        }
      }
    },
  };
}

export type Ambient = ReturnType<typeof createAmbient>;
