/**
 * Walking through Sylhet: the landscape's parallax and where its landmarks sit.
 *
 * Scrolling the page is walking sideways: a point at world x (CSS px) on a layer with parallax k is drawn at
 * screen x = x − scrollY · k. Near things move fast, far things slowly, the sky not at all (k = 0).
 * Each landmark's world x is chosen so it passes the viewport centre when its section's top reaches 40% of the
 * viewport: scroll s = max(0, top − 0.4 · vh), x = vw / 2 + s · k.
 */
import type { PlaceId } from "../store";

export const PARALLAX = { L1: 0.04, L2: 0.15, L3: 0.45, L4: 0.9 } as const;
export type LayerId = keyof typeof PARALLAX;
/** A section's top reaches this fraction of the viewport when its landmark is centred. */
export const ANCHOR_AT = 0.4;

export type LandmarkId = "tea" | "bridge" | "city" | "city2" | "airport" | "tea2";
type Spec = { id: LandmarkId; layer: LayerId; section: string; place: PlaceId };

/** Tea gardens with the hero, Keane Bridge (and the clock tower) with Shipped, the city with On the bench and
 * Receipts, the airport with the closer, tea hills again at the footer. */
export const LANDMARKS: Spec[] = [
  { id: "tea", layer: "L2", section: "stage", place: "tea" },
  { id: "bridge", layer: "L3", section: "shipped", place: "bridge" },
  { id: "city", layer: "L3", section: "bench", place: "city" },
  { id: "city2", layer: "L3", section: "receipts", place: "city" },
  { id: "airport", layer: "L3", section: "closer", place: "airport" },
  { id: "tea2", layer: "L2", section: "footer", place: "tea" },
];

export type Anchor = Spec & { /** scroll at which it's centred */ s: number; /** world x, CSS px */ x: number };

export const anchorScroll = (sectionTop: number, vh: number) => Math.max(0, sectionTop - ANCHOR_AT * vh);
export const anchorX = (sectionTop: number, vw: number, vh: number, k: number) => vw / 2 + anchorScroll(sectionTop, vh) * k;
/** Screen x of a world point on a layer at a scroll position. */
export const screenX = (worldX: number, scrollY: number, k: number) => worldX - scrollY * k;

/** Anchors for the sections present on the page (document tops in px). */
export function solveAnchors(sections: Record<string, number>, vw: number, vh: number): Anchor[] {
  const out: Anchor[] = [];
  for (const l of LANDMARKS) {
    const top = sections[l.section];
    if (top === undefined) continue;
    const s = anchorScroll(top, vh);
    out.push({ ...l, s, x: vw / 2 + s * PARALLAX[l.layer] });
  }
  return out;
}

/** The place the label names at a scroll position: the landmark whose section is nearest its 40% line. */
export function nearestPlace(anchors: Anchor[], scrollY: number): PlaceId | null {
  let best: Anchor | null = null;
  for (const a of anchors) if (!best || Math.abs(a.s - scrollY) < Math.abs(best.s - scrollY)) best = a;
  return best?.place ?? null;
}
