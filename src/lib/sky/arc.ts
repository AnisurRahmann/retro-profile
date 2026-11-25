/**
 * The sky arc: where the sun and moon sit on screen. Pure functions of (time, geometry).
 *
 * Endpoints: east horizon at (6% of the viewport width, stage bottom − 8% of the viewport height), west at (94%,
 * same height); apex under the header (64 + 28 px). Along the arc, x comes from the body's progress between
 * rise and set, u = (t − rise) / (set − rise), on a quarter-ellipse each side (x = ½ − 0.44·cos πu), so the body
 * climbs quickly after rising like the real sun. Height comes from real altitude: alt / (the pass's maximum
 * altitude), scaled by how high that maximum is in the year (sin max / sin ALT_REF), so December's arc is lower
 * than June's. The disc's x is clamped to [8%, 92%] so it's never clipped.
 * Phones (below POSTCARD_VW, the postcard stage of v5.1 T3): the arc lives in the open sky band between the text block
 * and the hills. Its ends are at 8% and 92% of the width, 8px above the top of the hills; its apex is 28px under the
 * text block, so the sun and moon never touch the text. It follows the text block (and the viewport) on resize.
 * The celestial layer doesn't scroll (parallax 0): the arc is laid out against the stage at scroll 0.
 */
import SunCalc from "suncalc";
import { sun, sunTimes } from "./astro";
import { SYLHET } from "./weather";
import { PHONE_HILL_TOP, POSTCARD_VW, sceneBand } from "./landscape/anchors";

const DEG = 180 / Math.PI;
const RAD = Math.PI / 180;

/** Sylhet's highest noon sun of the year (June solstice), degrees. */
export const ALT_REF = 90 - SYLHET.lat + 23.44;
export const ARC = {
  /** Horizon endpoints, fraction of the viewport width. */
  east: 0.06,
  west: 0.94,
  /** Disc clamp, fraction of the viewport width. */
  clamp: [0.08, 0.92] as const,
  /** Horizon height above the stage bottom, fraction of the viewport height. */
  horizonDrop: 0.08,
  /** Apex below the header, px (scene mode: sceneApexGap). */
  apexGap: 28,
  sceneApexGap: 16,
  header: 64,
  /** Phones (the postcard stage): the arc's ends, 8% and 92% of the width; how far they sit above the top of the
   * hills; how far the apex sits under the text block; the text block's top gap under the header and its height
   * when it hasn't been measured. */
  postcardEast: 0.08,
  postcardLift: 8,
  postcardGap: 28,
  postcardTextTop: 24,
  postcardTextH: 164,
};

export type ArcGeom = {
  w: number;
  h: number;
  horizonY: number;
  apexY: number;
  /** Half the arc's width as a fraction of the viewport width. Default 0.5 − ARC.east; narrower on phones. */
  span?: number;
};

/**
 * Arc geometry for a viewport and the stage's bottom edge (document px at scroll 0, = viewport px there).
 * Scene mode (< 1100px with a stage, src/lib/sky/landscape/anchors.ts): the landscape is drawn at the bottom of the
 * stage, so the horizon is in its hills (SCENE_HORIZON of the band down from its top) and the apex is header + 16:
 * the sun sets behind the hero text and into the tea hills.
 */
export function arcGeom(
  vw: number,
  vh: number,
  stageBottom: number,
  scene = false,
  heroBottom?: number,
): ArcGeom {
  if (postcard(vw, scene)) {
    // v5.1 T3: ends 8px above the top of the hills (the stage scene's tallest far hill), apex 28px under the text.
    const band = sceneBand(vw, vh);
    const horizon = stageBottom - band + PHONE_HILL_TOP * (band / 100) - ARC.postcardLift;
    const textBottom = heroBottom ?? ARC.header + ARC.postcardTextTop + ARC.postcardTextH;
    const apexY = textBottom + ARC.postcardGap;
    return { w: vw, h: vh, horizonY: Math.max(apexY + 80, horizon), apexY, span: 0.5 - ARC.postcardEast };
  }
  const apexY = ARC.header + (scene ? ARC.sceneApexGap : ARC.apexGap);
  const horizon = scene
    ? stageBottom - (1 - SCENE_HORIZON) * sceneBand(vw, vh)
    : stageBottom - ARC.horizonDrop * vh;
  return { w: vw, h: vh, horizonY: Math.max(apexY + 80, horizon), apexY };
}

/** Where the horizon sits in the stage scene: this fraction of the band down from its top (the far hills). */
export const SCENE_HORIZON = 0.4;
/** True on a phone's home page: the postcard stage, with its own arc (v5.1 T3). */
export const postcard = (vw: number, scene: boolean) => scene && vw < POSTCARD_VW;

/** Stage height as CSS computes it (for pages without a stage, the sun still needs a horizon): on phones the first
 * screen less 40px, so "Shipped" peeks at the bottom (at least 600px). */
export const stageHeightFor = (vw: number, vh: number) =>
  vw >= 808
    ? Math.max(460, Math.min(0.62 * vh, 640))
    : vw >= POSTCARD_VW
      ? Math.max(460, 0.7 * vh)
      : Math.max(600, vh - 40);

