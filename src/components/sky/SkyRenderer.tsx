"use client";

import { useEffect, useRef, useState } from "react";
import { brand } from "@/lib/brand";
import { onSky } from "@/lib/signal-bus";
import { hexToRgb, oklabToRgb, rgbToOklab, toGamma, toLinear, type Lab } from "@/lib/sky/color";
import { dayness } from "@/lib/sky/gradient";
import { driftVector, MIN_DRIFT, skyModel, type SkyModel } from "@/lib/sky/model";
import { effectiveWeather, skyStore, skyTime } from "@/lib/sky/store";
import { dayOfYear, dhakaParts } from "@/lib/sky/time";
import { sunColor } from "@/lib/sky/gradient";
import { nightPoint, sunPath, type ArcGeom } from "@/lib/sky/arc";
import {
  COLUMN_BREAK,
  geomNow,
  notifyGeometry,
  onViewGeometry,
  onViewScroll,
  runtime,
  view,
} from "@/lib/sky/view";
import { startBacking, type BackingRunner } from "./backing-runner";
import { createAtmosphere, type Atmosphere } from "./atmosphere";
import { createSun, drawArc, type SunState } from "./bodies";
import { CLOUD_REFRESH_S, createCloudField } from "./cloud-field";
import { createLandscape, GLOW_HORIZON, LIFT, type Landscape } from "./landscape";
import { createLife, TAKEOFF_S, type Life, type LifeFrame } from "./life";
import { createAmbient, type Ambient } from "./ambient";
import {
  cityGlowAlpha,
  CITY_GLOW_REACH,
  fireflyCount,
  moonRimAlpha,
} from "@/lib/sky/landscape/lights";
import { createParticles, mulberry32, type Particles, type ParticleState } from "./particles";
import {
  closingWalk,
  gutterCentre,
  landMode,
  PARALLAX,
  solveAnchors,
  stageWalk,
  type LandMode,
} from "@/lib/sky/landscape/anchors";
import { buildClosingScene, buildStageScene, buildWorld } from "@/lib/sky/landscape/world";
import { sunLight, WASH_MAX } from "@/lib/sky/landscape/colors";
import {
  bandArrival,
  createArrival,
  FADE_IN_S,
  planePx,
  RESPAWN_S,
  visibleShare,
} from "@/lib/sky/landscape/plane";
import { SCENE_HORIZON } from "@/lib/sky/arc";
import {
  awayY,
  createHorizonTracker,
  flatHorizon,
  GROUND_FADE,
  horizonCss,
  horizonTarget,
  type Horizon,
} from "@/lib/sky/horizon";

const TEST = process.env.NEXT_PUBLIC_E2E === "1";
/** The sky's debug flag (store.ts SKY_DEBUG), written out here so a release build folds what it guards away (as atmosphere.ts does). */
const DEBUG = process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_SKY_DEBUG === "1" || process.env.NEXT_PUBLIC_E2E === "1";
/** The clear-sky cirrus floor on phones (an aesthetic choice, DECISIONS). */
const CIRRUS_FLOOR = 0.06;

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
    uWind: driftVector(
      m.windKmh,
      m.windFromDeg,
      view.vw < COLUMN_BREAK ? MIN_DRIFT.mobile : MIN_DRIFT.desktop,
    ),
    uMoonPos: [m.moon.x, m.moon.y],
    // Phones, clear day or golden hour: an aesthetic floor of thin cirrus in the top 30% of the stage (not data).
    uCirrus:
      view.vw < 640 && view.stage > 0 && m.cloudCover < CIRRUS_FLOOR && m.astro.elevation > -2
        ? CIRRUS_FLOOR
        : 0,
    uCirrusY: 0.3 * (view.stage - (view.sections.stage ?? 0)),
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
    cur[key] =
      typeof b === "number"
        ? (a as number) + (b - (a as number)) * k
        : b.map((v, i) => (a as number[])[i]! + (v - (a as number[])[i]!) * k);
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
  return hexToRgb(
    getComputedStyle(document.documentElement).getPropertyValue(name).trim() || brand.text,
  );
}

