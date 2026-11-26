/**
 * Canvas 2D particle layer: stars, the moon, meteors and rain. All buffers are allocated on resize, never in the
 * frame loop. Sizes in CSS px; the backing store is min(DPR, 2).
 */
import { hexToRgb } from "@/lib/sky/color";
import { STAR_COOL, STAR_WARM } from "@/lib/sky/palette";
import { RAIN_LAYER, RAIN_LAYERS, RAIN_MAX, layerCounts } from "@/lib/sky/rain";

export { mulberry32 } from "@/lib/sky/random";
import { mulberry32 } from "@/lib/sky/random";

/** True sidereal rate, degrees per hour. */
export const SIDEREAL_DEG_PER_H = 15.041;
/** Rotation of the star field (radians) for an instant: from real time, so a reload doesn't reset it. */
export const skyRotation = (ms: number) => (((ms / 3.6e6) * SIDEREAL_DEG_PER_H) % 360) * (Math.PI / 180);

export type ParticleState = {
  night: number;
  cloudCover: number;
  /** 1 under a stratus deck (overcast, rain): no stars through it. */
  deck: number;
  fog: number;
  rainDensity: number;
  rainSlant: number;
  /** A lightning flash 0..1: the streaks' alpha × (1 + 1.5 · flash), so × 2.5 in a stroke. */
  flash: number;
  moon: { x: number; y: number; up: boolean; fraction: number; waxing: boolean };
  moonVisible: number;
  /** Moon disc radius, CSS px. */
  moonR: number;
  /** Extra dimming of the moon (behind the hero text), 0..1. */
  moonDim: number;
};

/** Extra drawing between layers: `back` before the stars (the arc), `front` after the moon (sun, birds, planes). */
export type DrawHooks = { back?: (ctx: CanvasRenderingContext2D) => void; front?: (ctx: CanvasRenderingContext2D) => void };

const css = (rgb: [number, number, number], a = 1) =>
  `rgba(${Math.round(rgb[0] * 255)},${Math.round(rgb[1] * 255)},${Math.round(rgb[2] * 255)},${a})`;

