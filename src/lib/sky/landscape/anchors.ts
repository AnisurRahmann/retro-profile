/**
 * Walking through Sylhet: the landscape's parallax and where its landmarks sit.
 *
 * Scrolling the page is walking sideways: a point at world x (CSS px) on a layer with parallax k is drawn at
 * screen x = x − walk · k. Near things move fast, far things slowly, the sky not at all (k = 0).
 *
 * Three modes (landMode):
 * - "gutter" (≥ 1100px): the fixed band at the bottom of the viewport. Each landmark is solved so it reaches the
 *   centre of a gutter (left or right of the 768px column, alternating) when its section's top is at 40% of the
 *   viewport: walk = scrollY, s = max(0, top − 0.4 · vh), x = target + s · k. Nothing hides behind the cards.
 * - "scene" (< 1100px, pages with the sky stage): the landscape isn't fixed. It's drawn twice in the page: at the
 *   bottom of the stage as its horizon (tea gardens, the Surma, Keane Bridge; walk = how far the stage has
 *   scrolled away × vw) and as a closing scene above the footer (Osmani Airport).
 * - "centre" (< 1100px, pages without a stage): the fixed band with Keane Bridge centred.
 */
import type { PlaceId } from "../store";

export const PARALLAX = { L1: 0.04, L2: 0.15, L3: 0.45, L4: 0.9 } as const;
export type LayerId = keyof typeof PARALLAX;
/** A section's top reaches this fraction of the viewport when its landmark is at its target. */
export const ANCHOR_AT = 0.4;
/** At and above this width the gutters hold the landmarks; below it the landscape becomes scenes. */
export const GUTTER_MIN_VW = 1100;
/** The content column, CSS px (mirrors src/lib/sky/view.ts COLUMN_PX). */
const COLUMN = 768;

export type LandMode = "gutter" | "scene" | "centre";
/** Landscape band height for a viewport: 18vh (≥ 808px) / 14vh, clamped to 110–200 px (CSS mirrors it). */
export const bandHeight = (vw: number, vh: number) =>
  Math.round(Math.min(200, Math.max(110, (vw < 808 ? 0.14 : 0.18) * vh)));
/** Below this width phones get the postcard stage (v5.1 T3): the text block at the top, open sky, the scene at the bottom. */
export const POSTCARD_VW = 640;
/** The stage scene's height on phones, px (CSS --scene-h). */
export const STAGE_SCENE_PX = 200;
/** The stage scene's height in scene mode: STAGE_SCENE_PX on phones, the band height above. */
export const sceneBand = (vw: number, vh: number) => (vw < POSTCARD_VW ? STAGE_SCENE_PX : bandHeight(vw, vh));
/** On phones the stage scene's landmark (Keane Bridge) is this × its size at the old 150px band, on screen. */
export const POSTCARD_MARK = 1.6;
const OLD_STAGE_SCENE_PX = 150;
/** The landmark's scale (about the bank) in a stage scene `H` px tall that makes it POSTCARD_MARK × its old size. */
export const stageMarkK = (H: number) => (POSTCARD_MARK * OLD_STAGE_SCENE_PX) / H;
/** The far hills' highest point over a phone's width, band units (world.ts ridgeL1; sky-landscape.test.ts keeps it true). */
export const PHONE_HILL_TOP = 28.9;
export const landMode = (vw: number, hasStage: boolean): LandMode =>
  vw >= GUTTER_MIN_VW ? "gutter" : hasStage ? "scene" : "centre";

export type LandmarkId = "tea" | "bridge" | "city" | "city2" | "airport";
export type Side = "left" | "right";
type Spec = { id: LandmarkId; layer: LayerId; section: string; place: PlaceId; side: Side };

/** Tea gardens with the hero, Keane Bridge (and the clock tower) with Shipped, the city with On the bench and
 * Receipts, the airport with the closer: the end of the walk, reached at the bottom of the page. Sides alternate. */
export const LANDMARKS: Spec[] = [
  { id: "tea", layer: "L2", section: "stage", place: "tea", side: "left" },
  { id: "bridge", layer: "L3", section: "shipped", place: "bridge", side: "right" },
  { id: "city", layer: "L3", section: "bench", place: "city", side: "left" },
  { id: "city2", layer: "L3", section: "receipts", place: "city", side: "left" },
  { id: "airport", layer: "L3", section: "closer", place: "airport", side: "right" },
];
/** The airport is reached this far above the bottom of the page (px). */
export const END_MARGIN = 24;
/** Landmarks are reached at least this far apart in scroll, × vh. */
export const MIN_GAP_VH = 0.6;

export type Anchor = Spec & {
  /** scroll at which it reaches its target */ s: number;
  /** scroll at which its section's top is at 40% of the viewport, before landmarks were kept apart: what the label goes by. */
  at: number;
  /** world x, CSS px */ x: number;
  /** screen x it reaches at that scroll */ target: number;
};

