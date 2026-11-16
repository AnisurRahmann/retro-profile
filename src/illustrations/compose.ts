import type { IllustrationPart } from "@/schema";
import { manifest } from "./generated/manifest";

/**
 * How the traced parts of one object are put together. Units are source sheet pixels,
 * so parts of the same sheet keep their relative scale. Server only (the manifest is zod-parsed).
 */

export function part(asset: string, name: string): IllustrationPart {
  const found = manifest[asset]?.parts.find((entry) => entry.name === name);
  if (!found) throw new Error(`illustration part "${asset}/${name}" is not in the manifest. Run pnpm illustrations.`);
  return found;
}

/** transform-origin for a part, from its manifest pivot. Used with transform-box: fill-box. */
export function pivotOrigin(entry: IllustrationPart): string {
  return `${Math.round(entry.pivot[0] * 1000) / 10}% ${Math.round(entry.pivot[1] * 1000) / 10}%`;
}

export interface Placed {
  name: string;
  x: number;
  y: number;
  scale: number;
}

const round = (value: number) => Math.round(value * 10) / 10;

// ── A02 rack ─────────────────────────────────────────────────

/** side-on plate colours from the inside out. The order matches `buses` in content.ts. */
export const PLATE_COLOURS = ["red", "blue", "yellow", "green", "chalk", "iron"] as const;

/** where the J-hooks hold the bar, measured down from the top of the rack part */
const HOOK_Y = 145;
/** bar sleeve: distance from the bar's end to the outer face of its collar */
const SLEEVE = 100;
/** side-on plates are drawn larger than the sleeve allows: scaled, and overlapped so each shows a strip */
const PLATE_SCALE = 0.7;
const PLATE_PITCH = 14.5;
/** centre line of the bowed bar at its crown, measured down from the top of the scaled part */
const BOWED_CROWN = 14;

export function rackLayout() {
  const rack = part("a02", "rack");
  const straight = part("a02", "bar-straight");
  const bowed = part("a02", "bar-bowed");
  const width = straight.width;
  const height = rack.height;
  // the bowed bar was drawn shorter: stretch it to the straight bar's length, its crown on the hooks
  const bowedScale = straight.width / bowed.width;
  const plates = (["l", "r"] as const).flatMap((side) =>
    PLATE_COLOURS.map((colour, index) => {
      const plate = part("a02", `plate-side-${colour}`);
      const w = plate.width * PLATE_SCALE;
      const inner = SLEEVE - 1 - index * PLATE_PITCH;
      return {
        side,
        index,
        colour,
        name: plate.name,
        x: round(side === "l" ? inner - w : width - inner),
        y: round(HOOK_Y - (plate.height * PLATE_SCALE) / 2),
        scale: PLATE_SCALE,
      };
    }),
  );
  return {
    width,
    height,
    rack: { name: rack.name, x: round((width - rack.width) / 2), y: 0, scale: 1 } satisfies Placed,
    straight: { name: straight.name, x: 0, y: round(HOOK_Y - straight.height / 2), scale: 1 } satisfies Placed,
    bowed: { name: bowed.name, x: 0, y: HOOK_Y - BOWED_CROWN, scale: round(bowedScale * 1000) / 1000 } satisfies Placed,
    plates,
  };
}

// ── A01b character, whole poses ──────────────────────────────

export const CHARACTER_POSES = ["idle", "wave", "chalk"] as const;
const PUFFS = ["puff-a", "puff-b"] as const;

/** The poses stand on one baseline and share one anchor: the point between the feet (the manifest pivot). */
export function characterLayout() {
  const poses = CHARACTER_POSES.map((pose) => ({ pose, entry: part("a01b", `pose-${pose}`) }));
  const chalk = poses.find(({ pose }) => pose === "chalk")!.entry;
  const puffs = PUFFS.map((name) => part("a01b", name));
  const left = Math.max(...poses.map(({ entry }) => entry.pivot[0] * entry.width));
  const chalkAnchor = chalk.origin[0] + chalk.pivot[0] * chalk.width;
  const right = Math.max(
    ...poses.map(({ entry }) => (1 - entry.pivot[0]) * entry.width),
    ...puffs.map((puff) => puff.origin[0] + puff.width - chalkAnchor),
  );
  const height = Math.max(...poses.map(({ entry }) => entry.height));
  return {
    width: Math.ceil(left + right),
    height,
    poses: poses.map(({ pose, entry }) => ({
      pose,
      name: entry.name,
      x: round(left - entry.pivot[0] * entry.width),
      y: height - entry.height,
      scale: 1,
      origin: pivotOrigin(entry),
    })),
    // loose chalk puffs keep their place relative to the chalk pose
    puffs: puffs.map((puff) => ({
      name: puff.name,
      x: round(left + puff.origin[0] - chalkAnchor),
      y: height - chalk.height + puff.origin[1] - chalk.origin[1],
      scale: 1,
    })),
  };
}

