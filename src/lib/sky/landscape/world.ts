/**
 * The landscape's worlds: what stands where on each layer, in band units (1 unit = H / 100 px). Built once per
 * layout; generic things tile with seeded variation, landmarks are placed once. Pure: the renderer turns the
 * path data into Path2D and bitmaps.
 *
 * - buildWorld: the fixed band (gutter and centre modes, anchors.ts). In gutter mode every landmark is centred on
 *   its gutter and scaled to ≤ 90% of the gutter's width, except Keane Bridge, whose spans run on under the column
 *   (the clock tower stands at the gutter centre, the bridge reaches left from it).
 * - buildStageScene / buildClosingScene: scene mode (< 1100px), the stage's horizon and the band above the footer.
 */
import { mulberry32 } from "../random";
import {
  CLOSING_SCENE,
  gutterWidth,
  PARALLAX,
  STAGE_SCENE,
  type Anchor,
  type LandMode,
  type LayerId,
} from "./anchors";
import {
  AIRPORT_GLASS,
  AIRPORT_PLANE,
  AIRPORT_RUNWAY,
  AIRPORT_WINDSOCK,
  airport,
  bamboo,
  BANK_Y,
  bankThing,
  cityBlock,
  clockTower,
  keaneBridge,
  lampPost,
  lowWall,
  palm,
  rickshaw,
  shadeTree,
  type LightKind,
  type Pt,
  type Shape,
} from "./shapes";

/** A shape at (x, y) band units, scaled by k about its base line (y = base), so it still stands on the bank. */
export type Placed = { shape: Shape; x: number; y: number; k: number; base: number };
export type Light = { x: number; y: number; kind: LightKind; i: number };
/** The airport set piece in world units (L3): runway, glass, windsock and the gate, plus its scale. */
export type AirportGeom = {
  runway: { x0: number; x1: number; y: number; hw: number };
  glass: [number, number, number, number][];
  windsock: Pt;
  gate: Pt;
  k: number;
};
export type World = {
  /** px per unit */
  s: number;
  layers: Record<LayerId, Placed[]>;
  lights: Record<LayerId, Light[]>;
  /** World extent per layer, units (from `start`). */
  start: number;
  length: Record<LayerId, number>;
  /** Where the parked plane stands (L3 units) and its scale, if the airport is in this world. */
  plane: Pt | null;
  planeK: number;
  airport: AirportGeom | null;
  /** Landmark extents (L3 units), for tests and the review. */
  marks: { id: string; x0: number; x1: number }[];
};

/** Far hills (the Khasi-Jaintia range on the northern horizon). */
export const ridgeL1 = (x: number) =>
  34 + 9 * Math.sin(x / 97 + 1.3) + 5 * Math.sin(x / 41 + 0.4) + 2.2 * Math.sin(x / 17 + 2.1);
/** Tea-garden mounds. */
export const ridgeL2 = (x: number) =>
  56 + 5 * Math.sin(x / 53 + 0.7) + 2.5 * Math.sin(x / 21 + 1.9) + Math.sin(x / 9 + 0.3);
/** The near bank (in front of the river), where the foreground stands. */
export const ridgeL4 = (x: number) =>
  89 + 1.2 * Math.sin(x / 31 + 0.5) + 0.6 * Math.sin(x / 11 + 1.7);

const within = (x0: number, x1: number, taken: [number, number][]) =>
  taken.some(([a, b]) => x1 > a && x0 < b);