/** Width of one gutter (either side of the column), CSS px; 0 when there's none. */
export const gutterWidth = (vw: number) => Math.max(0, (vw - COLUMN) / 2);
/** Screen x of a gutter's centre: (vw − column) / 4 from its edge. */
export const gutterCentre = (vw: number, side: Side) =>
  side === "left" ? gutterWidth(vw) / 2 : vw - gutterWidth(vw) / 2;

/** Scroll at which a section's top is at 40% of the viewport (clamped to the page's scroll range). */
export const anchorScroll = (sectionTop: number, vh: number, maxScroll = Infinity) =>
  Math.min(maxScroll, Math.max(0, sectionTop - ANCHOR_AT * vh));
/** Screen x of a world point on a layer at a walk position. */
export const screenX = (worldX: number, walk: number, k: number) => worldX - walk * k;

/**
 * Anchors for the sections present on the page (document tops in px). Every landmark is reached inside the page's
 * scroll range, [0, maxScroll − 24]: the airport, the last, is pinned to the bottom (maxScroll − 24), and working
 * back from it each earlier landmark is reached at least 0.6 vh of scroll before the next (sections too close to
 * the bottom would otherwise all clamp to the same place). "gutter": targets alternate between the gutter centres;
 * otherwise every landmark targets the viewport centre.
 */
export function solveAnchors(
  sections: Record<string, number>,
  vw: number,
  vh: number,
  maxScroll = Infinity,
  mode: LandMode = "centre",
): Anchor[] {
  const end = Number.isFinite(maxScroll) ? Math.max(0, maxScroll - END_MARGIN) : Infinity;
  const list = LANDMARKS.filter((l) => sections[l.section] !== undefined).map((l) => ({
    l,
    at: anchorScroll(sections[l.section]!, vh, end),
    s: anchorScroll(sections[l.section]!, vh, end),
  }));
  const last = list[list.length - 1];
  if (last?.l.id === "airport" && Number.isFinite(end)) last.s = end;
  for (let i = list.length - 2; i >= 0; i--)
    list[i]!.s = Math.max(0, Math.min(list[i]!.s, list[i + 1]!.s - MIN_GAP_VH * vh));
  return list.map(({ l, s, at }) => {
    const target = mode === "gutter" ? gutterCentre(vw, l.side) : vw / 2;
    return { ...l, s, at, target, x: target + s * PARALLAX[l.layer] };
  });
}

/**
 * The place the label names at a scroll position: the landmark whose section is nearest its 40% line. That is
 * `at`, not the anchor's own scroll `s`: when sections are close, landmarks are reached earlier so they keep apart
 * (solveAnchors), and going by `s` the label named the next section's landmark (v5.1: "city rooftops" at Shipped).
 */
export function nearestPlace(anchors: Anchor[], scrollY: number): PlaceId | null {
  let best: Anchor | null = null;
  for (const a of anchors)
    if (!best || Math.abs(a.at - scrollY) < Math.abs(best.at - scrollY)) best = a;
  return best?.place ?? null;
}

// ── Scene mode ───────────────────────────────────────────────────────────────────────────────────────────────

/** Where the stage scene's landmarks stand at the top of the page, fractions of the width. */
export const STAGE_SCENE = { tea: 0.3, bridge: 0.68 };
/**
 * The closing scene: the airport alone, right of centre (its centre and width, fractions of the viewport), so the
 * plane climbs out to the left over open hills (a city there hid it).
 */
export const CLOSING_SCENE = { airport: 0.68, airportW: 0.62 };

/** The stage scene's walk: how far the stage has scrolled away (0 … 1 of its height) × the viewport width. */
export const stageWalk = (scrollY: number, stageH: number, vw: number) =>
  Math.min(1, Math.max(0, scrollY / Math.max(1, stageH))) * vw;
/**
 * The closing scene's walk: 0 when the band is centred in the viewport, ±0.15 vw as it enters and leaves (small, so
 * the airport stays whole on screen wherever the page ends).
 * @param top the band's top in viewport px.
 */
export const closingWalk = (top: number, h: number, vh: number, vw: number) => {
  const q = Math.min(1, Math.max(0, (vh - top) / (vh + h)));
  return (q - 0.5) * 0.3 * vw;
};

/** The label's place in scene mode: whichever of the stage scene's tea gardens and Keane Bridge is nearer the centre. */
export function scenePlace(scrollY: number, stageH: number, vw: number): PlaceId {
  const w = stageWalk(scrollY, stageH, vw);
  const tea = STAGE_SCENE.tea * vw - w * PARALLAX.L2;
  const bridge = STAGE_SCENE.bridge * vw - w * PARALLAX.L3;
  return Math.abs(bridge - vw / 2) <= Math.abs(tea - vw / 2) ? "bridge" : "tea";
}
