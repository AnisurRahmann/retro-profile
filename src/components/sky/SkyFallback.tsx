/**
 * First-paint fallback for the Sylhet Sky (v5.1 T8). The canvases are drawn by a renderer that loads after idle, so on
 * a cold load a slow phone saw a bare gradient for seconds. This is server-rendered with the page, so it is in the
 * first paint:
 *
 * - `SkyFallbackStars`: a CSS star field, one element whose box-shadow list holds about 60 dots from a fixed seed. It
 *   shows when `html[data-sky]` is "night", which the first-paint script sets before paint; without JavaScript the
 *   attribute is absent and the initial (night) sky applies, so it shows then too.
 * - `SkyFallbackStage` (phones): the stage scene as an inline SVG, built from the same world and path data as the
 *   canvas (`buildStageScene`), in the scene's slot. Keane Bridge is its own SVG, centred as the canvas centres it.
 * - `SkyFallbackBand` (≥ 1100px): the fixed band's hills, river and near bank over the first 1400 units, the first
 *   landmark set (Keane Bridge and Ali Amjad's Clock) on the right gutter's centre, and the fillers that stand at the
 *   same place on every viewport: the tea gardens' shade trees and the near foreground (palms, bamboo, lamp posts,
 *   low walls). The riverside trees and houses are left out: the canvas skips them around the landmarks, which stand
 *   where the viewport puts them.
 *
 * Colours are CSS variables (globals.css `.sky-fallback`): each layer is its base colour hazed toward `--sky-horizon`
 * exactly as `landscape/colors.ts` mixes it, and its lightness follows `html[data-sky]`. The renderer marks
 * `html[data-sky-fallback-done]` once its canvases have drawn a first frame and these fade out (SkyRenderer.tsx).
 * Nothing here moves: the SVGs sit where the canvases will draw, so nothing jumps when they take over.
 */
import { mulberry32 } from "@/lib/sky/random";
import { CITY_GLOW, LAND_L1, LAND_L2, LAND_L3, LAND_L4, STAR_COOL, STAR_WARM } from "@/lib/sky/palette";
import { POSTCARD_VW, STAGE_SCENE_PX, stageMarkK } from "@/lib/sky/landscape/anchors";
import {
  buildFillers,
  buildStageScene,
  ridgeL1,
  ridgeL2,
  ridgeL4,
  type Placed,
  type World,
} from "@/lib/sky/landscape/world";
import { BANK_Y, clockTower, keaneBridge, RIVER, type Shape } from "@/lib/sky/landscape/shapes";
import type { CSSProperties } from "react";
import type { LayerId } from "@/lib/sky/landscape/anchors";

const f = (v: number) => +v.toFixed(1);

// ── Stars ────────────────────────────────────────────────────────────────────────────────────────────────────────

const STARS = 60;
const rgb = (hex: string) => parseInt(hex.slice(1), 16);
const STAR_COOL_RGB = rgb(STAR_COOL);
const STAR_WARM_RGB = rgb(STAR_WARM);

/** The star field's box-shadow list. */
export function starShadows(): string {
  const rng = mulberry32(20261126);
  const hex = (rgb: number, a: number) => `#${rgb.toString(16).padStart(6, "0")}${Math.round(a * 255).toString(16).padStart(2, "0")}`;
  const out: string[] = [];
  while (out.length < STARS) {
    // Not where the text is: below the phone's text block, or above it (a thin strip under the header) ...
    const y = rng() < 0.12 ? rng() * 9 : 34 + rng() * 66;
    const x = rng() * 100;
    // ... and not across the desktop hero, which sits lower.
    if (x > 21 && x < 79 && y > 34 && y < 62) continue;
    const a = 0.3 + 0.7 * rng() ** 2; // most dim, a few bright
    const spread = rng() < 0.25 ? ".5" : "0";
    out.push(`${x.toFixed(1)}vw ${y.toFixed(1)}vh 0 ${spread}px ${hex(rng() < 0.08 ? STAR_WARM_RGB : STAR_COOL_RGB, a)}`);
  }
  return out.join(",");
}

/** The star field: a fixed layer right above the gradient. */
export function SkyFallbackStars() {
  return <div aria-hidden="true" className="sky-fallback-stars" data-sky-fallback="stars" style={{ boxShadow: starShadows() }} />;
}

// ── The landscape as SVG ────────────────────────────────────────────────────────────────────────────────────────

/** A ridge as the canvas draws it (landscape.ts `solid`): a polyline sampled every `step` units, closed down to the band's foot. */
function ridge(fn: (x: number) => number, x0: number, x1: number, step: number): string {
  let d = `M${x0} 101L${x0} ${f(fn(x0))}`;
  for (let x = x0 + step; x <= x1 + step; x += step) d += `L${x} ${f(fn(x))}`;
  return `${d}L${x1 + step} 101Z`;
}

/** A shape's stroke paths (truss members, poles), each at its own width, as the canvas strokes them. */
function strokesOf(s: Shape): string {
  let out = "";
  for (const k of s.stroke ?? []) out += `<path d="${k.d}" fill="none" stroke-width="${k.width}"/>`;
  return out;
}