/** A world under construction: placement with scale, and the generic fillers. */
function builder(s: number, start: number, length: Record<LayerId, number>) {
  const layers: World["layers"] = { L1: [], L2: [], L3: [], L4: [] };
  const lights: World["lights"] = { L1: [], L2: [], L3: [], L4: [] };
  const marks: World["marks"] = [];
  const taken: [number, number][] = [];
  const put = (
    layer: LayerId,
    shape: Shape,
    x: number,
    y = 0,
    mark?: string,
    k = 1,
    base = BANK_Y,
  ) => {
    layers[layer].push({ shape, x, y, k, base });
    for (const l of shape.lights ?? [])
      lights[layer].push({
        x: x + l.at[0] * k,
        y: y + base + (l.at[1] - base) * k,
        kind: l.kind,
        i: lights[layer].length,
      });
    if (mark) marks.push({ id: mark, x0: x + shape.x0 * k, x1: x + shape.x1 * k });
  };
  /**
   * The nearest start to `lo` for an extent of width w that overlaps nothing placed (6 units apart): nudged right
   * past what's in the way, or left, whichever moves it less. `right` = only rightwards (the old left-to-right fill).
   */
  const free = (lo: number, w: number, right = false) => {
    const clash = (x: number) => taken.some(([a, b]) => x + w > a - 6 && x < b + 6);
    if (!clash(lo)) return lo;
    const ends = taken
      .flatMap(([a, b]) => [b + 6, a - 6 - w])
      .filter((x) => (right ? x > lo : true) && !clash(x));
    return ends.sort((p, q) => Math.abs(p - lo) - Math.abs(q - lo))[0] ?? lo;
  };
  /** Place a landmark on L3 without overlapping earlier ones (moved the least it takes if it would). */
  const landmark = (shape: Shape, x: number, mark: string, k = 1, right = false) => {
    const w = (shape.x1 - shape.x0) * k;
    const lo = free(x + shape.x0 * k, w, right);
    const at = lo - shape.x0 * k;
    put("L3", shape, at, 0, mark, k);
    taken.push([lo, lo + w]);
    return at;
  };
  /** L4 ranges (units) kept clear of foreground, so nothing stands in front of the airport when it's reached. */
  const clearL4: [number, number][] = [];
  const fill = () => {
    // L3: riverside trees and low houses wherever the landmarks aren't.
    {
      const r = mulberry32(303);
      for (let x = start - 60; x < start + length.L3; x += 22 + r() * 60) {
        const seed = (x * 7.13) | 0;
        if (r() < 0.35 || within(x - 8, x + 14, taken)) continue;
        put("L3", bankThing(seed), x);
      }
    }
    // L2: tea gardens: shade trees standing on the mounds (the hills and rows are drawn from ridgeL2).
    {
      const r = mulberry32(202);
      for (let x = start - 40; x < start + length.L2; x += 60 + r() * 110)
        put("L2", shadeTree((x * 3.7) | 0), x, ridgeL2(x) + 0.8);
    }
    // L4: near foreground, sparse so the view stays open: palms, bamboo, lamp posts, a low wall, a parked rickshaw.
    // Shapes are authored standing at y = 100; they're lifted to the near bank's ground line.
    const ground = (x: number) => ridgeL4(x) - 99.2;
    {
      const r = mulberry32(404);
      let x = start - 30;
      while (x < start + length.L4) {
        if (within(x - 26, x + 26, clearL4)) {
          x += 12;
          continue;
        }
        const k = r();
        const seed = (x * 11.3) | 0;
        if (k < 0.32) x += 40 + r() * 50;
        else if (k < 0.52) {
          put("L4", palm(seed), x);
          x += 50 + r() * 40;
        } else if (k < 0.66) {
          put("L4", bamboo(seed), x, ground(x));
          x += 44 + r() * 30;
        } else if (k < 0.84) {
          put("L4", lampPost(), x, ground(x));
          x += 40 + r() * 30;
        } else if (k < 0.95) {
          const w = 40 + r() * 50;
          put("L4", lowWall(w), x, Math.min(ground(x), ground(x + w)));
          x += w + 16 + r() * 20;
        } else {
          put("L4", rickshaw(0.4), x, 100 + ground(x));
          x += 46 + r() * 30;
        }
      }
    }
  };
  return { layers, lights, marks, taken, put, landmark, free, fill, clearL4 };
}

/** The airport's geometry in world units, for its shape placed at x with scale k (scaled about the bank). */
function airportGeom(x: number, k: number): AirportGeom {
  const X = (u: number) => x + u * k;
  const Y = (v: number) => BANK_Y + (v - BANK_Y) * k;
  const r = AIRPORT_RUNWAY;
  return {
    runway: { x0: X(r.x0), x1: X(r.x1), y: Y(r.y), hw: r.hw * k },
    glass: AIRPORT_GLASS.map(([x0, y0, x1, y1]) => [X(x0), Y(y0), X(x1), Y(y1)]),
    windsock: [X(AIRPORT_WINDSOCK[0]), Y(AIRPORT_WINDSOCK[1])],
    gate: [X(AIRPORT_PLANE[0]), Y(AIRPORT_PLANE[1])],
    k,
  };
}

const lengths = (vw: number, walk: number, s: number) =>
  Object.fromEntries(
    (Object.keys(PARALLAX) as LayerId[]).map((k) => [k, (vw + walk * PARALLAX[k] + 400) / s]),
  ) as Record<LayerId, number>;

/**
 * Keane Bridge with Ali Amjad's Clock. "tower-right": the tower stands at `x` (moved the least it takes to clear
 * what's already placed), the bridge reaches left from it.
 */
function bridgeAndTower(
  b: ReturnType<typeof builder>,
  x0: number,
  layout: "tower-left" | "tower-right",
) {
  const bridge = keaneBridge();
  if (layout === "tower-right") {
    const lo = x0 - 9 - bridge.x1 + bridge.x0 - 6;
    const x = x0 + (b.free(lo, x0 + 9 - lo) - lo);
    b.put("L3", clockTower(), x, 0, "clock");
    b.put("L3", bridge, x - 9 - bridge.x1, 0, "bridge");
    b.taken.push([x - 9 - bridge.x1 + bridge.x0 - 6, x + 9]);
  } else {
    const x = x0;
    b.put("L3", bridge, x - 80, 0, "bridge");
    b.put("L3", clockTower(), x - 80 - 28, 0, "clock");
    b.taken.push([x - 80 - 40, x + 80 + 22]);
  }
}

