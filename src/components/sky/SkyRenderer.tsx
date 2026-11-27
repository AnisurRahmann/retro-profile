"use client";

import { useEffect, useRef, useState } from "react";
import { brand } from "@/lib/brand";
import { onSky } from "@/lib/signal-bus";
import { hexToRgb, oklabToRgb, rgbToOklab, toGamma, toLinear, type Lab } from "@/lib/sky/color";
import { gradientLab, HORIZON_AWAY } from "@/lib/sky/horizon";
import { skyModel, type SkyModel } from "@/lib/sky/model";
import {
  LAYER,
  LAYERS,
  bandPx,
  brightest,
  cloudTones,
  cloudsAt,
  coverage,
  gust,
  isDeck,
  nearSpeed,
  planClouds,
  type LayerId,
  type Plan,
  type Tones,
} from "@/lib/sky/flat-clouds";
import { LAMPS_AT, SPLASH_RATE, gustSlant } from "@/lib/sky/rain";
import { bolt, boltAlpha, createLightningScheduler, SEPARATION, sheetAlpha, strikeEnd, type Kind, type Strike } from "@/lib/sky/lightning";
import { LIGHTNING_CORE, LIGHTNING_HALO, LIGHTNING_MID } from "@/lib/sky/palette";
import { effectiveWeather, skyStore, skyTime } from "@/lib/sky/store";
import { dayOfYear, dhakaParts } from "@/lib/sky/time";
import { sunColor } from "@/lib/sky/gradient";
import { nightPoint, sunPath, type ArcGeom } from "@/lib/sky/arc";
import {
  COLUMN_BREAK,
  geomNow,
  onViewGeometry,
  onViewScroll,
  view,
} from "@/lib/sky/view";
import { startBacking, type BackingRunner } from "./backing-runner";
import { createAtmosphere, type Atmosphere } from "./atmosphere";
import { createSun, drawArc, type SunState } from "./bodies";
import { createFlatCloudLayer, type FlatCloudLayer, type Zone } from "./flat-cloud-layer";
import { createLandscape, GLOW_HORIZON, LIFT, NO_FX, type Landscape } from "./landscape";
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
  bandHeight,
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

/** The sky's debug flag (store.ts SKY_DEBUG), written out here so a release build folds what it guards away (as atmosphere.ts does). */
const DEBUG = process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_SKY_DEBUG === "1" || process.env.NEXT_PUBLIC_E2E === "1";

/** Smoothed shader inputs, keyed by uniform name. Each converges over ~4 s (exponential, τ = 1 s); 0.12 s while scrubbing. */
type Targets = Record<string, number | number[]>;

const linear = (lab: Lab) => oklabToRgb(lab).map(toLinear);

/** Conditions whose cloud deck hides the sun's disc: only a diffuse bright patch is left where it is. */
const DECK = new Set(["overcast", "drizzle", "rain", "heavy-rain", "thunder"]);

function targetsOf(m: SkyModel): Targets {
  return {
    uSunX: m.sunX,
    uGlow: m.glow,
    // A thunderstorm's darker base and dimmed horizon glow (W5).
    uStorm: m.thunder ? 1 : 0,
    uNight: m.night,
    uCloudCover: m.cloudCover,
    uFog: m.fog,
    uRainDark: m.rainDark,
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
    cur[key] =
      typeof b === "number"
        ? (a as number) + (b - (a as number)) * k
        : b.map((v, i) => (a as number[])[i]! + (v - (a as number[])[i]!) * k);
  }
}

