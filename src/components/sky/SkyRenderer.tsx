"use client";

import { useEffect, useRef, useState } from "react";
import { brand } from "@/lib/brand";
import { onSky } from "@/lib/signal-bus";
import { hexToRgb, oklabToRgb, toLinear, type Lab } from "@/lib/sky/color";
import { dayness } from "@/lib/sky/gradient";
import { skyModel, type SkyModel } from "@/lib/sky/model";
import { effectiveWeather, SKY_DEBUG, skyStore, skyTime } from "@/lib/sky/store";
import { dayOfYear } from "@/lib/sky/time";
import { ALT_REF, nightPoint, sunPath, type ArcGeom } from "@/lib/sky/arc";
import { columnMask, COLUMN_BREAK, rampMask, SUN_UNDER_TEXT } from "@/lib/sky/scrim";
import { geomNow, notifyGeometry, onViewGeometry, onViewScroll, runtime, scrimTop, view } from "@/lib/sky/view";
import { createAtmosphere, type Atmosphere } from "./atmosphere";
import { createSun, drawArc, type SunState } from "./bodies";
import { CLOUD_REFRESH_S, createCloudField } from "./cloud-field";
import { createParticles, mulberry32, type Particles, type ParticleState } from "./particles";

const TEST = process.env.NEXT_PUBLIC_E2E === "1";

/** Smoothed shader inputs, keyed by uniform name. Each converges over ~4 s (exponential, τ = 1 s); 0.12 s while scrubbing. */
type Targets = Record<string, number | number[]>;

const linear = (lab: Lab) => oklabToRgb(lab).map(toLinear);

function targetsOf(m: SkyModel): Targets {
  return {
    uSunX: m.sunX,
    uGlow: m.glow,
    uGolden: m.glow,
    uDay: dayness(m.astro.elevation),
    uNight: m.night,
    uCloudCover: m.cloudCover,
    uFog: m.fog,
    uRainDark: m.rainDark,
    uWind: m.wind,
    uMoonPos: [m.moon.x, m.moon.y],
    sunPos: [m.sun.x, m.sun.y],
    sunAlt: m.sun.alt,
    uMoonIllum: m.moon.fraction,
    uMoonUp: m.moon.up ? 1 : 0,
    uZenith: linear(m.colors.zenith),
    uMid: linear(m.colors.mid),
    uHorizon: linear(m.colors.horizon),
  };
}

function approach(cur: Targets, to: Targets, k: number): void {
  for (const key in to) {
    const b = to[key]!;
    const a = cur[key]!;
    cur[key] = typeof b === "number" ? (a as number) + (b - (a as number)) * k : b.map((v, i) => (a as number[])[i]! + (v - (a as number[])[i]!) * k);
  }
}

const clone = (t: Targets): Targets => ({ ...t });

/** Lightning: a strike every 18–45 s, double pulse 80 ms on, 60 ms off, 120 ms on. ≤ 2 flashes a second. */
export function lightningEnvelope(sinceStrike: number): number {
  const ms = sinceStrike * 1000;
  if (ms < 0) return 0;
  if (ms < 80) return 1;
  if (ms < 140) return 0;
  if (ms < 260) return 0.85;
  return 0;
}

function readToken(name: string): [number, number, number] {
  return hexToRgb(getComputedStyle(document.documentElement).getPropertyValue(name).trim() || brand.text);
}

type Window2 = Window & {
  __sky?: {
    state: string;
    elevation: number;
    scrimA: number;
    fps: number;
    condition: string;
    frames?: number;
    webgl?: boolean;
    cap?: number;
    sun?: { x: number; y: number; up: boolean; cloud: number; dim: number };
    moon?: { x: number; y: number; up: boolean };
    geom?: ArcGeom;
  };
};


const smooth01 = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