export function createParticles(canvas: HTMLCanvasElement, textRgb: [number, number, number]) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const warm = css(hexToRgb(STAR_WARM));
  const cool = css(hexToRgb(STAR_COOL));
  const text = css(textRgb);

  let w = 0,
    h = 0,
    dpr = 1,
    seed = -1,
    mobile = false;
  // Stars, polar around the pivot (stand-in for the celestial pole, above the top-left).
  let nStars = 0;
  let sR = new Float32Array(0),
    sT = new Float32Array(0),
    sA = new Float32Array(0),
    sSize = new Float32Array(0),
    sF = new Float32Array(0),
    sPh = new Float32Array(0),
    sWarm = new Uint8Array(0);
  let px = 0,
    py = 0;
  // Rain: three depths (src/lib/sky/rain.ts) in one pool. rU holds three seeded draws (length, alpha, speed) per
  // streak; which depth a streak is, and so what those draws mean, follows the count (layerCounts).
  let nRain = 0;
  let nDrawn = -1;
  let rX = new Float32Array(0),
    rY = new Float32Array(0),
    rU = new Float32Array(0),
    rL = new Float32Array(0),
    rA = new Float32Array(0),
    rV = new Float32Array(0);
  let rainRng = mulberry32(7);
  // Meteors: at most two at once.
  const meteors = [
    { t0: -1, x: 0, y: 0, ang: 0, len: 0 },
    { t0: -1, x: 0, y: 0, ang: 0, len: 0 },
  ];
  const METEOR_S = 0.5;

  const buildStars = (day: number) => {
    seed = day;
    const rng = mulberry32(day * 2654435761);
    // Mobile: at least one star per 2,200 px² of open sky (above the landscape), bigger and brighter (below).
    mobile = w < 808;
    const target = mobile ? Math.max(140, Math.round((w * (h - 120)) / 2200)) : 260;
    px = -0.3 * w;
    py = -0.55 * h;
    const rMin = Math.hypot(px, py);
    const rMax = Math.hypot(w - px, h - py);
    // Uniform density over the whole annulus the viewport sweeps through in a day.
    const annulus = Math.PI * (rMax * rMax - rMin * rMin);
    nStars = Math.round((target * annulus) / (w * h));
    sR = new Float32Array(nStars);
    sT = new Float32Array(nStars);
    sA = new Float32Array(nStars);
    sSize = new Float32Array(nStars);
    sF = new Float32Array(nStars);
    sPh = new Float32Array(nStars);
    sWarm = new Uint8Array(nStars);
    for (let i = 0; i < nStars; i++) {
      sR[i] = Math.sqrt(rMin * rMin + rng() * (rMax * rMax - rMin * rMin));
      sT[i] = rng() * Math.PI * 2;
      const m = rng() ** 3.2; // power law: most dim, a few bright
      sA[i] = 0.22 + 0.78 * m;
      sSize[i] = 0.4 + 1.0 * m;
      sF[i] = (0.6 + rng() * 1.6) * Math.PI * 2;
      sPh[i] = rng() * Math.PI * 2;
      sWarm[i] = rng() < 0.08 ? 1 : 0;
    }
  };

  const buildRain = () => {
    const cap = Math.ceil((RAIN_MAX * w * h) / 100_000);
    rX = new Float32Array(cap);
    rY = new Float32Array(cap);
    rU = new Float32Array(cap * 3);
    rL = new Float32Array(cap);
    rA = new Float32Array(cap);
    rV = new Float32Array(cap);
    rainRng = mulberry32(11);
    for (let i = 0; i < cap; i++) {
      rX[i] = rainRng() * w * 1.2 - 0.1 * w;
      rY[i] = rainRng() * h;
      rU[i * 3] = rainRng();
      rU[i * 3 + 1] = rainRng();
      rU[i * 3 + 2] = rainRng();
    }
    nDrawn = -1;
  };

  return {
    resize(day: number) {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      buildStars(day);
      buildRain();
    },
    ensureDay(day: number) {
      if (day !== seed) buildStars(day);
    },
    meteor(t: number, rng: () => number = Math.random) {
      const slot = meteors.find((m) => m.t0 < 0 || t - m.t0 > METEOR_S);
      if (!slot) return;
      slot.t0 = t;
      const dir = rng() < 0.5 ? -1 : 1;
      slot.ang = ((20 + rng() * 15) * Math.PI) / 180;
      slot.len = 120 + rng() * 60;
      slot.x = w * (dir > 0 ? 0.05 + rng() * 0.55 : 0.4 + rng() * 0.55);
      slot.y = h * (0.05 + rng() * 0.35);
      if (dir < 0) slot.ang = Math.PI - slot.ang;
    },
    meteorActive: (t: number) => meteors.some((m) => m.t0 >= 0 && t - m.t0 <= METEOR_S),
    /** Advance rain by dt seconds (0 under reduced motion). */
    step(dt: number, s: ParticleState) {
      nRain = Math.min(rX.length, Math.round((s.rainDensity * w * h) / 100_000));
      if (nRain !== nDrawn) {
        const n = layerCounts(nRain);
        let i = 0;
        for (const id of RAIN_LAYERS) {
          const spec = RAIN_LAYER[id];
          for (let k = 0; k < n[id]; k++, i++) {
            rL[i] = spec.len[0] + rU[i * 3]! * (spec.len[1] - spec.len[0]);
            rA[i] = spec.alpha[0] + rU[i * 3 + 1]! * (spec.alpha[1] - spec.alpha[0]);
            rV[i] = spec.speed[0] + rU[i * 3 + 2]! * (spec.speed[1] - spec.speed[0]);
          }
        }
        nDrawn = nRain;
      }
      if (!dt || !nRain) return;
      const slope = Math.tan(s.rainSlant);
      for (let i = 0; i < nRain; i++) {
        rY[i] = rY[i]! + rV[i]! * dt;
        rX[i] = rX[i]! + rV[i]! * dt * slope;
        if (rY[i]! - rL[i]! > h) {
          rY[i] = -rL[i]! - rainRng() * 40;
          rX[i] = rainRng() * w * 1.2 - 0.1 * w;
        }
      }
    },
    /** @param hero the hero text block in viewport px: stars behind its text are dimmed (they read as dots in the copy). */
    draw(
      t: number,
      nowMs: number,
      s: ParticleState,
      twinkle: boolean,
      hooks: DrawHooks = {},
      hero: { x0: number; y0: number; x1: number; y1: number } | null = null,
    ) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const under = (x: number, y: number) =>
        hero && x > hero.x0 - 6 && x < hero.x1 + 6 && y > hero.y0 - 6 && y < hero.y1 + 6 ? 1 : 0;
      hooks.back?.(ctx);

      // Stars.
      const vis = s.night * (1 - s.cloudCover * 0.9) * (1 - s.fog) * (1 - s.deck);
      if (vis > 0.01) {
        const rot = skyRotation(nowMs);
        for (let i = 0; i < nStars; i++) {
          const a = sT[i]! - rot;
          const x = px + sR[i]! * Math.cos(a);
          const y = py + sR[i]! * Math.sin(a);
          if (x < -2 || y < -2 || x > w + 2 || y > h + 2) continue;
          const tw = twinkle ? 0.85 + 0.15 * Math.sin(t * sF[i]! + sPh[i]!) : 1;
          ctx.globalAlpha = (mobile ? Math.max(0.35, sA[i]!) : sA[i]!) * vis * tw * (1 - 0.5 * under(x, y));
          ctx.fillStyle = sWarm[i] ? warm : cool;
          const r = sSize[i]! * (mobile ? 1.25 : 1);
          if (r < 0.9) ctx.fillRect(x - r, y - r, r * 2, r * 2);
          else {
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // Moon: lit disc + terminator ellipse; earthshine on the dark limb. Its soft glow is the shader's
      // (sky-shader.ts); there is no ring around it (the 22° halo was removed: it read as a UI circle, v5.1 T2).
      if (s.moon.up && s.moonVisible > 0.01) {
        const R = s.moonR;
        const cx = s.moon.x * w;
        const cy = s.moon.y * h;
        // In fog the moon is pale and blurred, never sharp.
        const pale = 1 - 0.6 * s.fog;
        ctx.filter = s.fog > 0.01 ? `blur(${(2.5 * s.fog).toFixed(2)}px)` : "none";
        ctx.globalAlpha = 0.06 * s.moonVisible * s.moonDim;
        ctx.fillStyle = text;
        ctx.beginPath();
        ctx.arc(cx, cy, R, 0, Math.PI * 2);
        ctx.fill();
        const f = s.moon.fraction;
        if (f > 0.01) {
          ctx.save();
          ctx.translate(cx, cy);
          if (!s.moon.waxing) ctx.scale(-1, 1); // waxing: lit limb toward the setting sun (west, right)
          ctx.globalAlpha = 0.92 * s.moonVisible * s.moonDim * pale;
          ctx.beginPath();
          ctx.arc(0, 0, R, -Math.PI / 2, Math.PI / 2, false);
          ctx.ellipse(0, 0, R * Math.abs(1 - 2 * f), R, 0, Math.PI / 2, -Math.PI / 2, f <= 0.5);
          ctx.fill();
          ctx.restore();
        }
        ctx.filter = "none";
      }

      hooks.front?.(ctx);

      // Meteors.
      for (const m of meteors) {
        if (m.t0 < 0) continue;
        const k = (t - m.t0) / METEOR_S;
        if (k < 0 || k > 1) continue;
        const a = s.night * (1 - s.cloudCover) * Math.sin(Math.PI * k);
        if (a < 0.01) continue;
        const hx = m.x + Math.cos(m.ang) * m.len * k * 1.4;
        const hy = m.y + Math.sin(m.ang) * m.len * k * 1.4;
        const tx = hx - Math.cos(m.ang) * m.len;
        const ty = hy - Math.sin(m.ang) * m.len;
        const g = ctx.createLinearGradient(tx, ty, hx, hy);
        g.addColorStop(0, "rgba(0,0,0,0)");
        g.addColorStop(1, text);
        ctx.globalAlpha = a * 0.9;
        ctx.strokeStyle = g;
        ctx.lineWidth = 1.2;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(hx, hy);
        ctx.stroke();
      }

      // Rain: three depths in --text, alpha × 0.4 behind the hero text and × 2.5 in a lightning stroke.
      if (nRain) {
        const slope = Math.tan(s.rainSlant);
        ctx.strokeStyle = text;
        ctx.lineCap = "butt";
        const n = layerCounts(nRain);
        const flash = 1 + 1.5 * s.flash;
        let i0 = 0;
        for (const id of RAIN_LAYERS) {
          const spec = RAIN_LAYER[id];
          const i1 = i0 + n[id];
          const mid = (spec.alpha[0] + spec.alpha[1]) / 2;
          ctx.lineWidth = spec.width;
          for (const half of [0, 1]) {
            const a = spec.alpha[0] + (spec.alpha[1] - spec.alpha[0]) * (0.25 + 0.5 * half);
            for (const inCol of [false, true]) {
              ctx.globalAlpha = a * (inCol ? 0.4 : 1) * flash;
              ctx.beginPath();
              for (let i = i0; i < i1; i++) {
                if (Number(rA[i]! > mid) !== half) continue;
                const x = rX[i]!;
                const y = rY[i]!;
                if (under(x, y) > 0.5 ? !inCol : inCol) continue;
                ctx.moveTo(x, y);
                ctx.lineTo(x - rL[i]! * slope, y - rL[i]!);
              }
              ctx.stroke();
            }
          }
          i0 = i1;
        }
      }
      ctx.globalAlpha = 1;
    },
  };
}

export type Particles = NonNullable<ReturnType<typeof createParticles>>;