// ── A03 to A12: objects described as a tree of placed parts ───

/**
 * One group in an object. `id` becomes `data-p`, the hook for CSS and the runtime.
 * `origin` is the joint in layout units: the group turns and scales around it.
 */
export interface PartNode {
  id: string;
  name?: string;
  /** static placement of the traced part, an SVG transform */
  transform?: string;
  origin?: [number, number];
  /** only shows during a sequence: not part of the final pose */
  hidden?: boolean;
  children?: PartNode[];
}

/** a rectangle in layout units, for live HTML laid over a blank surface */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ObjectLayout {
  asset: string;
  width: number;
  height: number;
  nodes: PartNode[];
}

interface PutOptions {
  scale?: number;
  rotate?: number;
  flip?: boolean;
  /** overrides the pivot from the parts map, normalised to the part's box */
  pivot?: [number, number];
  hidden?: boolean;
}

/** Places a part so that its pivot lands on `at`. The same point is the group's transform origin. */
function put(asset: string, id: string, name: string, at: [number, number], options: PutOptions = {}): PartNode {
  const entry = part(asset, name);
  const { scale = 1, rotate = 0, flip = false, hidden } = options;
  const [px, py] = options.pivot ?? entry.pivot;
  const steps = [
    `translate(${round(at[0])} ${round(at[1])})`,
    rotate ? `rotate(${rotate})` : "",
    scale !== 1 || flip ? `scale(${flip ? -scale : scale} ${scale})` : "",
    `translate(${round(-px * entry.width)} ${round(-py * entry.height)})`,
  ];
  return { id, name, transform: steps.filter(Boolean).join(" "), origin: at, ...(hidden ? { hidden } : {}) };
}

const TOP_LEFT: [number, number] = [0, 0];
const group = (id: string, children: PartNode[], origin?: [number, number], hidden?: boolean): PartNode => ({
  id,
  children,
  ...(origin ? { origin } : {}),
  ...(hidden ? { hidden } : {}),
});

/** percentages of the object's box, for absolutely placed HTML */
export function boxStyle(layout: { width: number; height: number }, box: Box) {
  const pct = (value: number, of: number) => `${Math.round((value / of) * 10000) / 100}%`;
  return { left: pct(box.x, layout.width), top: pct(box.y, layout.height), width: pct(box.w, layout.width), height: pct(box.h, layout.height) };
}

// A03 whiteboard. The board is blank: the six numbers are HTML in `grid`, three to a row.
const WB = { cols: 3, rows: 2, grid: { x: 70, y: 84, w: 580, h: 330 }, underline: 0.62, rest: [668, 440] as [number, number] };

export function whiteboardLayout() {
  const { grid } = WB;
  const cellW = grid.w / WB.cols;
  const cellH = grid.h / WB.rows;
  const line = part("a03", "underline").width * WB.underline;
  /** where the underline starts for each number, in reading order */
  const underlines = Array.from({ length: WB.cols * WB.rows }, (_, index) => ({
    x: round(grid.x + (index % WB.cols) * cellW + (cellW - line) / 2),
    y: round(grid.y + Math.floor(index / WB.cols) * cellH + cellH * 0.86),
  }));
  const nodes: PartNode[] = [
    put("a03", "board", "board", [0, 0], { pivot: TOP_LEFT }),
    put("a03", "magnet-a", "magnet-yellow", [58, 54], { scale: 0.6 }),
    put("a03", "magnet-b", "magnet-green", [662, 54], { scale: 0.6 }),
    put("a03", "pen-a", "marker-red", [226, 463], { scale: 0.4, pivot: [0.5, 1] }),
    put("a03", "pen-b", "marker-blue", [330, 463], { scale: 0.4, pivot: [0.5, 1] }),
    put("a03", "eraser", "eraser", [530, 465], { scale: 0.38 }),
    // the underline and the marker are moved to a number by the runtime: both start from the first one
    group("line-at", [put("a03", "line", "underline", [underlines[0]!.x, underlines[0]!.y], { scale: WB.underline, hidden: true })]),
    group("marker-at", [put("a03", "marker", "marker-writing", WB.rest, { scale: 0.8 })]),
  ];
  return { asset: "a03", width: 800, height: 492, nodes, grid, underlines, line: round(line), rest: WB.rest, cols: WB.cols };
}