function start(atmCanvas: HTMLCanvasElement, ptsCanvas: HTMLCanvasElement, onNoWebGL: () => void): () => void {
  let dead = false;
  const isDead = () => dead;
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const coarse = matchMedia("(pointer: coarse)").matches;
  const q = new URLSearchParams(window.location.search);
  const forceBolt = SKY_DEBUG && q.get("bolt") === "1";
  const origin = performance.now();
  const now = () => (performance.now() - origin) / 1000;
  const rng = mulberry32(Date.now() & 0xffffffff);
  const w2 = window as Window2;

  let atm: Atmosphere | null = null;
  let pts: Particles | null = null;
  const sunR = () => (view.vw < COLUMN_BREAK ? 13 : 16);
  const sunLayer = createSun(() => Math.min(window.devicePixelRatio || 1, 2));
  const clouds = createCloudField();
  const drift: [number, number] = [0, 0];
  let lastClouds = -Infinity;
  let geom = geomNow();
  let model = skyModel(skyTime(), effectiveWeather(skyStore.get()), geom);
  let target = targetsOf(model);
  const cur = clone(target);
  let raf = 0,
    running = false,
    lastDraw = 0,
    hidden = document.hidden,
    lost = false,
    reduce = motion.matches,
    frames = 0,
    fps = 0,
    fpsWindow = 0,
    fpsFrames = 0,
    nextStrike = 0,
    strikeAt = -1,
    nextMeteor = 0,
    astroTimer = 0,
    nightArc = 0,
    lastScroll = -Infinity;
  let text = "rgb(230,234,242)";
  let pathKey = "";
  let dayPath: { x: number; y: number }[] = [];
  let nightPath: { x: number; y: number }[] = [];

  const scheduleStrike = (t: number) => (nextStrike = t + 18 + rng() * 27);
  const scheduleMeteor = (t: number) => (nextMeteor = t + 40 + rng() * 50);

  const recompute = () => {
    const s = skyStore.get();
    geom = geomNow();
    model = skyModel(skyTime(s), effectiveWeather(s), geom);
    target = targetsOf(model);
    pts?.ensureDay(dayOfYear(skyTime(s)));
    if (TEST && w2.__sky) Object.assign(w2.__sky, { state: model.astro.state, elevation: model.astro.elevation, condition: model.condition });
  };

  const n = (k: string) => cur[k] as number;
  const v2 = (k: string) => cur[k] as number[];

  /** Dimming of a body at (x, y) with radius r: under the column scrim, and behind the hero text block. */
  const textDim = (x: number, y: number, r: number, scrim: number) => {
    let k = 1 - (1 - SUN_UNDER_TEXT) * columnMask(x, view.vw) * rampMask(y, scrim);
    const h = view.hero;
    if (h) {
      const hy = h.y - view.y;
      const dx = Math.max(h.x - x, 0, x - (h.x + h.w));
      const dy = Math.max(hy - y, 0, y - (hy + h.h));
      k = Math.min(k, SUN_UNDER_TEXT + (1 - SUN_UNDER_TEXT) * smooth01(0, 3 * r, Math.hypot(dx, dy)));
    }
    return k;
  };

  const refreshClouds = (t: number) => {
    clouds.resize(view.vw, view.vh);
    clouds.update({ drift, z: 0.015 * t, cover: n("uCloudCover"), rainDark: n("uRainDark") });
    lastClouds = t;
    if (!runtime.cloudsIn) {
      runtime.cloudsIn = (x0, y0, x1, y1) => clouds.maxIn(x0, y0, x1, y1);
      notifyGeometry();
    }
  };

  const moonR = () => (view.vw < COLUMN_BREAK ? 12 : 14);
  const particleState = (): ParticleState => ({
    night: n("uNight"),
    cloudCover: n("uCloudCover"),
    fog: n("uFog"),
    rainDensity: model.rainDensity,
    rainSlant: model.rainSlant,
    moon: { ...model.moon, x: (cur.uMoonPos as number[])[0]!, y: (cur.uMoonPos as number[])[1]! },
    moonVisible:
      n("uMoonUp") *
      n("uNight") *
      (clouds.ready ? 1 - 0.85 * clouds.at(v2("uMoonPos")[0]! * view.vw, v2("uMoonPos")[1]! * view.vh) : Math.max(0, 1 - 1.05 * n("uCloudCover")) ** 0.7) *
      (1 - 0.6 * n("uFog")),
    moonR: moonR(),
    moonDim: textDim(v2("uMoonPos")[0]! * view.vw, v2("uMoonPos")[1]! * view.vh, moonR(), Infinity),
    halo: { r: (22 / ALT_REF) * (geom.horizonY - geom.apexY), a: model.humidity > 85 ? 1 : 0 },
  });

  const sunState = (scrim: number): SunState => {
    const [fx, fy] = v2("sunPos");
    const x = fx! * view.vw;
    const y = fy! * view.vh;
    const alt = n("sunAlt");
    const r = sunR();
    return {
      x,
      y,
      r,
      alt,
      up: model.sun.up,
      glow: n("uGlow"),
      horizon: oklabToRgb(model.colors.horizon),
      cloud: clouds.ready ? clouds.at(x, y) : n("uCloudCover") > 0.9 ? n("uCloudCover") : 0,
      fog: n("uFog"),
      cover: n("uCloudCover"),
      dim: textDim(x, y, r, scrim) * smooth01(-0.9, 0.6, alt),
    };
  };

  const arcPaths = () => {
    const d = skyTime();
    const key = `${d.toISOString().slice(0, 10)}|${geom.w}|${geom.h}|${geom.horizonY}`;
    if (key !== pathKey) {
      pathKey = key;
      dayPath = sunPath(d, geom);
      const depth = Math.min(70, (view.vh - geom.horizonY) * 0.45);
      nightPath = Array.from({ length: 33 }, (_, i) => nightPoint(i / 32, geom, depth));
    }
  };


  const draw = (t: number, dt: number, still: boolean) => {
    let lightning = 0;
    if (!still && model.thunder) {
      if (forceBolt) lightning = 1;
      else {
        if (!nextStrike) scheduleStrike(t);
        if (t >= nextStrike) {
          strikeAt = t;
          scheduleStrike(t);
        }
        lightning = strikeAt >= 0 ? lightningEnvelope(t - strikeAt) : 0;
      }
    } else if (still && model.thunder && forceBolt) lightning = 1;
    const scrim = scrimTop();
    if (!still) {
      drift[0] += v2("uWind")[0]! * dt;
      drift[1] += v2("uWind")[1]! * dt;
    }
    if (still || t - lastClouds >= CLOUD_REFRESH_S) refreshClouds(t);
    const u: Targets = { ...cur, uTime: still ? 0 : t, uLightning: lightning, uScrimTop: scrim, uDrift: drift, uZ: 0.015 * t };
    if (atm && !lost) atm.draw(u);
    if (pts) {
      const ps = particleState();
      const ss = sunState(scrim);
      const scrubbing = skyStore.get().preview !== null;
      nightArc += ((scrubbing ? 1 : 0) - nightArc) * (still ? 1 : 1 - Math.exp(-dt / 0.3));
      arcPaths();
      const day = dayOfYear(skyTime());
      pts.step(still ? 0 : dt, ps);
      pts.draw(t, skyTime().getTime(), ps, !still, scrim, {
        back: (ctx) => drawArc(ctx, dayPath, nightPath, text, nightArc),
        front: (ctx) =>
          sunLayer.draw(ctx, ss, still ? 0 : t, day, (a) => {
            const px = ss.x + Math.cos(a) * 180;
            const py = ss.y + Math.sin(a) * 180;
            return 1 - clouds.at(px, py);
          }),
      });
      if (TEST && w2.__sky) {
        w2.__sky.sun = { x: ss.x, y: ss.y, up: ss.up, cloud: ss.cloud, dim: ss.dim };
        w2.__sky.moon = { x: ps.moon.x * view.vw, y: ps.moon.y * view.vh, up: ps.moon.up };
        w2.__sky.geom = geom;
      }
    }
    frames++;
    if (TEST && w2.__sky) w2.__sky.frames = frames;
    if (frames === 1) {
      atmCanvas.dataset.ready = "";
      ptsCanvas.dataset.ready = "";
    }
    return lightning > 0;
  };

  const loop = () => {
    raf = requestAnimationFrame(loop);
    const t = now();
    const dt = Math.min(t - lastDraw, 0.1);
    const s = skyStore.get();
    const raining = model.rainDensity > 0;
    const scrolling = t - lastScroll < 0.25;
    const busy = raining || (pts?.meteorActive(t) ?? false) || (strikeAt >= 0 && t - strikeAt < 0.3) || forceBolt || s.scrubbing || scrolling;
    const cap = coarse ? (raining ? 30 : 20) : busy ? 60 : 24;
    if (TEST && w2.__sky) w2.__sky.cap = cap;
    if (cap < 60 && dt < 1 / cap - 0.004) return;
    approach(cur, target, 1 - Math.exp(-dt / (s.scrubbing || s.preview !== null ? 0.12 : 1)));
    if (model.night > 0.3 && model.cloudCover < 0.6 && !reduce) {
      if (!nextMeteor) scheduleMeteor(t);
      if (t >= nextMeteor) {
        pts?.meteor(t, rng);
        scheduleMeteor(t);
      }
    }
    draw(t, dt, false);
    lastDraw = t;
    fpsFrames++;
    if (t - fpsWindow >= 1) {
      fps = Math.round(fpsFrames / (t - fpsWindow));
      fpsFrames = 0;
      fpsWindow = t;
      if (TEST && w2.__sky) w2.__sky.fps = fps;
    }
  };

  const sync = () => {
    const go = !reduce && !hidden && !dead;
    if (go && !running) {
      running = true;
      lastDraw = now();
      fpsWindow = lastDraw;
      fpsFrames = 0;
      raf = requestAnimationFrame(loop);
    } else if (!go && running) {
      running = false;
      cancelAnimationFrame(raf);
      if (TEST && w2.__sky) w2.__sky.fps = 0;
    }
  };

  const still = () => {
    Object.assign(cur, clone(target));
    draw(0, 0, true);
    if (TEST && w2.__sky) w2.__sky.fps = 0;
  };

  // Astronomy every 60 s (and on every store change: weather, preview).
  const astroLoop = () => {
    window.clearTimeout(astroTimer);
    recompute();
    if (reduce) still();
    if (!hidden) astroTimer = window.setTimeout(astroLoop, 60_000);
  };
  const unsubStore = skyStore.subscribe(() => {
    recompute();
    if (reduce) still();
  });
  // Layout and scroll: the arc follows the stage; under reduced motion the static frame is redrawn once scrolling
  // stops (the column dimming depends on where the scrim is), never during.
  let stillTimer = 0;
  const unsubGeom = onViewGeometry(() => {
    recompute();
    if (reduce) still();
  });
  const unsubScroll = onViewScroll(() => {
    lastScroll = now();
    if (reduce) {
      window.clearTimeout(stillTimer);
      stillTimer = window.setTimeout(still, 150);
    }
  });
  const unsubBus = onSky((e) => {
    if (e.type === "meteor" && !reduce) pts?.meteor(now(), rng);
  });

  const onVisibility = () => {
    hidden = document.hidden;
    if (!hidden) astroLoop();
    sync();
  };
  const applyMotion = () => {
    reduce = motion.matches;
    sync();
    if (reduce) still();
  };
  const onLost = (e: Event) => {
    e.preventDefault();
    lost = true;
  };
  const onRestored = () => {
    void atm?.restore().then((ok) => {
      lost = !ok;
      if (reduce) still();
    });
  };

  let resizeTimer = 0;
  const resize = () => {
    atm?.resize();
    pts?.resize(dayOfYear(skyTime()));
  };
  const ro = new ResizeObserver(() => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      resize();
      if (reduce) still();
    }, 100);
  });

  void (async () => {
    const tx = readToken("--text");
    text = `rgb(${tx.map((c) => Math.round(c * 255)).join(",")})`;
    pts = createParticles(ptsCanvas, tx);
    atm = await createAtmosphere(atmCanvas, SKY_DEBUG, isDead);
    if (dead) return;
    if (!atm) onNoWebGL();
    if (TEST) w2.__sky = { state: model.astro.state, elevation: model.astro.elevation, scrimA: w2.__sky?.scrimA ?? 0, fps: 0, condition: model.condition, webgl: !!atm };
    resize();
    ro.observe(ptsCanvas);
    motion.addEventListener("change", applyMotion);
    document.addEventListener("visibilitychange", onVisibility);
    atmCanvas.addEventListener("webglcontextlost", onLost);
    atmCanvas.addEventListener("webglcontextrestored", onRestored);
    astroLoop();
    if (reduce) still();
    else sync();
  })();

  return () => {
    dead = true;
    running = false;
    cancelAnimationFrame(raf);
    window.clearTimeout(astroTimer);
    window.clearTimeout(resizeTimer);
    window.clearTimeout(stillTimer);
    runtime.cloudsIn = null;
    unsubGeom();
    unsubScroll();
    unsubStore();
    unsubBus();
    ro.disconnect();
    motion.removeEventListener("change", applyMotion);
    document.removeEventListener("visibilitychange", onVisibility);
    atmCanvas.removeEventListener("webglcontextlost", onLost);
    atmCanvas.removeEventListener("webglcontextrestored", onRestored);
  };
}

/** Atmosphere (WebGL2, z −3) and particles (Canvas 2D, z −2), one loop. Loaded after idle; the CSS gradient covers first paint. */
export default function SkyRenderer() {
  const atm = useRef<HTMLCanvasElement>(null);
  const pts = useRef<HTMLCanvasElement>(null);
  const [webgl, setWebgl] = useState(true);

  useEffect(() => {
    if (!atm.current || !pts.current) return;
    return start(atm.current, pts.current, () => setWebgl(false));
  }, []);

  return (
    <>
      {webgl ? <canvas ref={atm} aria-hidden="true" className="sky-layer sky-atmosphere" data-sky-atmosphere="" /> : null}
      <canvas ref={pts} aria-hidden="true" className="sky-layer sky-particles" data-sky-particles="" />
    </>
  );
}
