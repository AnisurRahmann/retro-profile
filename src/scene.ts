import { z } from "zod";
import { flights, ui } from "@/content";
import { GYM_UI } from "@/gym";
import { characterLayout, rackLayout } from "@/illustrations/compose";
import { manifest } from "@/illustrations/generated/manifest";
import { stationSchema, type Station } from "@/schema";

// ─────────────────────────────────────────────────────────────
// The garage gym: where every object stands in the room.
// Scene space is 1600 x 900, composed left to right after assets/illustrations/raw/a00-anchor-room.png.
// Stations are listed in section order: that is the DOM order, the Tab order and the phone stacking order.
// Labels come from `flights` and `ui`, targets point into the preserved /log/ page. Nothing is invented here.
// ─────────────────────────────────────────────────────────────

export const SCENE = { width: 1600, height: 900 } as const;

/** Backdrop geometry, drawn as inline SVG: wall, lower band, floor line, lifting platform. */
export const ROOM = {
  bandY: 590,
  floorY: 722,
  platform: { x: 500, y: 730, w: 770, h: 58 },
} as const;

function flightLabel(id: string) {
  const flight = flights.find((entry) => entry.id === id);
  if (!flight) throw new Error(`scene: unknown flight "${id}"`);
  return { href: `/log/#${flight.id}`, label: flight.name, plain: flight.plain, section: flight.id };
}

/** footprint of a composed object at a given scale, with its feet at `baseY` and its centre at `centreX` */
function footprint(layout: { width: number; height: number }, scale: number, centreX: number, baseY: number) {
  const w = Math.round(layout.width * scale);
  const h = Math.round(layout.height * scale);
  return { x: Math.round(centreX - w / 2), y: baseY - h, w, h, scale };
}

const t = ui.topbar;

export const stations: Station[] = z
  .array(stationSchema)
  .length(12)
  .parse([
    { id: "character", asset: "a01b", ...footprint(characterLayout(), 0.78, 1178, 772), z: 6, ...flightLabel("platform") },
    { id: "whiteboard", asset: "a03", x: 160, y: 205, w: 300, h: 220, scale: 1, z: 2, ...flightLabel("pr-board") },
    { id: "desk", asset: "a04", x: 150, y: 574, w: 320, h: 170, scale: 1, z: 3, ...flightLabel("training-blocks") },
    { id: "rack", asset: "a02", ...footprint(rackLayout(), 1, 760, 757), z: 5, ...flightLabel("load-the-bar") },
    { id: "chalk", asset: "a07", x: 1296, y: 572, w: 164, h: 160, scale: 1, z: 3, ...flightLabel("training-rules") },
    { id: "calendar", asset: "a08", x: 1340, y: 225, w: 150, h: 150, scale: 1, z: 2, ...flightLabel("next-block") },
    { id: "bin", asset: "a09", x: 1472, y: 602, w: 112, h: 130, scale: 1, z: 3, ...flightLabel("no-lift") },
    { id: "bike", asset: "a06", x: 1352, y: 752, w: 232, h: 132, scale: 1, z: 4, ...flightLabel("actual-log") },
    { id: "kit", asset: "a11", x: 1060, y: 800, w: 250, h: 84, scale: 1, z: 7, href: "/gym/", label: t.gym, plain: GYM_UI.openLogPlain, section: "actual-log" },
    { id: "phone", asset: "a10", x: 24, y: 262, w: 112, h: 200, scale: 1, z: 2, ...flightLabel("spot-me") },
    { id: "bot", asset: "a05", x: 236, y: 458, w: 150, h: 112, scale: 1, z: 4, href: "/notes/", label: ui.notes.link, plain: ui.notes.linkPlain, section: null },
    { id: "lamp", asset: "a12", x: 680, y: 0, w: 160, h: 190, scale: 1, z: 2, href: null, label: t.lightsOn, plain: t.lightsOnPlain, section: null },
  ]);

/** Stations whose art is traced and in the manifest. The rest render as dashed placeholders. */
export function hasArt(station: Station): boolean {
  return station.asset in manifest;
}

/** Routes and anchors a station may point at. Used by the unit test that guards the targets. */
export const SCENE_ROUTES = ["/log/", "/gym/", "/notes/"] as const;

export function sceneProblems(): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const station of stations) {
    if (ids.has(station.id)) problems.push(`duplicate station id "${station.id}"`);
    ids.add(station.id);
    if (station.x + station.w > SCENE.width || station.y + station.h > SCENE.height) problems.push(`station "${station.id}" leaves the scene`);
    if (station.section && !flights.some((flight) => flight.id === station.section)) problems.push(`station "${station.id}" names an unknown flight`);
    if (!station.href) continue;
    const [route, anchor] = station.href.split("#");
    if (!SCENE_ROUTES.includes(route as (typeof SCENE_ROUTES)[number])) problems.push(`station "${station.id}" points at an unknown route "${route}"`);
    if (anchor && (route !== "/log/" || !flights.some((flight) => flight.id === anchor))) problems.push(`station "${station.id}" points at an unknown anchor "#${anchor}"`);
  }
  if (stations.filter((station) => !station.href).length !== 1) problems.push("exactly one station (the lamp) may have no link");
  return problems;
}

const problems = sceneProblems();
if (problems.length > 0) throw new Error(`scene.ts problems:\n- ${problems.join("\n- ")}`);