/** Geometry for pure contexts (tests, the guard's defaults): a 1440×900 desktop. */
export const DEFAULT_GEOM: ArcGeom = arcGeom(1440, 900, stageHeightFor(1440, 900));

/** Seasonal height of a pass whose highest point is `maxAltDeg`: 1 at the June-solstice noon sun. */
export const seasonScale = (maxAltDeg: number) =>
  Math.min(1, Math.max(0, Math.sin(maxAltDeg * RAD) / Math.sin(ALT_REF * RAD)));

/** A body's progress (u) and altitude on its pass; `up` = between rise and set. */
export type Pass = { u: number; alt: number; maxAlt: number; up: boolean };

export type ArcPoint = { x: number; y: number; /** x clamped for the disc */ cx: number };

/** Point on the arc for progress u ∈ [0, 1] and altitude (degrees) on a pass that peaks at maxAlt. */
const halfSpan = (g: ArcGeom) => g.span ?? 0.5 - ARC.east;

export function arcPoint(u: number, alt: number, maxAlt: number, g: ArcGeom): ArcPoint {
  const x = g.w * (0.5 - halfSpan(g) * Math.cos(Math.PI * Math.min(1, Math.max(0, u))));
  const k = maxAlt > 0 ? Math.min(1, Math.max(0, alt / maxAlt)) : 0;
  const y = g.horizonY - (g.horizonY - g.apexY) * seasonScale(maxAlt) * k;
  return { x, y, cx: Math.min(g.w * ARC.clamp[1], Math.max(g.w * ARC.clamp[0], x)) };
}

/** The dashed night continuation under the horizon (west back to east), depth px at its lowest. */
export function nightPoint(v: number, g: ArcGeom, depth: number): { x: number; y: number } {
  return {
    x: g.w * (0.5 + halfSpan(g) * Math.cos(Math.PI * v)),
    y: g.horizonY + depth * Math.sin(Math.PI * v),
  };
}

const noonAlt = new Map<string, number>();

/** The sun's pass for the Dhaka day containing `date`. */
export function sunPass(date: Date): Pass {
  const { sunrise, sunset, solarNoon } = sunTimes(date);
  const key = solarNoon.toISOString().slice(0, 10);
  let maxAlt = noonAlt.get(key);
  if (maxAlt === undefined) {
    maxAlt = sun(solarNoon).elevationDeg;
    noonAlt.set(key, maxAlt);
  }
  const t = date.getTime();
  const u = (t - sunrise.getTime()) / (sunset.getTime() - sunrise.getTime());
  return { u, alt: sun(date).elevationDeg, maxAlt, up: u >= 0 && u <= 1 };
}

const moonAlt = (t: number) =>
  SunCalc.getMoonPosition(new Date(t), SYLHET.lat, SYLHET.lon).altitude * DEG;

/** Moonrise and moonset instants around `date` (suncalc's search, run on the surrounding UTC days). */
export function moonEvents(date: Date): { rises: number[]; sets: number[] } {
  const rises: number[] = [];
  const sets: number[] = [];
  for (const dd of [-1, 0, 1]) {
    const d = new Date(date.getTime() + dd * 864e5);
    const m = SunCalc.getMoonTimes(d, SYLHET.lat, SYLHET.lon, true);
    if (m.rise) rises.push(m.rise.getTime());
    if (m.set) sets.push(m.set.getTime());
  }
  const uniq = (a: number[]) =>
    [...new Set(a.map((x) => Math.round(x / 6e4) * 6e4))].sort((p, q) => p - q);
  return { rises: uniq(rises), sets: uniq(sets) };
}

const passMax = new Map<number, number>();

/**
 * The moon's pass containing `date` (or the nearest one): u from moonrise and moonset (suncalc.getMoonTimes),
 * maximum altitude sampled across the pass.
 */
export function moonPass(date: Date): Pass & { rise: number; set: number } {
  const t = date.getTime();
  const { rises, sets } = moonEvents(date);
  const rise = rises.filter((r) => r <= t).pop() ?? rises[0] ?? t - 6 * 36e5;
  const set = sets.find((s) => s > rise) ?? rise + 12 * 36e5;
  let maxAlt = passMax.get(rise);
  if (maxAlt === undefined) {
    maxAlt = 0;
    for (let i = 1; i < 24; i++) maxAlt = Math.max(maxAlt, moonAlt(rise + ((set - rise) * i) / 24));
    passMax.set(rise, maxAlt);
    if (passMax.size > 8) passMax.delete(passMax.keys().next().value!);
  }
  const u = (t - rise) / (set - rise);
  return { u, alt: moonAlt(t), maxAlt, up: u >= 0 && u <= 1, rise, set };
}

/** Today's sun path as screen points (for the dotted arc): `n` samples from sunrise to sunset. */
export function sunPath(date: Date, g: ArcGeom, n = 48): { x: number; y: number }[] {
  const { sunrise, sunset } = sunTimes(date);
  const p = sunPass(date);
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const t = new Date(sunrise.getTime() + u * (sunset.getTime() - sunrise.getTime()));
    const a = i === 0 || i === n ? 0 : sun(t).elevationDeg;
    const pt = arcPoint(u, a, p.maxAlt, g);
    out.push({ x: pt.x, y: pt.y });
  }
  return out;
}