/** One placed shape, drawn as the canvas draws it (landscape.ts `solid`): filled, then its strokes; scaled about its base. */
function item(p: Placed): string {
  const s = p.shape;
  const t = `translate(${f(p.x)} ${f(p.y + p.base * (1 - p.k))})${p.k !== 1 ? ` scale(${f(p.k)})` : ""}`;
  let out = s.fill ? `<path d="${s.fill}"/>` : "";
  out += strokesOf(s);
  // Punch-outs (the clock face): the canvas erases them to what is behind, so here they are the layer behind, at the same alpha.
  for (const c of s.cut ?? [])
    out += c.width
      ? `<path data-cut d="${c.d}" fill="none" stroke-width="${c.width}"/>`
      : `<path data-cut d="${c.d}" opacity="${c.alpha}"/>`;
  return `<g transform="${t}">${out}</g>`;
}

/** The layer's placed shapes between x0 and x1 units (with a margin) that `keep` takes, as markup. */
const items = (
  world: World | null,
  layer: LayerId,
  x0: number,
  x1: number,
  keep: (p: Placed, layer: LayerId) => boolean = () => true,
): string => {
  let out = "";
  for (const p of world?.layers[layer] ?? []) {
    const a = p.x + p.shape.x0 * p.k;
    const b = p.x + p.shape.x1 * p.k;
    if (a > x1 + 30 || b < x0 - 30 || !keep(p, layer)) continue;
    out += item(p);
  }
  return out;
};

/**
 * The band from x0 to x1 units, in the canvas's order (landscape.ts `draw`): the city glow, far hills, tea gardens, the
 * river with its bank reflection and glint, the town's bank, the near ground. `fade` adds the scenes' ground fade
 * below the band. `id` names the SVG defs (two fallbacks share a document). `keep` leaves placed shapes out.
 */
function band(
  world: World | null,
  x0: number,
  x1: number,
  step: number,
  o: { id: string; fade?: boolean; keep?: (p: Placed, layer: LayerId) => boolean },
): string {
  const w = x1 - x0;
  const keep = o.keep;
  // Light pollution behind the skyline (landscape.ts `draw`): GLOW_HORIZON (50) is the horizon, the glow fading to
  // nothing above it and level down to the bank (70). It shows at night (globals.css).
  const defs =
    `<defs><linearGradient id="${o.id}-glow" x1="0" x2="0" y1="-7" y2="50" gradientUnits="userSpaceOnUse">` +
    `<stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff"/></linearGradient>` +
    `<mask id="${o.id}-glow-m" maskUnits="userSpaceOnUse" x="${x0}" y="-8" width="${w}" height="59">` +
    `<rect x="${x0}" y="-7" width="${w}" height="57" fill="url(#${o.id}-glow)"/></mask>` +
    (o.fade ? fadeDef(o.id, x0, w) : "") +
    `</defs>`;
  return (
    defs +
    `<rect data-glow x="${x0}" y="-7" width="${w}" height="57" mask="url(#${o.id}-glow-m)"/>` +
    `<rect data-glow x="${x0}" y="50" width="${w}" height="20"/>` +
    `<g data-layer="L1"><path d="${ridge(ridgeL1, x0, x1, step)}"/></g>` +
    `<g data-layer="L2"><path d="${ridge(ridgeL2, x0, x1, step)}"/>${items(world, "L2", x0, x1, keep)}</g>` +
    `<rect data-river x="${x0}" y="${RIVER[0]}" width="${w}" height="${f(RIVER[1] - RIVER[0])}"/>` +
    `<rect data-layer="L3" data-bank x="${x0}" y="${RIVER[0]}" width="${w}" height="2.2"/>` +
    `<line data-glint x1="${x0}" x2="${x1}" y1="87.4" y2="87.4" stroke-width="1" vector-effect="non-scaling-stroke"/>` +
    `<g data-layer="L3"><rect x="${x0}" y="68.5" width="${w}" height="${f(RIVER[0] + 0.5 - 68.5)}"/>${items(world, "L3", x0, x1, keep)}</g>` +
    `<g data-layer="L4"><path data-ground d="${ridge(ridgeL4, x0, x1, step)}"/>${items(world, "L4", x0, x1, keep)}</g>` +
    (o.fade ? `<rect data-ground x="${x0}" y="100" width="${w}" height="24" mask="url(#${o.id}-fade)"/>` : "")
  );
}

/** The scenes' ground fade (landscape.ts: the ground runs on 48px under the band, 1 → 0.55 at 45% → 0), in the defs `id`. */
function fadeDef(id: string, x0: number, w: number): string {
  return (
    `<linearGradient id="${id}-fade-g" x1="0" x2="0" y1="100" y2="124" gradientUnits="userSpaceOnUse">` +
    `<stop offset="0" stop-color="#fff"/><stop offset=".45" stop-color="#fff" stop-opacity=".55"/>` +
    `<stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>` +
    `<mask id="${id}-fade" maskUnits="userSpaceOnUse" x="${x0}" y="100" width="${w}" height="24">` +
    `<rect x="${x0}" y="100" width="${w}" height="24" fill="url(#${id}-fade-g)"/></mask>`
  );
}

