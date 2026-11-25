/**
 * The landscape's world: what stands where on each layer, in band units (1 unit = H / 100 px). Built once per
 * layout from the landmark anchors (anchors.ts); generic things tile with seeded variation, landmarks are placed
 * once. Pure: the renderer turns the path data into Path2D and bitmaps.
 */
import { mulberry32 } from "../random";
import { PARALLAX, type Anchor, type LayerId } from "./anchors";
import { AIRPORT_PLANE, airport, bamboo, bankThing, cityBlock, clockTower, keaneBridge, lampPost, lowWall, palm, rickshaw, shadeTree, type Pt, type Shape } from "./shapes";

export type Placed = { shape: Shape; x: number; y: number };
export type Light = { x: number; y: number; kind: "window" | "lamp" | "deck" | "runway"; i: number };
export type World = {
  /** px per unit */
  s: number;
  layers: Record<LayerId, Placed[]>;
  lights: Record<LayerId, Light[]>;
  /** World length per layer, units. */
  length: Record<LayerId, number>;
  /** Where the parked plane stands (L3 units), if the airport is on this page. */
  plane: Pt | null;
  /** Landmark extents (L3 units), for tests and the review. */
  marks: { id: string; x0: number; x1: number }[];
};

/** Far hills (the Khasi-Jaintia range on the northern horizon). */
export const ridgeL1 = (x: number) => 34 + 9 * Math.sin(x / 97 + 1.3) + 5 * Math.sin(x / 41 + 0.4) + 2.2 * Math.sin(x / 17 + 2.1);
/** Tea-garden mounds. */
export const ridgeL2 = (x: number) => 56 + 5 * Math.sin(x / 53 + 0.7) + 2.5 * Math.sin(x / 21 + 1.9) + Math.sin(x / 9 + 0.3);
/** The near bank (in front of the river), where the foreground stands. */
export const ridgeL4 = (x: number) => 89 + 1.2 * Math.sin(x / 31 + 0.5) + 0.6 * Math.sin(x / 11 + 1.7);

const within = (x0: number, x1: number, taken: [number, number][]) => taken.some(([a, b]) => x1 > a && x0 < b);

export function buildWorld(anchors: Anchor[], vw: number, vh: number, docH: number, H: number): World {
  const s = H / 100;
  const scroll = Math.max(0, docH - vh);
  const length = Object.fromEntries(
    (Object.keys(PARALLAX) as LayerId[]).map((k) => [k, (vw + scroll * PARALLAX[k] + 400) / s]),
  ) as Record<LayerId, number>;
  const layers: World["layers"] = { L1: [], L2: [], L3: [], L4: [] };
  const lights: World["lights"] = { L1: [], L2: [], L3: [], L4: [] };
  const marks: World["marks"] = [];
  const u = (px: number) => px / s;
  const at = (id: string) => anchors.find((a) => a.id === id);
  const put = (layer: LayerId, shape: Shape, x: number, y = 0, mark?: string) => {
    layers[layer].push({ shape, x, y });
    for (const l of shape.lights ?? []) lights[layer].push({ x: x + l.at[0], y: y + l.at[1], kind: l.kind, i: lights[layer].length });
    if (mark) marks.push({ id: mark, x0: x + shape.x0, x1: x + shape.x1 });
  };

  // L3: Keane Bridge with Ali Amjad's Clock on the bank, the city, the airport. Pages without sections still
  // get the bridge, centred at the top.
  const taken: [number, number][] = [];
  const bridgeC = u(at("bridge")?.x ?? vw / 2);
  const bridge = keaneBridge();
  put("L3", bridge, bridgeC - 80, 0, "bridge");
  put("L3", clockTower(), bridgeC - 80 - 28, 0, "clock");
  taken.push([bridgeC - 80 - 40, bridgeC + 80 + 22]);
  let cursor = bridgeC + 80 + 26;
  const city = at("city");
  if (city) {
    const start = Math.max(cursor, u(city.x) - 45);
    const end = Math.max(u(at("city2")?.x ?? city.x) + 55, start + 95);
    put("L3", cityBlock(41, end - start, true), start, 0, "city");
    taken.push([start - 8, end + 8]);
    cursor = end + 16;
  }
  const port = at("airport");
  let plane: Pt | null = null;
  if (port) {
    const start = Math.max(cursor, u(port.x) - 123);
    put("L3", airport(), start, 0, "airport");
    taken.push([start - 8, start + 238]);
    plane = [start + AIRPORT_PLANE[0], AIRPORT_PLANE[1]];
  }
  // Generic bank: riverside trees and low houses wherever the landmarks aren't.
  {
    const r = mulberry32(303);
    for (let x = -60; x < length.L3; x += 22 + r() * 60) {
      const seed = (x * 7.13) | 0;
      if (r() < 0.35 || within(x - 8, x + 14, taken)) continue;
      put("L3", bankThing(seed), x);
    }
  }

  // L2: tea gardens: shade trees standing on the mounds (the hills and rows are drawn from ridgeL2).
  {
    const r = mulberry32(202);
    for (let x = -40; x < length.L2; x += 34 + r() * 70) put("L2", shadeTree((x * 3.7) | 0), x, ridgeL2(x) + 0.8);
  }

  // L4: near foreground, sparse so the view stays open: palms, bamboo, lamp posts, a low wall, a parked rickshaw.
  // Shapes are authored standing at y = 100; they're lifted to the near bank's ground line.
  const ground = (x: number) => ridgeL4(x) - 99.2;
  {
    const r = mulberry32(404);
    let x = -30;
    while (x < length.L4) {
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
  return { s, layers, lights, length, plane, marks };
}