// A05 bot: body, three heads (one shows), antenna, arms, sound arcs above the antenna (outside the box, they only show while it speaks)
export function botLayout() {
  const cx = 240;
  const neck = 415;
  const arcs = (["large", "medium", "small"] as const).map((size, index) =>
    put("a05", `arc-${size}`, `arc-${size}`, [cx, 56 + index * 19], { scale: 0.62, hidden: true }),
  );
  const nodes: PartNode[] = [
    put("a05", "arm-l", "arm-left", [108, 574], { scale: 0.52, rotate: 14 }),
    put("a05", "arm-r", "arm-right", [372, 574], { scale: 0.52, rotate: -14 }),
    put("a05", "body", "body", [cx, 696]),
    group("antenna-bob", [put("a05", "antenna", "antenna", [cx, 214], { scale: 0.5 })]),
    put("a05", "head-open", "head-open", [cx, neck]),
    put("a05", "head-closed", "head-closed", [cx, neck], { hidden: true }),
    put("a05", "head-happy", "head-happy", [cx, neck], { hidden: true }),
    group("arcs", arcs.reverse(), [cx, 110]),
  ];
  return { asset: "a05", width: 480, height: 696, nodes, top: 110 };
}

// A06 bike: wheels on the axle points of the frame, kickstand flicked up (the final pose), speed lines behind
const BIKE = { frame: [135, 0] as [number, number], rear: [38, 408] as [number, number], front: [653, 410] as [number, number], stand: [112, 432] as [number, number] };

export function bikeLayout() {
  const [fx, fy] = BIKE.frame;
  const rear: [number, number] = [fx + BIKE.rear[0], fy + BIKE.rear[1]];
  const front: [number, number] = [fx + BIKE.front[0], fy + BIKE.front[1]];
  const stand: [number, number] = [fx + BIKE.stand[0], fy + BIKE.stand[1]];
  const lines = (["a", "b", "c"] as const).map((line, index) => put("a06", `speed-${line}`, `speed-line-${line}`, [-10 - (index % 2) * 40, 250 + index * 60], { hidden: true }));
  const nodes: PartNode[] = [
    group("lines", lines),
    group("bike", [
      put("a06", "stand", "kickstand", stand, { rotate: 68 }),
      put("a06", "wheel-rear", "wheel-rear", rear),
      put("a06", "wheel-front", "wheel-front", front),
      put("a06", "frame", "frame", [fx, fy], { pivot: TOP_LEFT }),
      put("a06", "helmet", "helmet", [fx + 190, fy + 44], { scale: 0.8, pivot: [0.5, 1] }),
    ]),
  ];
  return { asset: "a06", width: 960, height: 580, nodes };
}

// A07 chalk bowl on the floor, open logbook on the stool. Puffs and the turning page only show in motion.
export function chalkLayout() {
  const floor = 420;
  const bowl: [number, number] = [78, floor];
  const spine: [number, number] = [262, 136];
  const puffs: [string, number, number, number][] = [
    ["a", 34, 322, 0.5],
    ["b", 82, 290, 0.5],
    ["c", 128, 326, 0.7],
    ["d", 58, 276, 0.6],
    ["e", 112, 282, 0.5],
  ];
  const nodes: PartNode[] = [
    put("a07", "stool", "stool", [262, floor]),
    put("a07", "book", "logbook-open", [spine[0], spine[1] + 4], { scale: 0.42 }),
    put("a07", "page", "page-turn", [spine[0], spine[1] - 62], { scale: 0.4, hidden: true }),
    put("a07", "block", "chalk-block", [196, floor + 2], { scale: 0.36 }),
    put("a07", "bowl", "bowl", bowl, { scale: 0.55 }),
    group(
      "puffs",
      puffs.map(([name, x, y, scale]) => put("a07", `puff-${name}`, `puff-${name}`, [x, y], { scale, hidden: true })),
    ),
  ];
  return { asset: "a07", width: 380, height: floor + 4, nodes };
}

// A08 calendar pad. The goal is HTML on the blank page, the curled page only shows while it tears off.
export function calendarLayout() {
  const page: Box = { x: 62, y: 204, w: 306, h: 296 };
  const nodes: PartNode[] = [put("a08", "pad", "pad", [0, 0], { pivot: TOP_LEFT }), put("a08", "tear", "page-curl", [208, 190], { scale: 0.86, hidden: true })];
  return { asset: "a08", width: 422, height: 556, nodes, page };
}