/** The landscape's base colours (palette.ts), for globals.css `.sky-fallback` to mix with the sky's. */
const landVars = {
  "--land-l1": LAND_L1,
  "--land-l2": LAND_L2,
  "--land-l3": LAND_L3,
  "--land-l4": LAND_L4,
  "--city-glow": CITY_GLOW,
} as CSSProperties;

// ── Phones: the stage scene ──────────────────────────────────────────────────────────────────────────────────────

/** The widest phone, so the SVG (drawn at 2 px per unit) covers any phone's width. */
const PHONE_W = POSTCARD_VW - 1;

/** Keane Bridge alone, centred on its own centre line, at the scale `buildStageScene` gives it in a band `h` px tall. */
function bridgeSvg(h: number): { markup: string; width: number } {
  const bridge = keaneBridge();
  const k = stageMarkK(h);
  const mid = ((bridge.x0 + bridge.x1) / 2) * k;
  return {
    width: (bridge.x1 - bridge.x0) * k + 2,
    markup: `<g data-layer="L3" transform="translate(${f(-mid)} ${f(BANK_Y * (1 - k))}) scale(${k})"><path d="${bridge.fill}"/>${strokesOf(bridge)}</g>`,
  };
}

/** The phone's stage scene (tea hills and Keane Bridge), for the stage's scene slot. Shown below 640px only. */
export function SkyFallbackStage() {
  const world = buildStageScene(PHONE_W, STAGE_SCENE_PX);
  const units = PHONE_W / world.s;
  const mark = world.marks.find((m) => m.id === "bridge");
  // The bridge is drawn by its own SVG (it is centred on the viewport's width); leave it out of the fixed one.
  const isBridge = (p: Placed) =>
    !!mark && p.x + p.shape.x0 * p.k === mark.x0 && p.x + p.shape.x1 * p.k === mark.x1;
  const bridge = bridgeSvg(STAGE_SCENE_PX);
  return (
    <div aria-hidden="true" className="sky-fallback sky-fallback-stage" data-sky-fallback="stage" style={landVars}>
      {/* The markup is built here at build time from the landscape's own path data, so it is injected as HTML. */}
      <svg
        viewBox={`0 0 ${f(units + 4)} 124`}
        preserveAspectRatio="xMinYMax slice"
        dangerouslySetInnerHTML={{
          __html: band(world, 0, units, 2, { id: "sky-fb-stage", fade: true, keep: (p) => !isBridge(p) }),
        }}
      />
      <svg
        className="sky-fallback-bridge"
        viewBox={`${f(-bridge.width / 2)} 0 ${f(bridge.width)} 100`}
        style={{ width: f(bridge.width * 2), height: STAGE_SCENE_PX, marginLeft: f(-bridge.width) }}
        dangerouslySetInnerHTML={{ __html: bridge.markup }}
      />
    </div>
  );
}

// ── Desktop: the fixed band ─────────────────────────────────────────────────────────────────────────────────────

/** The band's SVG covers this many units from the left edge: 1400 at 18vh of height is any viewport up to 2.52:1. */
export const BAND_UNITS = 1400;

/**
 * The near foreground is drawn up to here. Beyond, the canvas keeps the layer clear in front of the airport on some
 * viewports (world.ts `clearL4`, which moves with the page's height); in front of it nothing is ever skipped.
 */
export const L4_UNITS = 1000;

/** Ali Amjad's Clock on the right gutter's centre, with Keane Bridge reaching left from it (`bridgeAndTower`, "tower-right"). */
function landmarksMarkup(): string {
  const tower = clockTower();
  const bridge = keaneBridge();
  return (
    `<g data-layer="L3">` +
    item({ shape: tower, x: 0, y: 0, k: 1, base: BANK_Y }) +
    item({ shape: bridge, x: -9 - bridge.x1, y: 0, k: 1, base: BANK_Y }) +
    `</g>`
  );
}

/** The fixed band's fallback for ≥ 1100px: the first landmark set and the fillers. The home page only. */
export function SkyFallbackBand() {
  const world = buildFillers(BAND_UNITS + 30);
  return (
    <div aria-hidden="true" className="sky-fallback sky-fallback-band" data-sky-fallback="band" style={landVars}>
      <svg
        viewBox={`0 0 ${BAND_UNITS} 100`}
        preserveAspectRatio="xMinYMax slice"
        dangerouslySetInnerHTML={{
          __html: band(world, 0, BAND_UNITS, 4, {
            id: "sky-fb-band",
            keep: (p, layer) => layer === "L2" || (layer === "L4" && p.x + 26 < L4_UNITS),
          }),
        }}
      />
      <svg
        className="sky-fallback-landmarks"
        data-sky-fallback-landmarks=""
        viewBox="-202 0 210 100"
        dangerouslySetInnerHTML={{ __html: landmarksMarkup() }}
      />
    </div>
  );
}