const clone = (t: Targets): Targets => ({ ...t });

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
    sun?: { x: number; y: number; up: boolean; tau: number; deck: boolean; dim: number };
    moon?: { x: number; y: number; up: boolean };
    geom?: ArcGeom;
    plane?: { state: string; flights: number };
    /** Test builds: hold the take-off at s seconds in (null lets go). */
    pinPlane?: (s: number | null) => void;
    /** Dev and test builds (Weather v6): force a strike now, and the last 20 with the running count. */
    strike?: (k: "cg" | "ic") => void;
    lightningLog?: unknown[];
    lightningCount?: { cg: number; ic: number };
    /** Dev and test builds: the flat clouds (their count on screen, each layer's drift in px, the coverage now). */
    clouds?: { n: number; off: Record<string, number>; coverage: () => number; plan: string };
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
  cloudCanvas: HTMLCanvasElement,
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
  /** Dev and test builds: `lightning=off` schedules no strike (evidence of the storm between strikes). */
  const noLightning = DEBUG && q.get("lightning") === "off";
  /** Dev and test builds: `clouds=off` draws no cloud layer (GPU attribution). */
  const noClouds = DEBUG && q.get("clouds") === "off";
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
  /**
   * The flat clouds (src/lib/sky/flat-clouds.ts): the plan for this condition and layout, each layer's drift (px:
   * the wind, integrated, so a change of wind never jumps), and their tones, which follow the sky's state (the
   * tick, the weather, a scrub at most 10 times a second).
   */
  let cloudLayer: FlatCloudLayer | null = null;
  let plan: Plan | null = null;
  let planKey = "";
  const cloudOff: Record<LayerId, number> = { far: 0, mid: 0, near: 0 };
  let skyVer = 0;
  let toneVer = -1;
  let toneAt = -Infinity;
  let tones: Tones | null = null;
  let cbTones: Tones | null = null;
  let strikeNo = 0;
  let windX = 0;
  /** The mid sky's relative luminance (linear): what the lamps and windows go by. */
  let midLuma = 0;
  /** The lightning envelope of the frame (the rain brightens in it) and the mean frame time (splashes on phones). */
  let flashNow = 0;
  /** The rain's slant this frame: the model's, swung ±4° by the gusts. */
  let slantNow = 0;
  let emaDt = 1 / 60;
  /** The ground fog's drift in wind-seconds: held in a still frame (reduced motion). */
  let fogT = 0;
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
    nextMeteor = 0,
    astroTimer = 0,
    nightArc = 0,
    lastScroll = -Infinity;
  let text = "rgb(230,234,242)";
  let tx: [number, number, number] = [0.9, 0.92, 0.95];
  let pathKey = "";
  let dayPath: { x: number; y: number }[] = [];
  let nightPath: { x: number; y: number }[] = [];

  /**
   * Lightning (W4, src/lib/sky/lightning.ts): the scheduler, the strike under way, when the next of each kind
   * falls, and one held back until a second has passed since the last began (a due time is computed before the
   * strikes before it have). The bolt's paths are built once and stroked while it lasts.
   */
  const lightningLog: { t: number; kind: Kind; x: number }[] = [];
  const lightningCount = { cg: 0, ic: 0 };
  const scheduler = createLightningScheduler(rng);
  let strike: Strike | null = null;
  let nextL: Record<Kind, number> = { cg: Infinity, ic: Infinity };
  let forced: Kind | null = null;
  let stormOn = false;
  let stageWas = true;
  let boltPaths: Path2D[] = [];
  let boltX = 0;
  /** The bolt's top (under the cloud base) and its foot (the cloud horizon), CSS px: the leader grows down between them. */
  let boltTop = 0;
  let boltFoot = 0;
  const boltPass = ([["halo", LIGHTNING_HALO, 10, 0.22], ["mid", LIGHTNING_MID, 4, 0.6], ["core", LIGHTNING_CORE, 1.6, 1]] as const).map(
    ([, hex, width, alpha]) => {
      const [r, g, b] = hexToRgb(hex).map((v) => Math.round(v * 255)) as [number, number, number];
      return [`rgb(${r},${g},${b})`, width, alpha] as const;
    },
  );
  const toPath = (pts: number[]) => {
    const path = new Path2D();
    path.moveTo(pts[0]!, pts[1]!);
    for (let i = 2; i < pts.length; i += 2) path.lineTo(pts[i]!, pts[i + 1]!);
    return path;
  };
  /**
   * Where a bolt may fall: a column with nothing written over the sky beside it (a bolt wanders 12% of its
   * height), or with room below what is written there (a phone's hero spans the width). Six tries; null if none,
   * and the strike becomes a sheet flash. A forced one (the debug hook) gets sixty, so evidence can rely on it.
   */
  const placeBolt = (tries = 6) => {
    const y1 = cloudHz();
    const margin = 0.12 * y1;
    const boxes = [...document.querySelectorAll("[data-on-sky], .card, .glass")]
      .map((el) => el.getBoundingClientRect())
      .filter((r) => r.bottom > 0 && r.top < y1 && r.width > 0 && r.height > 0);
    for (let i = 0; i < tries; i++) {
      const x = view.vw * (0.06 + rng() * 0.88);
      let top = 0.12 * y1;
      let clear = true;
      for (const r of boxes) {
        if (x < r.left - margin || x > r.right + margin) continue;
        if (r.bottom > y1 - 70) {
          clear = false;
          break;
        }
        top = Math.max(top, r.bottom + 6);
      }
      if (clear) return { x, top };
    }
    return null;
  };
  /**
   * A strike begins now: a CG where nothing is written over the sky, else a sheet flash inside the cloud. One that
   * falls due inside a second of the last simply waits (it is tried again next frame): its next is dated from when
   * it does begin.
   */
  const fire = (kind: Kind, nowMs: number, force = false) => {
    if (!force && nowMs < scheduler.settle(nowMs)) return;
    let k: Kind = kind;
    let place: { x: number; top: number } | null = null;
    if (kind === "cg") {
      place = placeBolt(force ? 60 : 6);
      if (!place) k = "ic";
    }
    strike = scheduler.begin(k, nowMs);
    strikeNo++;
    if (place) {
      boltX = place.x;
      boltTop = place.top;
      boltFoot = cloudHz();
      boltPaths = bolt(rng, place.x, place.top, boltFoot).map(toPath);
    }
    lightningCount[k]++;
    nextL[kind] = scheduler.due(kind, nowMs, model.thunder, model.condition === "heavy-rain");
    lightningLog.push({ t: Math.round(nowMs / 100) / 10, kind: k, x: place ? Math.round(place.x) : -1 });
    if (lightningLog.length > 20) lightningLog.shift();
  };
  /**
   * The bolt, in three passes: a blue halo, a body, a white core. The branches are thinner and dimmer. `reveal`
   * (0..1) is how far down the stepped leader has got: it is drawn down from the cloud, the branches with it.
   */
  const paintBolt = (ctx: CanvasRenderingContext2D, a: number, reveal: number) => {
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const clip = reveal < 1;
    if (clip) {
      ctx.save();
      ctx.beginPath();
      // Branches run up to a quarter of the bolt's height below its foot; the reveal covers them too.
      ctx.rect(0, 0, view.vw, boltTop + reveal * 1.3 * (boltFoot - boltTop));
      ctx.clip();
    }
    boltPaths.forEach((path, i) => {
      for (const [color, width, alpha] of boltPass) {
        ctx.strokeStyle = color;
        ctx.lineWidth = width * (i ? 0.55 : 1);
        ctx.globalAlpha = a * alpha * (i ? 0.7 : 1);
        ctx.stroke(path);
      }
    });
    if (clip) ctx.restore();
    ctx.globalAlpha = 1;
  };
  const scheduleMeteor = (t: number) => (nextMeteor = t + 40 + rng() * 50);

  const recompute = () => {
    const s = skyStore.get();
    geom = geomNow();
    model = skyModel(skyTime(s), effectiveWeather(s), geom);
    target = targetsOf(model);
    skyVer++;
    pts?.ensureDay(dayOfYear(skyTime(s)));
    backing?.update();
    if (DEBUG && w2.__sky)
      Object.assign(w2.__sky, {
        state: model.astro.state,
        elevation: model.astro.elevation,
        condition: model.condition,
        lightningLog,
        lightningCount,
        // Dev and test builds: a strike on demand (the debug hook; nothing under reduced motion).
        strike: (k: "cg" | "ic") => {
          if (!reduce) forced = k;
        },
      });
  };

  const n = (k: string) => cur[k] as number;
  const v2 = (k: string) => cur[k] as number[];

  /**
   * The clouds' horizon, where the land meets the sky: in scene mode the visible ground (the gradient's horizon);
   * with the fixed band, the far hills' skyline (their ridge averages 34 band units down), not the viewport bottom,
   * which would leave the visible sky only v 0.82–1 and no perspective at all.
   */
  const cloudHz = () => (sceneMode() ? hz.h : view.vh - 0.66 * bandHeight(view.vw, view.vh));
  /** The clouds' horizon as it is at the top of the page: the clouds never scroll (the sky's parallax is 0). */
  const refCloudHz = () => {
    if (!sceneMode()) return cloudHz();
    const st = bands.find((b) => b.id === "stage" && b.land.world);
    return st ? st.docTop + SCENE_HORIZON * st.land.height : cloudHz();
  };
  /** The plan for this condition and layout, rebuilt only when either changes. */
  const ensurePlan = () => {
    const head = document.querySelector<HTMLElement>("[data-sky-head]");
    let deckTop = 0;
    head?.querySelectorAll("[data-on-sky]").forEach((el) => {
      deckTop = Math.max(deckTop, el.getBoundingClientRect().bottom + view.y + 4);
    });
    const col = head?.getBoundingClientRect();
    const gutters: [number, number][] | undefined =
      col && landMode(view.vw, !!view.stage) === "gutter" ? [[0, col.left], [col.right, view.vw]] : undefined;
    const skyH = Math.round(refCloudHz());
    const day = dayOfYear(skyTime());
    const cover = Math.round(model.cloudCover * 100) / 100;
    const key = `${model.condition}|${cover}|${day}|${view.vw}|${skyH}|${Math.round(deckTop)}|${gutters?.flat().map(Math.round)}`;
    if (key === planKey && plan) return plan;
    planKey = key;
    plan = planClouds({ condition: model.condition, cover, day, vw: view.vw, skyH, deckTop: Math.round(deckTop), gutters });
    cloudLayer?.reset();
    return plan;
  };
  /** The tones now, and a cumulonimbus's: lifted off the deck behind it (no new colour, the deck's own, lighter). */
  const updateTones = () => {
    tones = cloudTones(model.astro.elevation, model.condition, model.moon);
    const b = tones.body;
    // In front of a storm's deck: its body a step lighter than the deck, its lit edge two steps.
    const up = (c: Lab, k: number): Lab => [Math.min(1, c[0] + k), c[1], c[2]];
    cbTones = { ...tones, body: up(b, 0.07), cap: up(b, 0.18), base: up(tones.base, 0.04) };
  };
  /** Where the clouds can be, for the backing model: each puff layer's band, each row, the storm's tower. */
  const cloudSpans = () => {
    const p = ensurePlan();
    if (!tones) updateTones();
    const t = tones!;
    const lab = brightest(t);
    const all = { x0: -Infinity, x1: Infinity };
    return {
      alpha: 1 - 0.6 * model.fog,
      spans: [
        ...p.puffs.map((L) => {
          const [y0, y1] = bandPx(L.id, p.input.skyH);
          return { ...all, y0, y1, lab, mix: LAYER[L.id].mix };
        }),
        ...p.rows.map((r) => ({ ...all, y0: r.y, y1: r.y + r.h + 1.4 * r.hang, lab, mix: LAYER[r.layer].mix })),
        ...(p.cb
          ? [{ x0: p.cb.x, x1: p.cb.x + p.cb.shape.w, y0: p.cb.base - p.cb.shape.h, y1: p.cb.base, lab: brightest(cbTones!), mix: 0 }]
          : []),
      ],
    };
  };
  /**
   * Where the clouds are lit from: the sun's place on screen while any light is left in it, and after it has set
   * the moon's, or the zenith by a quarter's strength on a moonless night.
   */
  const light = (): number[] => {
    const [fx, fy] = v2("sunPos");
    const moonUp = n("uMoonUp");
    const [mx, my] = v2("uMoonPos");
    const ox = (0.5 * view.vw) * (1 - moonUp) + mx! * view.vw * moonUp;
    const oy = my! * view.vh * moonUp;
    const os = 0.25 * (1 - moonUp) + (0.35 + 0.65 * n("uMoonIllum")) * moonUp;
    const k = smooth01(-6, -1.5, n("sunAlt"));
    return [ox + (fx! * view.vw - ox) * k, oy + (fy! * view.vh - oy) * k, 0, os + (1 - os) * k];
  };

  const moonR = () => (view.vw < COLUMN_BREAK ? 12 : 14);
  /**
   * Cloud in front of a disc 0..1 (centre, radius): a near or mid cloud leaves the disc 0.08 of its alpha, a far one
   * half that cover, linear across the disc's edge, less where the text clearing has thinned the cloud. As an optical
   * depth for bodies.ts (its disc is exp(−1.8 τ)): τ = −ln(1 − 0.92 · cover) / 1.8.
   */
  const occlusion = (x: number, y: number, r = 0) => 0.92 * (cloudLayer?.coverAt(x, y, r, view.y) ?? 0);
  const tauAt = (x: number, y: number, r: number) => -Math.log(1 - occlusion(x, y, r)) / 1.8;
  const particleState = (): ParticleState => ({
    night: n("uNight"),
    cloudCover: n("uCloudCover"),
    deck: isDeck(model.condition) ? 1 : 0,
    fog: n("uFog"),
    rainDensity: model.rainDensity,
    rainSlant: slantNow,
    drizzle: model.condition === "drizzle",
    flash: flashNow,
    moon: { ...model.moon, x: (cur.uMoonPos as number[])[0]!, y: (cur.uMoonPos as number[])[1]! },
    moonVisible:
      n("uMoonUp") *
      n("uNight") *
      Math.max(
        0,
        1 - 1.05 * occlusion(v2("uMoonPos")[0]! * view.vw, v2("uMoonPos")[1]! * view.vh, moonR()),
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
      tau: tauAt(x, y, r),
      deck: DECK.has(model.condition),
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
    const moonVis = m.night * Math.max(0, 1 - 1.05 * occlusion(mx, my, moonR())) ** 0.7 * (1 - 0.6 * m.fog);
    return {
      m,
      sun: m.sun.up
        ? {
            x: sx,
            y: sy,
            r: sunR(),
            alt: m.sun.alt,
            tau: tauAt(sx, sy, sunR()),
            deck: DECK.has(m.condition),
            fog: m.fog,
          }
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
      clouds: cloudSpans(),
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
    // Under thunder: a bolt about every 9 s and a sheet flash every 5 s; under heavy rain, sheet flashes every
    // 25 s. The first bolt comes 1.2–2.5 s after the first frame, and again within 1.5 s of the stage coming
    // back, at most once in 20 s. Never in a still frame (reduced motion): nothing is scheduled or drawn.
    const nowMs = t * 1000;
    let lightning = 0;
    let reveal = 1;
    const flashAt = [0, 0, 0, 0];
    const onStage = view.y < view.vh * 0.5;
    // Keyed to the condition, not the eased uRainDark: that never quite reaches 1 after a change of weather.
    const heavy = model.condition === "heavy-rain";
    if (!still && !lost && !noLightning && (model.thunder || heavy)) {
      if (!stormOn) {
        stormOn = true;
        // Thunder: the first bolt 1.2–2.5 s in (or when due, if one fell under 20 s ago), the first sheet flash a
        // separation after it. Heavy rain: no bolt ever, the first sheet flash after a separation.
        const first = model.thunder ? (scheduler.intro(nowMs, true) ?? scheduler.due("cg", nowMs, true, false)) : Infinity;
        nextL = {
          cg: first,
          ic: scheduler.due("ic", (model.thunder ? first : nowMs) + SEPARATION, model.thunder, heavy),
        };
      }
      if (model.thunder && onStage && !stageWas) nextL.cg = Math.min(nextL.cg, scheduler.intro(nowMs, false) ?? Infinity);
      stageWas = onStage;
      if (forceBolt) forced = "cg";
      if (forced) {
        // The debug hook: now, whatever the guard (dev and test builds only).
        const k = forced;
        forced = null;
        strike = null;
        fire(k, nowMs, true);
      }
      if (nowMs >= nextL.ic) fire("ic", nowMs);
      // Never a bolt out of a storm that has eased to heavy rain (its due time was set under thunder).
      if (model.thunder && nowMs >= nextL.cg) fire("cg", nowMs);
      if (strike) {
        const ms = nowMs - strike.t0 * 1000;
        const end = strikeEnd(strike);
        if (strike.kind === "cg") {
          lightning = boltAlpha(strike, ms);
          reveal = Math.min(1, ms / strike.leaderMs);
          if (ms > end) boltPaths = [];
          else if (boltPaths.length) {
            // The cloud around the bolt's top lights up with it (a sheet flash at the bolt's x).
            flashAt[0] = boltX;
            flashAt[1] = boltTop;
            flashAt[2] = 0.24 * view.vw;
            flashAt[3] = 0.8 * lightning;
          }
        } else if (ms < end) {
          flashAt[0] = strike.x * view.vw;
          flashAt[1] = strike.y * view.vh;
          flashAt[2] = strike.r * view.vw;
          flashAt[3] = sheetAlpha(strike, ms);
        }
        if (ms > end) strike = null;
      }
    } else {
      strike = null;
      stormOn = false;
      boltPaths = [];
      stageWas = onStage;
    }
    const boltUp = strike?.kind === "cg" && boltPaths.length > 0;
    flashNow = lightning;
    if (dt > 0 && dt < 0.5) emaDt += (dt - emaDt) * 0.05;
    if (dt > 0 && dt < 0.5 && !still)
      // groundFogX's wind factor (1 at 15 km/h, 2 at 30), held at 1 or more: fog lies in calm air, and its banks
      // still drift at their own speed then (≥ 2 px/s, W6).
      fogT += dt * Math.min(2, Math.max(1, model.windKmh / 15)) * (model.wind[0] < 0 ? -1 : 1);
    const mid = v2("uMid");
    midLuma = 0.2126 * mid[0]! + 0.7152 * mid[1]! + 0.0722 * mid[2]!;
    const hzCloud = cloudHz();
    // The wind carries each layer across at its own speed (near 1, mid 0.55, far 0.3; ±20% gusts at 0.07 Hz).
    const swell = gust(t);
    slantNow = gustSlant(model.rainSlant, still ? 1 : swell);
    const vNear = nearSpeed(model.windKmh, model.windFromDeg);
    windX = vNear / 12;
    if (!still) for (const id of LAYERS) cloudOff[id] += vNear * LAYER[id].speed * swell * dt;
    updateHorizon(still);
    const u: Targets = {
      ...cur,
      uHorizonY: hz.h,
      uHorizonB: hz.b,
      uTime: still ? 0 : t,
      uLightning: lightning,
      uSheet: flashAt,
      uCloudHz: hzCloud,
      uWindX: windX,
    };
    if (atm && !lost) atm.draw(u);
    if (cloudLayer && !noClouds) {
      const p = ensurePlan();
      if (skyVer !== toneVer && (still || t - toneAt >= 0.1)) {
        updateTones();
        toneVer = skyVer;
        toneAt = t;
      }
      const lp = light();
      const hzf = sceneMode() ? { h: hz.h / view.vh, b: hz.b / view.vh } : { h: 1, b: 1 };
      cloudLayer.draw({
        plan: p,
        off: cloudOff,
        t: still ? null : t,
        tones: tones!,
        cbTones: cbTones!,
        sky: (y) => gradientLab(model.colors, y / view.vh, hzf, HORIZON_AWAY),
        light: [lp[0]!, lp[1]!],
        flash: { x: flashAt[0]!, y: flashAt[1]!, r: flashAt[2]!, k: still ? 0 : flashAt[3]! },
        bolt: still ? 0 : lightning,
        strike: strikeNo,
        thunder: model.thunder,
        scrollY: view.y,
        alpha: 1 - 0.6 * n("uFog"),
      });
      if (DEBUG && w2.__sky)
        w2.__sky.clouds = {
          n: cloudLayer.count,
          off: { ...cloudOff },
          coverage: () => coverage(cloudsAt(p, cloudOff), view.vw, p.input.skyH),
          plan: planKey,
        };
    }
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
          // Stars are behind the clouds: the cloud layer's silhouettes are cut out of them.
          afterStars: (ctx) => {
            if (!cloudLayer) return;
            ctx.save();
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.globalCompositeOperation = "destination-out";
            ctx.drawImage(cloudCanvas, 0, 0, ptsCanvas.width, ptsCanvas.height);
            ctx.restore();
          },
          front: (ctx) => {
            if (boltUp) paintBolt(ctx, lightning, reveal);
            sunLayer.draw(ctx, ss, still ? 0 : t, day, (a) => {
              const px = ss.x + Math.cos(a) * 180;
              const py = ss.y + Math.sin(a) * 180;
              return 1 - occlusion(px, py) / 0.92;
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
      if (DEBUG && w2.__sky) {
        w2.__sky.sun = {
          x: ss.x,
          y: ss.y,
          up: ss.up,
          tau: ss.tau,
          deck: ss.deck,
          dim: ss.dim,
        };
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
              ? (1 - Math.max(0, alt) / 12) * (1 - occlusion(ss.x, ss.y)) * smooth01(-0.9, 0.6, alt)
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
          // The lights follow the sky's luminance, not the clock: on in a dark storm at noon too (rain.ts LAMPS_AT).
          lamps: smooth01(LAMPS_AT.off, LAMPS_AT.on, midLuma),
          glints,
          l3: b.land.colorOf("L3"),
          tones: b.land.tones,
          wind: { kmh: model.windKmh, side: model.wind[0] < 0 ? -1 : 1 },
          planePx: planePx(view.vw),
          rain: {
            slant: slantNow,
            density: model.rainDensity,
            // No splashes on a phone that is already under 30 fps.
            splashes: view.vw < COLUMN_BREAK && emaDt > 1 / 30 ? 0 : (SPLASH_RATE[model.condition] ?? 0),
          },
          bolt: { x: boltX, k: lightning },
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
        b.land.draw(
          walk,
          (g, layer, o) => {
            life!.between(g, layer, o, f);
            if (ll && !still && ambient && (layer === "L2" || layer === "L4"))
              ambient.land(g, layer, o, ll);
          },
          // The heavy-rain veil is in over the last fifth of the rain's darkening, so only heavy rain and thunder
          // have it; the rim is the bolt under way; fog fades the land by distance and lies on the ground.
          { ...NO_FX, veil: smooth01(0.8, 1, n("uRainDark")), rim: lightning, fog: n("uFog"), fogT },
        );
        if (!("ready" in b.canvas.dataset)) b.canvas.dataset.ready = "";
      }
      if (DEBUG && w2.__sky) {
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
    if (DEBUG && w2.__sky) {
      w2.__sky.frames = frames;
      if (life) w2.__sky.plane = life.plane(t);
    }
    if (frames === 1) {
      atmCanvas.dataset.ready = "";
      cloudCanvas.dataset.ready = "";
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
      strike !== null ||
      forceBolt ||
      s.scrubbing ||
      scrolling ||
      t < takeoffUntil ||
      tracker.moving ||
      (ambient?.active() ?? false);
    const cap = coarse ? (raining || scrolling || s.scrubbing ? 30 : 20) : busy ? 60 : 24;
    if (DEBUG && w2.__sky) w2.__sky.cap = cap;
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
      if (DEBUG && w2.__sky) w2.__sky.fps = fps;
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
      if (DEBUG && w2.__sky) w2.__sky.fps = 0;
    }
  };

  const still = () => {
    Object.assign(cur, clone(target));
    draw(0, 0, true);
    if (DEBUG && w2.__sky) w2.__sky.fps = 0;
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
    cloudLayer?.resize(cloudCanvas.clientWidth, cloudCanvas.clientHeight);
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
    cloudLayer = createFlatCloudLayer(cloudCanvas);
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
    if (DEBUG)
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
    // The backing runner solves how far each loose text's clouds are thinned (backing.ts clearingFor) and hands
    // the zones back: the cloud layer's mask. A still frame is drawn again with them.
    backing = startBacking(backingScene, (z: Zone[]) => {
      cloudLayer?.setZones(z);
      if (reduce) still();
    });
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

/** Atmosphere (WebGL2, z −3), flat clouds (Canvas 2D, z −3 above it) and particles (Canvas 2D, z −2), one loop. Loaded after idle; the CSS gradient covers first paint. */
export default function SkyRenderer() {
  const atm = useRef<HTMLCanvasElement>(null);
  const cld = useRef<HTMLCanvasElement>(null);
  const pts = useRef<HTMLCanvasElement>(null);
  const land = useRef<HTMLCanvasElement>(null);
  const [webgl, setWebgl] = useState(true);

  useEffect(() => {
    if (!atm.current || !cld.current || !pts.current || !land.current) return;
    return start(atm.current, cld.current, pts.current, land.current, () => setWebgl(false));
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
      <canvas ref={cld} aria-hidden="true" className="sky-layer sky-clouds" data-sky-clouds="" />
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