// A09 miss bin: bent bar standing in it, cracked plate leaning on it, one paper ball in it, one on the floor that gets thrown
export function binLayout() {
  const floor = 750;
  const bin: [number, number] = [312, floor];
  const ball: [number, number] = [70, floor - 36];
  const nodes: PartNode[] = [
    put("a09", "plate", "plate-cracked", [104, floor], { scale: 0.56 }),
    put("a09", "bar", "bar-bent", [350, 262], { rotate: -74 }),
    put("a09", "paper-in", "paper-b", [262, 204], { scale: 0.6 }),
    put("a09", "ball", "paper-c", ball, { scale: 0.5 }),
    put("a09", "bin", "bin", bin),
    put("a09", "plaster", "plaster", [352, 520], { scale: 0.3, rotate: -24 }),
  ];
  // the throw: from the floor, over the plate, down into the bin
  return { asset: "a09", width: 476, height: floor + 4, nodes, ball, into: [bin[0] - 20, 150] as [number, number] };
}

// A10 wall phone: handset across the cradle, cord looping under the body, ring lines beside the handset
export function phoneLayout() {
  const cx = 195;
  const handset: [number, number] = [cx, 166];
  const rings = (["a", "b", "c"] as const).map((ring, index) => put("a10", `ring-${ring}`, `ring-${ring}`, [392 + index * 16, handset[1] - 30], { scale: 0.5 }));
  const nodes: PartNode[] = [
    put("a10", "cord", "cord", [cx - 8, 690], { scale: 0.62 }),
    put("a10", "body", "body", [cx, 0]),
    put("a10", "handset", "handset", handset),
    group("rings", rings, undefined, true),
  ];
  return { asset: "a10", width: 390, height: 840, nodes };
}

// A11 gym kit along the floor: timer, two kettlebells, bag, bottle. The timer's display is blank: the time is HTML.
export function kitLayout() {
  const floor = 300;
  const timer: [number, number] = [0, floor - 196];
  const nodes: PartNode[] = [
    put("a11", "timer", "timer", timer, { pivot: TOP_LEFT }),
    put("a11", "bag", "bag", [860, floor]),
    put("a11", "bell-blue", "kettlebell-blue", [444, floor - 243]),
    put("a11", "bell-yellow", "kettlebell-yellow", [590, floor - 171]),
    put("a11", "bottle", "bottle", [1126, floor]),
  ];
  return { asset: "a11", width: 1180, height: floor + 4, nodes, display: { x: timer[0] + 40, y: timer[1] + 36, w: 254, h: 122 } satisfies Box };
}

// A12 lamp. The light cone was drawn as a slanted wedge: it is sheared upright and hung under the shade.
// The pull cord is its own drawing, because it is the button.
const LAMP = { width: 380, lamp: 362, cone: 270, cordAt: [268, 318] as [number, number], cordScale: 0.4 };

export function lampLayout() {
  const cx = LAMP.width / 2;
  const top: [number, number] = [cx, 0];
  const nodes: PartNode[] = [
    group("cone", [{ id: "cone-shape", name: "light-cone", transform: `translate(${cx} 326) matrix(1.08 1 2.4 0 -485.6 -3)` }]),
    group("sway", [put("a12", "lamp", "lamp", top)], top),
  ];
  const cord = part("a12", "cord");
  return {
    asset: "a12",
    width: LAMP.width,
    height: 326 + LAMP.cone,
    nodes,
    cord: {
      name: cord.name,
      width: cord.width,
      height: cord.height,
      /** where the cord hangs, in layout units */
      box: { x: LAMP.cordAt[0] - (cord.width * LAMP.cordScale) / 2, y: LAMP.cordAt[1], w: cord.width * LAMP.cordScale, h: cord.height * LAMP.cordScale } satisfies Box,
      /** the lamp's hanging point in the cord's own units, so both sway around the same nail */
      sway: [round(cord.width / 2 - (LAMP.cordAt[0] - cx) / LAMP.cordScale), round(-LAMP.cordAt[1] / LAMP.cordScale)] as [number, number],
    },
  };
}

// Wall fixtures from the same sheet: not stations, only drawn in the scaled room.
export function pegboardLayout(): ObjectLayout {
  const nodes: PartNode[] = [
    put("a12", "pegboard", "pegboard", [0, 0], { pivot: TOP_LEFT }),
    put("a12", "wrench", "wrench", [52, 28], { scale: 0.68 }),
    put("a12", "screwdriver", "screwdriver", [112, 30], { scale: 0.68 }),
    put("a12", "hex", "hex-keys", [172, 30], { scale: 0.68 }),
    put("a12", "tape", "tape-measure", [236, 178], { scale: 0.6 }),
  ];
  return { asset: "a12", width: 285, height: 253, nodes };
}

export function windowLayout(): ObjectLayout {
  return { asset: "a12", width: 226, height: 237, nodes: [put("a12", "window", "window", [0, 0], { pivot: TOP_LEFT })] };
}