type Window2 = Window & {
  __sky?: {
    state: string;
    elevation: number;
    fps: number;
    condition: string;
    frames?: number;
    webgl?: boolean;
    cap?: number;
    sun?: { x: number; y: number; up: boolean; cloud: number; dim: number };
    moon?: { x: number; y: number; up: boolean };
    geom?: ArcGeom;
    plane?: { state: string; flights: number };
    /** Test builds: hold the take-off at s seconds in (null lets go). */
    pinPlane?: (s: number | null) => void;
    place?: string | null;
    land?: {
      mode: LandMode;
      offsets: number[];
      marks: { id: string; x: number }[];
      closing?: { id: string; x: number }[];
    };
  };
};

const smooth01 = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

function start(
  atmCanvas: HTMLCanvasElement,
  ptsCanvas: HTMLCanvasElement,
  fixedCanvas: HTMLCanvasElement,
  onNoWebGL: () => void,
): () => void {
  let dead = false;
  const isDead = () => dead;
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const coarse = matchMedia("(pointer: coarse)").matches;
  const q = new URLSearchParams(window.location.search);
  const forceBolt = DEBUG && q.get("bolt") === "1";
  const origin = performance.now();
  const now = () => (performance.now() - origin) / 1000;
  const rng = mulberry32(Date.now() & 0xffffffff);
  const w2 = window as Window2;

  let atm: Atmosphere | null = null;
  let pts: Particles | null = null;
  /**
   * Landscape bands: the fixed band (gutter and centre modes) and, in scene mode, the stage's horizon and the
   * closing band above the footer (canvases created inside their [data-sky-scene] slots).
   */
  type Band = {
    id: "fixed" | "stage" | "closing";
    canvas: HTMLCanvasElement;
    land: Landscape;
    frame: LifeFrame | null;
    slot: HTMLElement | null;
    docTop: number;
  };
  let bands: Band[] = [];
  let life: Life | null = null;
  let ambient: Ambient | null = null;
  let backing: BackingRunner | null = null;
  let lastLight = -Infinity;
  let takeoffUntil = -Infinity;
  // The plane takes off on every arrival at the airport (src/lib/sky/landscape/plane.ts createArrival): in the
  // fixed band once at least half the airport is on screen and the page is within 400px of its bottom (re-armed
  // under a tenth of it visible; v5.1 T5), in scene mode when the closing scene is ≥ 60% visible (re-armed under 15%).
  const arrival = createArrival();
  let closingRatio = 0;
  const closingIO = new IntersectionObserver(
    (es) => {
      for (const e of es) closingRatio = e.intersectionRatio;
    },
    { threshold: [0, 0.15, 0.3, 0.6, 0.8, 1] },
  );
  const startTakeoff = (t: number, b: Band, o3: number) => {
    if (!life?.takeoff(t, b.frame, o3)) return false;
    takeoffUntil = t + TAKEOFF_S + RESPAWN_S + FADE_IN_S + 0.2;
    return true;
  };
  const sunR = () => (view.vw < COLUMN_BREAK ? 13 : 16);
  /** The bands drawn in this layout: the fixed band, or the two scenes. */
  const activeBands = () => {
    const scene = landMode(view.vw, !!view.stage) === "scene";
    return bands.filter((b) => (b.id === "fixed") !== scene && b.land.world);
  };
  /** The walk (px) a band's parallax follows; 0 under reduced motion. */
  const walkOf = (b: Band) => {
    if (reduce) return 0;
    if (b.id === "fixed") return view.y;
    if (b.id === "stage")
      return stageWalk(view.y, view.stage - (view.sections.stage ?? 0), view.vw);
    return closingWalk(b.docTop - view.y, b.land.height, view.vh, view.vw);
  };
  const visible = (b: Band) => {
    if (b.id === "fixed") return true;
    const top = b.docTop - view.y - b.land.lift;
    return top < view.vh && top + b.land.height + b.land.lift > 0;
  };
  // Scenes are pre-rendered before they enter the viewport (v5.1 T7). Each is drawn once on the first frame, and
  // drawn ahead while it is within 1.5 viewport heights of the screen, so it is already there, and no longer fading
  // in, when it arrives: even a jump from far away (from the top of the page to the bottom) finds it drawn.
  const approaching = new Set<Element>();
  /** Scenes not drawn yet: each is drawn once whatever is on screen. */
  const undrawn = new Set<Band>();
  const approachIO = new IntersectionObserver(
    (es) => {
      for (const e of es) {
        if (e.isIntersecting) approaching.add(e.target);
        else approaching.delete(e.target);
      }
    },
    { rootMargin: "150% 0px" },
  );
  const drawable = (b: Band) => visible(b) || undrawn.has(b) || (!!b.slot && approaching.has(b.slot));
  // The horizon tracks the visible ground in scene mode (src/lib/sky/horizon.ts): the CSS gradient (--sky-h/--sky-b
  // on its layer), the shader (uHorizonY/B) and the backing model all read it.
  const gradEl = document.querySelector<HTMLElement>("[data-sky-gradient]");
  const tracker = createHorizonTracker();
  let hz: Horizon = flatHorizon(view.vh);
  let hzAt = 0;
  let hzKey = "";
  const sceneMode = () => landMode(view.vw, !!view.stage) === "scene";
  const updateHorizon = (snap = false) => {
    const t = now();
    const dt = Math.min(0.1, Math.max(0, t - hzAt));
    hzAt = t;
    if (!sceneMode()) {
      hz = tracker.step({ id: "flat", ...flatHorizon(view.vh) }, dt, true);
      if (hzKey && gradEl)
        for (const k of Object.keys(horizonCss(hz, 1))) gradEl.style.removeProperty(k);
      hzKey = "";
      return;
    }
    const lines = bands
      .filter((b) => b.id !== "fixed" && b.land.world && b.slot?.isConnected)
      .map((b) => {
        const top = b.docTop - view.y;
        return {
          id: b.id,
          ground: top + SCENE_HORIZON * b.land.height,
          bottom: top + b.land.height,
        };
      });
    hz = tracker.step(horizonTarget(lines, view.vh), dt, snap || reduce);
    const key = `${hz.h.toFixed(1)}|${hz.b.toFixed(1)}|${view.vh}`;
    if (key !== hzKey && gradEl) {
      hzKey = key;
      const props = horizonCss(hz, awayY(view.vh));
      for (const k in props) gradEl.style.setProperty(k, props[k]!);
    }
  };
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
  let tx: [number, number, number] = [0.9, 0.92, 0.95];
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
    backing?.update();
    if (TEST && w2.__sky)
      Object.assign(w2.__sky, {
        state: model.astro.state,
        elevation: model.astro.elevation,
        condition: model.condition,
      });
  };

  const n = (k: string) => cur[k] as number;
  const v2 = (k: string) => cur[k] as number[];

  const refreshClouds = (t: number) => {
    clouds.resize(view.vw, view.vh);
    clouds.update({
      drift,
      z: 0.015 * t,
      cover: n("uCloudCover"),
      rainDark: n("uRainDark"),
      cirrus: n("uCirrus"),
      cirrusY: n("uCirrusY"),
    });
    lastClouds = t;
    if (!runtime.cloudsIn) {
      runtime.cloudsIn = (x0, y0, x1, y1) => clouds.maxIn(x0, y0, x1, y1);
      notifyGeometry();
    }
  };

  const moonR = () => (view.vw < COLUMN_BREAK ? 12 : 14);
  /**
   * How much cloud is in front of a point 0..1: the cloud field's opacity there, thickened by rain (a storm deck
   * is darker than its alpha says) and by full cover (no gaps in an overcast sky).
   */
  const occlusion = (x: number, y: number) => {
    const cover = n("uCloudCover");
    const c = clouds.ready ? clouds.at(x, y) : cover;
    return Math.min(1, c * (1 + 0.6 * n("uRainDark")) + Math.max(0, cover - 0.85) * 3);
  };
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
      Math.max(
        0,
        1 - 1.05 * occlusion(v2("uMoonPos")[0]! * view.vw, v2("uMoonPos")[1]! * view.vh),
      ) **
        0.7 *
      (1 - 0.6 * n("uFog")),
    moonR: moonR(),
    moonDim: 1,
  });

  const sunState = (): SunState => {
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
      cloud: occlusion(x, y),
      fog: n("uFog"),
      cover: n("uCloudCover"),
      // Only cloud and altitude change the sun: nothing dims it behind text (loose text gets its own backing).
      dim: smooth01(-0.9, 0.6, alt),
    };
  };

  /**
   * What the backing model needs from the renderer: the model's targets (not the smoothed values, so a weather or
   * preview change is judged where it's heading), the sun and moon as drawn, the city glows.
   */
  const backingScene = () => {
    const m = model;
    const sx = m.sun.x * view.vw;
    const sy = m.sun.y * view.vh;
    const mx = m.moon.x * view.vw;
    const my = m.moon.y * view.vh;
    const moonVis = m.night * Math.max(0, 1 - 1.05 * occlusion(mx, my)) ** 0.7 * (1 - 0.6 * m.fog);
    return {
      m,
      sun: m.sun.up
        ? { x: sx, y: sy, r: sunR(), alt: m.sun.alt, cloud: occlusion(sx, sy), fog: m.fog }
        : null,
      moon:
        m.moon.up && moonVis > 0.01
          ? {
              x: mx,
              y: my,
              r: moonR(),
              visible: moonVis,
              glow: m.moon.fraction * m.night * (1 - 0.7 * m.cloudCover),
            }
          : null,
      glows: activeBands()
        .filter(visible)
        .map((b) => ({
          horizonY:
            b.canvas.getBoundingClientRect().top +
            b.land.lift +
            GLOW_HORIZON * (b.land.world?.s ?? 1),
          reach: CITY_GLOW_REACH * view.vh,
          alpha: cityGlowAlpha(
            dhakaParts(skyTime()).minutes,
            m.cloudCover,
            smooth01(0.5, -1.5, m.sun.alt),
          ),
        })),
      lands: activeBands()
        .filter(visible)
        .map((b) => ({
          top: b.canvas.getBoundingClientRect().top + b.land.lift,
          h: b.land.height,
        })),
      horizon: sceneMode() ? hz : undefined,
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

  // Dev/test builds: main-thread ms per frame, logged every 60 frames next to the GPU timer.
  const cpu: number[] = [];
  const draw = (t: number, dt: number, still: boolean) => {
    const c0 = DEBUG ? performance.now() : 0;
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
    if (!still) {
      drift[0] += v2("uWind")[0]! * dt;
      drift[1] += v2("uWind")[1]! * dt;
    }
    if (still || t - lastClouds >= CLOUD_REFRESH_S) refreshClouds(t);
    updateHorizon(still);
    const u: Targets = {
      ...cur,
      uHorizonY: hz.h,
      uHorizonB: hz.b,
      uTime: still ? 0 : t,
      uLightning: lightning,
      uDrift: drift,
      uZ: 0.015 * t,
    };
    if (atm && !lost) atm.draw(u);
    if (pts) {
      const ps = particleState();
      const ss = sunState();
      const scrubbing = skyStore.get().preview !== null;
      nightArc += ((scrubbing ? 1 : 0) - nightArc) * (still ? 1 : 1 - Math.exp(-dt / 0.3));
      arcPaths();
      const day = dayOfYear(skyTime());
      pts.step(still ? 0 : dt, ps);
      const hero = view.hero;
      pts.draw(
        t,
        skyTime().getTime(),
        ps,
        !still,
        {
          back: (ctx) => drawArc(ctx, dayPath, nightPath, text, nightArc),
          front: (ctx) => {
            sunLayer.draw(ctx, ss, still ? 0 : t, day, (a) => {
              const px = ss.x + Math.cos(a) * 180;
              const py = ss.y + Math.sin(a) * 180;
              return 1 - clouds.at(px, py);
            });
            if (!still && ambient) {
              ambient.sky(ctx, {
                t,
                w: view.vw,
                h: view.vh,
                birds: n("sunAlt") > 0 && model.rainDensity === 0 && model.condition !== "fog",
                night: n("uNight") > 0.5,
                hero: hero ? { y0: hero.y - view.y, y1: hero.y + hero.h - view.y } : null,
                ink: activeBands()[0]?.land.colorOf("L3") ?? text,
              });
            }
          },
        },
        hero
          ? { x0: hero.x, y0: hero.y - view.y, x1: hero.x + hero.w, y1: hero.y + hero.h - view.y }
          : null,
      );
      if (TEST && w2.__sky) {
        w2.__sky.sun = { x: ss.x, y: ss.y, up: ss.up, cloud: ss.cloud, dim: ss.dim };
        w2.__sky.moon = { x: ps.moon.x * view.vw, y: ps.moon.y * view.vh, up: ps.moon.up };
        w2.__sky.geom = geom;
      }
    }
    const active = activeBands();
    if (active.length && life) {
      const scrubbing = skyStore.get().scrubbing;
      if (still || t - lastLight >= (scrubbing ? 1 / 30 : 2)) {
        const hzLab = rgbToOklab(
          v2("uHorizon").map((c) => toGamma(Math.min(1, Math.max(0, c)))) as [
            number,
            number,
            number,
          ],
        );
        const alt0 = n("sunAlt");
        const rim = n("uGlow") * smooth01(-2, 1, alt0);
        const lighting = {
          horizon: hzLab,
          k: sunLight(alt0),
          wash: WASH_MAX * rim,
          rim,
          sunX: v2("sunPos")[0]! * view.vw,
          night: smooth01(-6, -14, alt0),
          glow: cityGlowAlpha(
            dhakaParts(skyTime()).minutes,
            n("uCloudCover"),
            smooth01(0.5, -1.5, alt0),
          ),
          glowReach: CITY_GLOW_REACH * view.vh,
          moonRim: moonRimAlpha(model.moon.up, n("uMoonIllum"), n("uNight"), n("uCloudCover")),
          moonX: v2("uMoonPos")[0]! * view.vw,
        };
        for (const b of active) b.land.setLighting(lighting);
        lastLight = t;
      }
      const at = skyTime();
      const alt = n("sunAlt");
      const ss = sunState();
      const moonAlt = model.astro.moon.altitudeDeg;
      const ps = particleState();
      const mins = dhakaParts(at).minutes;
      const glints = [
        {
          x: ss.x,
          k:
            ss.up && alt < 12
              ? (1 - Math.max(0, alt) / 12) * (1 - ss.cloud) * smooth01(-0.9, 0.6, alt)
              : 0,
          rgb: sunColor(alt),
          r: ss.r,
        },
        {
          x: ps.moon.x * view.vw,
          k:
            ps.moon.up && moonAlt < 12
              ? (1 - Math.max(0, moonAlt) / 12) * ps.moonVisible * (0.3 + 0.7 * ps.moon.fraction)
              : 0,
          rgb: tx,
          r: ps.moonR,
        },
      ];
      for (const b of active) {
        const world = b.land.world;
        // Off screen, the closing scene can still re-arm the arrival.
        if (world?.airport && !visible(b)) arrival.update(false, closingRatio < 0.15, false);
        if (!world || !drawable(b)) continue;
        undrawn.delete(b);
        const f: LifeFrame = {
          t,
          moving: !still,
          w: view.vw,
          world,
          minutes: mins,
          seed: dayOfYear(at),
          dark: smooth01(2, -5, alt),
          lamps: smooth01(0.5, -1.5, alt),
          glints,
          l3: b.land.colorOf("L3"),
          tones: b.land.tones,
          wind: { kmh: model.windKmh, side: model.wind[0] < 0 ? -1 : 1 },
          planePx: planePx(view.vw),
        };
        b.frame = f;
        const walk = walkOf(b);
        // The slow life (fireflies, the rickshaw) lives on the first band only.
        const ll =
          b === active[0]
            ? {
                t,
                w: view.vw,
                s: world.s,
                fireflies:
                  n("uNight") > 0.5 ? fireflyCount(dhakaParts(at).m, model.rainDensity > 0) : 0,
                rickshaw: mins >= 6 * 60 && mins < 21 * 60 + 30 && model.rainDensity < 20,
                l4: b.land.colorOf("L4"),
              }
            : null;
        if (world.airport && !reduce && !still && life) {
          // Arrival at the airport: fire once, re-arm only after leaving.
          const o3 = walk * PARALLAX.L3;
          let near = false;
          let away = false;
          if (b.id === "closing") {
            near = closingRatio >= 0.6;
            away = closingRatio < 0.15;
          } else {
            // The fixed band: how much of the airport's width is on screen, and how far the page is from its bottom.
            const m = world.marks.find((k) => k.id === "airport");
            const seen = m ? visibleShare(m.x0 * world.s - o3, m.x1 * world.s - o3, view.vw) : 0;
            ({ near, away } = bandArrival(seen, view.docH - view.vh - view.y));
          }
          if (arrival.update(near, away, life.ready(t) && b.frame !== null)) startTakeoff(t, b, o3);
        }
        b.land.draw(walk, (g, layer, o) => {
          life!.between(g, layer, o, f);
          if (ll && !still && ambient && (layer === "L2" || layer === "L4"))
            ambient.land(g, layer, o, ll);
        });
        if (!("ready" in b.canvas.dataset)) b.canvas.dataset.ready = "";
      }
      if (TEST && w2.__sky) {
        const main = active[0]!;
        const mw = main.land.world;
        const walk = walkOf(main);
        const marks = (b: Band | undefined) =>
          b?.land.world
            ? b.land.world.marks.map((m) => ({
                id: m.id,
                x: ((m.x0 + m.x1) / 2) * b.land.world!.s - walkOf(b) * PARALLAX.L3,
              }))
            : undefined;
        if (mw)
          w2.__sky.land = {
            mode: landMode(view.vw, !!view.stage),
            offsets: [PARALLAX.L1, PARALLAX.L2, PARALLAX.L3, PARALLAX.L4].map((k) => walk * k),
            marks: marks(main)!,
            closing: marks(active.find((b) => b.id === "closing")),
          };
      }
    }
    if (DEBUG && !still) {
      cpu.push(performance.now() - c0);
      if (cpu.length >= 60) {
        const avg = cpu.reduce((a, b) => a + b, 0) / cpu.length;
        const max = Math.max(...cpu);
        console.info(
          `[sky] CPU ${avg.toFixed(3)} ms/frame (max ${max.toFixed(2)}) at ${view.vw}x${view.vh}`,
        );
        cpu.length = 0;
      }
    }
    frames++;
    if (TEST && w2.__sky) {
      w2.__sky.frames = frames;
      if (life) w2.__sky.plane = life.plane(t);
    }
    if (frames === 1) {
      atmCanvas.dataset.ready = "";
      ptsCanvas.dataset.ready = "";
      // The server-rendered first-paint fallback (src/components/sky/SkyFallback.tsx) has done its job: it fades out
      // over 400ms and is then hidden (globals.css). Never removed: React owns those nodes, and removing them here
      // made the next client navigation throw "removeChild".
      document.documentElement.dataset.skyFallbackDone = "done";
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
    const busy =
      raining ||
      (pts?.meteorActive(t) ?? false) ||
      (strikeAt >= 0 && t - strikeAt < 0.3) ||
      forceBolt ||
      s.scrubbing ||
      scrolling ||
      t < takeoffUntil ||
      tracker.moving ||
      (ambient?.active() ?? false);
    const cap = coarse ? (raining || scrolling || s.scrubbing ? 30 : 20) : busy ? 60 : 24;
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
  // stops, never during.
  let stillTimer = 0;
  const unsubGeom = onViewGeometry(() => {
    recompute();
    relayoutLand();
    if (reduce) still();
  });
  const unsubScroll = onViewScroll(() => {
    lastScroll = now();
    updateHorizon();
    if (reduce) {
      window.clearTimeout(stillTimer);
      stillTimer = window.setTimeout(still, 150);
    }
  });
  // The landscape stays on the bottom of the visual viewport (iOS toolbars, pinch zoom).
  const vv = window.visualViewport;
  const onVV = () => {
    if (!vv) return;
    const gap = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    fixedCanvas.style.transform = gap > 0.5 ? `translateY(${-gap}px)` : "";
  };
  vv?.addEventListener("resize", onVV);
  vv?.addEventListener("scroll", onVV);
  // "Book 30 min" hovered, focused or tapped (pointerdown, before navigation; nothing waits for it) with the
  // airport on screen: the parked plane takes off.
  const onIntent = (e: Event) => {
    if (reduce || !(e.target instanceof Element) || !e.target.closest("[data-sky-takeoff]")) return;
    const b = activeBands().find((x) => x.land.world?.airport && visible(x));
    const w = b?.land.world;
    if (!b || !w?.airport) return;
    const x = w.airport.gate[0] * w.s - walkOf(b) * PARALLAX.L3;
    if (x > 0 && x < view.vw) startTakeoff(now(), b, walkOf(b) * PARALLAX.L3);
  };
  document.addEventListener("pointerover", onIntent);
  document.addEventListener("pointerdown", onIntent, { passive: true });
  document.addEventListener("focusin", onIntent);
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
  /** Scene slots on this page get a canvas each; bands whose slot left the page (client navigation) are dropped. */
  const ensureScenes = () => {
    bands = bands.filter((b) => {
      if (b.id === "fixed" || b.slot?.isConnected) return true;
      undrawn.delete(b);
      if (b.slot) {
        approaching.delete(b.slot);
        approachIO.unobserve(b.slot);
        closingIO.unobserve(b.slot);
      }
      return false;
    });
    document.querySelectorAll<HTMLElement>("[data-sky-scene]").forEach((slot) => {
      if (bands.some((b) => b.slot === slot)) return;
      const c = document.createElement("canvas");
      c.setAttribute("aria-hidden", "true");
      c.className = "sky-scene-canvas";
      slot.appendChild(c);
      const stage = slot.dataset.skyScene !== "closing";
      const l = createLandscape(c, LIFT, GROUND_FADE);
      if (l) {
        const band: Band = {
          id: stage ? "stage" : "closing",
          canvas: c,
          land: l,
          frame: null,
          slot,
          docTop: 0,
        };
        bands.push(band);
        undrawn.add(band);
      }
      approachIO.observe(slot);
      if (!stage) closingIO.observe(slot);
    });
  };
  const relayoutLand = () => {
    ensureScenes();
    const mode = landMode(view.vw, !!view.stage);
    for (const b of bands) {
      if (b.id === "fixed") {
        if (b.canvas.clientHeight < 10 + LIFT) continue; // hidden (scene mode)
        const H = b.canvas.clientHeight - LIFT;
        const anchors = solveAnchors(
          view.sections,
          view.vw,
          view.vh,
          Math.max(0, view.docH - view.vh),
          mode === "scene" ? "centre" : mode,
        );
        const wd = buildWorld(anchors, view.vw, view.vh, view.docH, H, mode === "scene" ? "centre" : mode);
        b.land.resize(view.vw, H, wd);
        // The first-paint fallback drew Ali Amjad's Clock on its right gutter's centre at the top of the page, which
        // is where the solver puts it on most viewports. Where it doesn't, the tower would jump when the canvas takes
        // over: hide the fallback's landmarks there, they arrive with the canvas instead (v5.1 T8).
        const clock = wd.marks.find((k) => k.id === "clock");
        document
          .querySelector("[data-sky-fallback-landmarks]")
          ?.toggleAttribute(
            "hidden",
            !clock || Math.abs(((clock.x0 + clock.x1) / 2) * wd.s - gutterCentre(view.vw, "right")) > 3,
          );
      } else {
        const H = b.slot!.clientHeight;
        if (H < 10) continue; // hidden (gutter mode)
        b.docTop = b.slot!.getBoundingClientRect().top + window.scrollY;
        b.land.resize(
          view.vw,
          H,
          b.id === "stage" ? buildStageScene(view.vw, H) : buildClosingScene(view.vw, H),
        );
      }
    }
    lastLight = -Infinity;
    updateHorizon(true);
  };
  const resize = () => {
    atm?.resize();
    pts?.resize(dayOfYear(skyTime()));
    relayoutLand();
  };
  const ro = new ResizeObserver(() => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      resize();
      if (reduce) still();
    }, 100);
  });

  void (async () => {
    tx = readToken("--text");
    text = `rgb(${tx.map((c) => Math.round(c * 255)).join(",")})`;
    pts = createParticles(ptsCanvas, tx);
    const fixedLand = createLandscape(fixedCanvas);
    if (fixedLand)
      bands.push({
        id: "fixed",
        canvas: fixedCanvas,
        land: fixedLand,
        frame: null,
        slot: null,
        docTop: 0,
      });
    life = createLife(tx);
    ambient = createAmbient(rng, readToken("--signal"), tx, {
      force: DEBUG && q.get("life") === "1",
    });
    atm = await createAtmosphere(atmCanvas, isDead);
    if (dead) return;
    if (!atm) onNoWebGL();
    if (TEST)
      w2.__sky = {
        state: model.astro.state,
        elevation: model.astro.elevation,
        fps: 0,
        condition: model.condition,
        webgl: !!atm,
        pinPlane: (sec) => {
          life?.pin(sec);
          takeoffUntil = sec === null ? -Infinity : Infinity;
        },
      };
    resize();
    backing = startBacking(backingScene);
    ro.observe(ptsCanvas);
    ro.observe(fixedCanvas);
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
    backing?.stop();
    unsubGeom();
    unsubScroll();
    vv?.removeEventListener("resize", onVV);
    vv?.removeEventListener("scroll", onVV);
    document.removeEventListener("pointerover", onIntent);
    document.removeEventListener("pointerdown", onIntent);
    document.removeEventListener("focusin", onIntent);
    unsubStore();
    unsubBus();
    ro.disconnect();
    closingIO.disconnect();
    approachIO.disconnect();
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
  const land = useRef<HTMLCanvasElement>(null);
  const [webgl, setWebgl] = useState(true);

  useEffect(() => {
    if (!atm.current || !pts.current) return;
    if (!land.current) return;
    return start(atm.current, pts.current, land.current, () => setWebgl(false));
  }, []);

  return (
    <>
      {webgl ? (
        <canvas
          ref={atm}
          aria-hidden="true"
          className="sky-layer sky-atmosphere"
          data-sky-atmosphere=""
        />
      ) : null}
      <canvas
        ref={pts}
        aria-hidden="true"
        className="sky-layer sky-particles"
        data-sky-particles=""
      />
      <canvas ref={land} aria-hidden="true" className="sky-landscape" data-sky-landscape="" />
    </>
  );
}