/** The fixed band: landmarks from the anchors (gutter or centre mode). */
export function buildWorld(
  anchors: Anchor[],
  vw: number,
  vh: number,
  docH: number,
  H: number,
  mode: LandMode = "centre",
): World {
  const s = H / 100;
  const length = lengths(vw, Math.max(0, docH - vh), s);
  const b = builder(s, 0, length);
  const u = (px: number) => px / s;
  const at = (id: string) => anchors.find((a) => a.id === id);
  // Gutter mode: landmarks ≤ 90% of the gutter (the bridge excepted).
  const fit = mode === "gutter" ? (0.9 * gutterWidth(vw)) / s : Infinity;
  const scaleTo = (shape: Shape) => Math.min(1, fit / (shape.x1 - shape.x0));

  const bridgeX = u(at("bridge")?.x ?? vw / 2);
  // Gutter mode: the airport first (it's the end of the walk, reached at the bottom of the page, and must stand
  // exactly on its gutter there), then the bridge and the city clusters around it. Each landmark appears once.
  const port = at("airport");
  let geom: AirportGeom | null = null;
  if (port && mode === "gutter") {
    const shape = airport();
    const k = scaleTo(shape);
    geom = airportGeom(
      b.landmark(shape, u(port.x) - ((shape.x0 + shape.x1) / 2) * k, "airport", k),
      k,
    );
    // At the airport's scroll, keep the near layer (L4, parallax 0.9) clear in front of it.
    const shift = (port.s * (PARALLAX.L4 - PARALLAX.L3)) / s;
    b.clearL4.push([
      geom.runway.x0 + shift - 60,
      geom.gate[0] + (shape.x1 - AIRPORT_PLANE[0]) * k + shift + 10,
    ]);
  }
  if (mode === "gutter") bridgeAndTower(b, bridgeX, "tower-right");
  else bridgeAndTower(b, bridgeX, "tower-left");
  let cursor = bridgeX + 80 + 26;
  const city = at("city");
  if (mode === "gutter") {
    // A cluster in the left gutter for each city section.
    for (const id of ["city", "city2"] as const) {
      const a = at(id);
      if (!a) continue;
      const w = Math.min(95, fit);
      b.landmark(cityBlock(41 + (id === "city2" ? 7 : 0), w, id === "city"), u(a.x) - w / 2, id);
    }
  } else if (city) {
    const start = Math.max(cursor, u(city.x) - 45);
    const end = Math.max(u(at("city2")?.x ?? city.x) + 55, start + 95);
    b.put("L3", cityBlock(41, end - start, true), start, 0, "city");
    b.taken.push([start - 8, end + 8]);
    cursor = end + 16;
  }
  if (port && mode !== "gutter") {
    const shape = airport();
    geom = airportGeom(b.landmark(shape, Math.max(cursor, u(port.x) - 123), "airport", 1, true), 1);
  }
  b.fill();
  return {
    s,
    layers: b.layers,
    lights: b.lights,
    start: 0,
    length,
    plane: geom?.gate ?? null,
    planeK: geom?.k ?? 1,
    airport: geom,
    marks: b.marks,
  };
}

/** Scene mode: the stage's horizon. Tea gardens with the hills behind, the Surma and Keane Bridge in front. */
export function buildStageScene(vw: number, H: number): World {
  const s = H / 100;
  const length = lengths(vw, vw, s);
  const b = builder(s, 0, length);
  bridgeAndTower(b, (STAGE_SCENE.bridge * vw) / s, "tower-left");
  b.fill();
  return {
    s,
    layers: b.layers,
    lights: b.lights,
    start: 0,
    length,
    plane: null,
    planeK: 1,
    airport: null,
    marks: b.marks,
  };
}

/** Scene mode: the closing band above the footer: Osmani Airport, right of centre, the climb-out to its left. */
export function buildClosingScene(vw: number, H: number): World {
  const s = H / 100;
  const swing = 0.15 * vw;
  const start = -swing / s;
  const length = lengths(vw, 2 * swing, s);
  const b = builder(s, start, length);
  const shape = airport();
  const k = Math.min(1, (CLOSING_SCENE.airportW * vw) / s / (shape.x1 - shape.x0));
  const x = b.landmark(
    shape,
    (CLOSING_SCENE.airport * vw) / s - ((shape.x0 + shape.x1) / 2) * k,
    "airport",
    k,
  );
  closingClear(b, x, k, shape);
  b.fill();
  const geom = airportGeom(x, k);
  return {
    s,
    layers: b.layers,
    lights: b.lights,
    start,
    length,
    plane: geom.gate,
    planeK: k,
    airport: geom,
    marks: b.marks,
  };
}

/** The closing scene's airport extent (units), kept clear of the near layer. */
function closingClear(b: ReturnType<typeof builder>, x: number, k: number, shape: Shape) {
  b.clearL4.push([x + shape.x0 * k - 40, x + shape.x1 * k + 6]);
}
