/**
 * Landscape silhouettes as SVG path data, in band units: the band is 100 units tall (0 = its top), the river bank
 * (L3 ground) is at y = 70 and the near ground (L4) at y = 100. Paper-cut style: flat shapes that read at a glance.
 * `fill` paths are filled, `stroke` paths are stroked at `width` units (truss members, poles, wires), `cut` paths
 * are punched out (the clock face, tea rows), `lights` are night-light points.
 * Landmarks are hand-built; generic things (hills, bushes, trees, buildings) come from seeded generators.
 */
import { mulberry32 } from "../random";

export type Pt = [number, number];
/** Night lights: windows, lamps, bridge deck lights, runway edge / threshold (green) / far end (red), glass panes. */
export type LightKind = "window" | "lamp" | "deck" | "runway" | "threshold" | "rwyend" | "pane";
export type Shape = {
  fill?: string;
  stroke?: { d: string; width: number }[];
  cut?: { d: string; alpha: number; width?: number }[];
  /** Night lights in local units: windows, lamps, deck lights, runway lights. */
  lights?: { at: Pt; kind: LightKind }[];
  /** Local x extent. */
  x0: number;
  x1: number;
};

const f = (n: number) => +n.toFixed(2);
const rect = (x: number, y: number, w: number, h: number) =>
  `M${f(x)} ${f(y)}h${f(w)}v${f(h)}h${f(-w)}Z`;
const line = (a: Pt, b: Pt) => `M${f(a[0])} ${f(a[1])}L${f(b[0])} ${f(b[1])}`;
const circle = (cx: number, cy: number, r: number) =>
  `M${f(cx - r)} ${f(cy)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0Z`;

export const BANK_Y = 70;
export const RIVER = [72, 86] as const;
export const NEAR_Y = 100;

/**
 * Keane Bridge: the steel truss bridge over the Surma, a row of bowstring spans (curved top chords) on piers.
 * Local x 0 … 160, deck at y 64–67, piers into the river.
 */
export function keaneBridge(): Shape {
  const spans = 5;
  const W = 32;
  const deckTop = 64;
  let fill = rect(0, deckTop, spans * W, 3);
  // Approach ramps down to the banks.
  fill += `M-16 ${BANK_Y}L0 ${deckTop}V67L-7 ${BANK_Y}Z`;
  fill += `M${spans * W + 16} ${BANK_Y}L${spans * W} ${deckTop}V67L${spans * W + 7} ${BANK_Y}Z`;
  const strokes: string[] = [];
  const lights: Shape["lights"] = [];
  for (let i = 0; i <= spans; i++) fill += rect(i * W - 1.6, 67, 3.2, RIVER[1] - 67);
  for (let i = 0; i < spans; i++) {
    const x0 = i * W + 1;
    const x1 = (i + 1) * W - 1;
    const top = (x: number) => deckTop - 15 * Math.sin((Math.PI * (x - x0)) / (x1 - x0));
    // Top chord: the curve.
    let chord = `M${x0} ${deckTop}`;
    for (let k = 1; k <= 16; k++) {
      const x = x0 + ((x1 - x0) * k) / 16;
      chord += `L${f(x)} ${f(top(x))}`;
    }
    strokes.push(chord);
    // Verticals and alternating diagonals (a Pratt-ish web).
    const n = 7;
    for (let k = 1; k < n; k++) {
      const x = x0 + ((x1 - x0) * k) / n;
      strokes.push(line([x, deckTop], [x, top(x)]));
      const xn = x0 + ((x1 - x0) * (k < n / 2 ? k - 1 : k + 1)) / n;
      strokes.push(line([x, top(x)], [xn, deckTop]));
    }
  }
  // A string of 14 warm lights along the deck (mirrored in the river at night).
  for (let k = 0; k < 14; k++)
    lights.push({ at: [(spans * W * (k + 0.5)) / 14, deckTop - 0.5], kind: "deck" });
  return {
    fill,
    stroke: [{ d: strokes.join(""), width: 0.75 }],
    lights,
    x0: -16,
    x1: spans * W + 16,
  };
}

/**
 * Ali Amjad's Clock: the clock tower on the Surma's bank by Keane Bridge. Plinth, shaft, the clock housing with
 * its face, a cornice, a small dome and a finial. Local x −7 … 7, base on the bank.
 */
export function clockTower(): Shape {
  const b = BANK_Y;
  let fill = rect(-7, b - 4, 14, 4);
  fill += rect(-4.5, b - 28, 9, 24);
  fill += rect(-6, b - 37, 12, 9);
  fill += rect(-7, b - 38.5, 14, 1.8);
  fill += `M-5.5 ${b - 38.5}A5.5 5.5 0 0 1 5.5 ${b - 38.5}Z`;
  fill += `M-0.8 ${b - 43.6}L0 ${b - 50}L0.8 ${b - 43.6}Z`;
  return {
    fill,
    cut: [
      { d: circle(0, b - 32.5, 3), alpha: 0.55 },
      {
        d: line([0, b - 32.5], [0, b - 34.6]) + line([0, b - 32.5], [1.6, b - 32.5]),
        alpha: 1,
        width: 0.5,
      },
    ],
    x0: -7,
    x1: 7,
  };
}

/** One city block: flat roofs at varied heights, water tanks, antennas; window points on the facades. */
export function cityBlock(seed: number, width: number, tower: boolean): Shape {
  const r = mulberry32(seed);
  let fill = "";
  const strokes: string[] = [];
  const lights: NonNullable<Shape["lights"]> = [];
  let x = 0;
  while (x < width) {
    const w = 7 + r() * 12;
    const top = BANK_Y - (10 + r() * 22);
    fill += rect(x, top, w + 0.3, BANK_Y - top);
    // Water tank (a squat cylinder) or a stair hut on some roofs.
    if (r() < 0.55) {
      const tx = x + 1 + r() * (w - 5);
      fill += rect(tx, top - 3.2, 3, 3.2) + `M${f(tx)} ${f(top - 3.2)}a1.5 0.7 0 0 1 3 0Z`;
      fill += rect(tx + 0.4, top - 0.2, 0.5, 0.4) + rect(tx + 2.1, top - 0.2, 0.5, 0.4);
    } else if (r() < 0.4) fill += rect(x + w * 0.6, top - 2.5, 3.5, 2.5);
    if (r() < 0.25) strokes.push(line([x + w * 0.3, top], [x + w * 0.3, top - 5 - r() * 4]));
    // Windows: a grid on the facade.
    for (let wy = top + 3; wy < BANK_Y - 3; wy += 3.6)
      for (let wx = x + 1.6; wx < x + w - 1.2; wx += 2.8)
        lights.push({ at: [wx, wy], kind: "window" });
    x += w + (r() < 0.2 ? 1.5 + r() * 3 : 0);
  }
  if (tower) {
    // A mobile tower: tapered lattice legs, cross bracing, two platforms with panels.
    const cx = width * (0.3 + r() * 0.4);
    const base = BANK_Y - 18;
    const topY = 12;
    const leg = (s: number) => line([cx + s * 3.2, base], [cx + s * 0.7, topY]);
    strokes.push(leg(-1), leg(1));
    for (let y = base; y > topY + 4; y -= 5) {
      const w0 = 0.7 + ((3.2 - 0.7) * (y - topY)) / (base - topY);
      const y1 = y - 5;
      const w1 = 0.7 + ((3.2 - 0.7) * (y1 - topY)) / (base - topY);
      strokes.push(line([cx - w0, y], [cx + w1, y1]), line([cx + w0, y], [cx - w1, y1]));
    }
    fill += rect(cx - 2.2, topY + 6, 4.4, 1) + rect(cx - 1.6, topY, 3.2, 0.9);
    fill += rect(cx - 2.6, topY + 3, 0.9, 3) + rect(cx + 1.7, topY + 3, 0.9, 3);
    strokes.push(line([cx, topY], [cx, topY - 4]));
  }
  return { fill, stroke: [{ d: strokes.join(""), width: 0.5 }], lights, x0: 0, x1: width };
}

/**
 * Osmani Airport, a set piece that reads at a glance: a long runway at ground level (drawn by life.ts: tarmac, a
 * dashed centreline, white edge lights, green at the threshold, red at the end), a low terminal with a glass
 * facade, the control tower with its flared glass cab, a fence line, a windsock at the runway's far end, and a
 * narrow-body parked at the gate (life.ts). Local x 0 … 230; the runway runs 0 … 172 in front, the terminal and
 * tower stand right of it, the gate is just past the threshold so the plane taxis on and rolls left.
 */
export function airport(): Airport {
  const b = BANK_Y;
  let fill = "";
  const strokes: string[] = [];
  const lights: NonNullable<Shape["lights"]> = [];
  // Fence: posts every 5 units and two wires, behind the runway.
  for (let x = 1; x <= 228; x += 5) fill += rect(x, b - 3.6, 0.5, 2.8);
  strokes.push(line([0, b - 3.3], [230, b - 3.3]) + line([0, b - 2.1], [230, b - 2.1]));
  // Terminal: long and low, a shallow curved roof, a jet bridge reaching toward the gate.
  fill += `M140 ${b}V${b - 8.5}Q174 ${b - 11.8} 208 ${b - 8.5}V${b}Z`;
  fill += rect(146, b - 12.2, 0.6, 3.2) + rect(200, b - 11.8, 0.6, 3);
  fill += rect(131, b - 6.2, 10, 2.2) + rect(131.5, b - 4, 1.2, 4);
  // Control tower: shaft, flared cab, roof, mast with a crossbar.
  fill += rect(214, b - 30, 4.4, 30);
  fill += `M209.6 ${b - 37.5}H226.4L223.6 ${b - 30}H212.4Z`;
  fill += rect(209, b - 39, 18, 1.5);
  strokes.push(line([216.2, b - 39], [216.2, b - 45]) + line([214.4, b - 43], [218, b - 43]));
  // Runway lights: white along both edges, green across the threshold (right), red across the far end (left).
  for (let x = 4; x <= 166; x += 6)
    lights.push(
      { at: [x, AIRPORT_RUNWAY.y - AIRPORT_RUNWAY.hw], kind: "runway" },
      { at: [x, AIRPORT_RUNWAY.y + AIRPORT_RUNWAY.hw], kind: "runway" },
    );
  for (const dy of [-1, 0, 1]) {
    lights.push({
      at: [AIRPORT_RUNWAY.x1 - 0.5, AIRPORT_RUNWAY.y + dy * AIRPORT_RUNWAY.hw],
      kind: "threshold",
    });
    lights.push({
      at: [AIRPORT_RUNWAY.x0 + 0.5, AIRPORT_RUNWAY.y + dy * AIRPORT_RUNWAY.hw],
      kind: "rwyend",
    });
  }
  // Glass: the terminal's facade and the tower's cab (panes lit at night, the sky's reflection by day).
  for (const [x0, y0, x1, y1] of AIRPORT_GLASS)
    for (let x = x0 + 1.2; x < x1 - 0.6; x += 2.4)
      lights.push({ at: [x, (y0 + y1) / 2], kind: "pane" });
  return { fill, stroke: [{ d: strokes.join(""), width: 0.35 }], lights, x0: 0, x1: 230 };
}
export type Airport = Shape;

/** The runway (local units): from x0 (its far end, left) to x1 (the threshold, right), centreline y, half-width. */
export const AIRPORT_RUNWAY = { x0: 0, x1: 172, y: BANK_Y + 0.7, hw: 1.1 } as const;
/** Glass panes [x0, y0, x1, y1] (local units): the terminal's facade, the tower's cab. */
export const AIRPORT_GLASS: readonly (readonly [number, number, number, number])[] = [
  [143, BANK_Y - 7.2, 205, BANK_Y - 3.8],
  [211.4, BANK_Y - 36.6, 224.6, BANK_Y - 32],
];
/** Where the plane parks (its main gear, local units): on the apron just past the threshold. */
export const AIRPORT_PLANE: Pt = [178, BANK_Y - 1.2];
/** The windsock's mast foot (local units), by the runway's far end. */
export const AIRPORT_WINDSOCK: Pt = [7, BANK_Y - 1];

/** Tea-garden shade tree (tall, thin, umbrella crowns), base at (0, 0). */
export function shadeTree(seed: number): Shape {
  const r = mulberry32(seed);
  const h = 18 + r() * 14;
  const w = 9 + r() * 8;
  const lean = (r() - 0.5) * 2;
  let fill = `M${f(lean - w / 2)} ${f(-h)}Q${f(lean)} ${f(-h - 3.6)} ${f(lean + w / 2)} ${f(-h)}Q${f(lean)} ${f(-h + 1.4)} ${f(lean - w / 2)} ${f(-h)}Z`;
  if (r() < 0.6) {
    const w2 = w * 0.6;
    const y2 = -h + 4 + r() * 2;
    fill += `M${f(lean * 0.7 - w2 / 2)} ${f(y2)}Q${f(lean * 0.7)} ${f(y2 - 2.4)} ${f(lean * 0.7 + w2 / 2)} ${f(y2)}Q${f(lean * 0.7)} ${f(y2 + 1)} ${f(lean * 0.7 - w2 / 2)} ${f(y2)}Z`;
  }
  return {
    fill,
    stroke: [{ d: `M0 0Q${f(lean * 0.3)} ${f(-h / 2)} ${f(lean)} ${f(-h + 0.6)}`, width: 0.8 }],
    x0: -w / 2 - 2,
    x1: w / 2 + 2,
  };
}

/** A riverside tree (rounded crown) or a low house with a gable, base at (0, BANK_Y). */
export function bankThing(seed: number): Shape {
  const r = mulberry32(seed);
  if (r() < 0.6) {
    const rad = 3 + r() * 3;
    const cy = BANK_Y - 4 - rad;
    return {
      fill:
        circle(0, cy, rad) +
        circle(rad * 0.7, cy + 1.5, rad * 0.7) +
        rect(-0.5, cy, 1, BANK_Y - cy),
      x0: -rad,
      x1: rad * 1.7,
    };
  }
  const w = 6 + r() * 6;
  const h = 4 + r() * 3;
  return {
    fill: `M0 ${BANK_Y}V${f(BANK_Y - h)}L${f(w / 2)} ${f(BANK_Y - h - 3)}L${f(w)} ${f(BANK_Y - h)}V${BANK_Y}Z`,
    x0: 0,
    x1: w,
  };
}

/** Near foreground (L4), base at (0, NEAR_Y): palm, bamboo clump, lamp post, low wall or a parked rickshaw. */
export type NearKind = "palm" | "bamboo" | "lamp" | "wall" | "rickshaw";

export function palm(seed: number): Shape {
  const r = mulberry32(seed);
  const h = 55 + r() * 30;
  const lean = (r() - 0.4) * 14;
  const top: Pt = [lean, NEAR_Y - h];
  let fill = "";
  const n = 7;
  for (let i = 0; i < n; i++) {
    const a = Math.PI * (1.05 + (0.9 * i) / (n - 1)) + (r() - 0.5) * 0.2;
    const L = 13 + r() * 7;
    const droop = 5 + r() * 5;
    const tip: Pt = [top[0] + Math.cos(a) * L, top[1] + Math.sin(a) * L * 0.55 + droop];
    const mid: Pt = [top[0] + Math.cos(a) * L * 0.55, top[1] + Math.sin(a) * L * 0.55 - 2];
    const nx = -Math.sin(a) * 1.6;
    const ny = Math.cos(a) * 1.6;
    fill += `M${f(top[0])} ${f(top[1])}Q${f(mid[0] + nx)} ${f(mid[1] + ny)} ${f(tip[0])} ${f(tip[1])}Q${f(mid[0] - nx)} ${f(mid[1] - ny)} ${f(top[0])} ${f(top[1])}Z`;
  }
  fill += circle(top[0], top[1] + 1.5, 1.8);
  return {
    fill,
    stroke: [
      {
        d: `M0 ${NEAR_Y}Q${f(lean * 0.15)} ${f(NEAR_Y - h * 0.5)} ${f(top[0])} ${f(top[1])}`,
        width: 2.2,
      },
    ],
    x0: -24 + lean,
    x1: 24 + lean,
  };
}

export function bamboo(seed: number): Shape {
  const r = mulberry32(seed);
  const strokes: string[] = [];
  let fill = "";
  const n = 6 + Math.floor(r() * 4);
  for (let i = 0; i < n; i++) {
    const bx = (r() - 0.5) * 8;
    const h = 40 + r() * 35;
    const bend = (r() - 0.5) * 22;
    const tip: Pt = [bx + bend, NEAR_Y - h];
    strokes.push(
      `M${f(bx)} ${NEAR_Y}Q${f(bx + bend * 0.2)} ${f(NEAR_Y - h * 0.6)} ${f(tip[0])} ${f(tip[1])}`,
    );
    for (let k = 0; k < 4; k++) {
      const t = 0.55 + k * 0.13;
      const lx = bx + bend * t * t;
      const ly = NEAR_Y - h * t;
      const s = r() < 0.5 ? -1 : 1;
      fill += `M${f(lx)} ${f(ly)}q${f(s * 3)} ${f(-1.5)} ${f(s * 6)} ${f(0.6)}q${f(-s * 3)} ${f(0.2)} ${f(-s * 6)} ${f(-0.6)}Z`;
    }
  }
  return { fill, stroke: [{ d: strokes.join(""), width: 0.9 }], x0: -22, x1: 22 };
}

export function lampPost(): Shape {
  return {
    fill: `M5.2 ${NEAR_Y - 46.5}h4.6l-0.8 2h-3Z` + rect(-1.6, NEAR_Y - 3, 3.2, 3),
    stroke: [
      { d: `M0 ${NEAR_Y}V${NEAR_Y - 44}Q0 ${NEAR_Y - 47} 4 ${NEAR_Y - 47}H7.5`, width: 1.1 },
    ],
    lights: [{ at: [7.5, NEAR_Y - 43.8], kind: "lamp" }],
    x0: -2,
    x1: 10,
  };
}

export function lowWall(width: number): Shape {
  let fill = rect(0, NEAR_Y - 9, width, 9);
  for (let x = 0; x <= width; x += 22)
    fill += rect(x - 1.5, NEAR_Y - 12, 3, 12) + rect(x - 2.2, NEAR_Y - 12.8, 4.4, 1);
  return { fill, x0: -2.2, x1: width + 2.2 };
}

/**
 * A cycle rickshaw in side view, facing right: big rear wheel under the passenger seat and its folding hood, the
 * rider's frame and handlebar to a smaller front wheel. `spokes` (radians) turns the wheels. Base at (0, 0).
 */
export function rickshaw(spokes = 0): Shape {
  const wheel = (cx: number, r: number) => {
    let d = circle(cx, -r, r);
    for (let k = 0; k < 3; k++) {
      const a = spokes + (k * Math.PI) / 3;
      d += line(
        [cx - Math.cos(a) * r * 0.92, -r - Math.sin(a) * r * 0.92],
        [cx + Math.cos(a) * r * 0.92, -r + Math.sin(a) * r * 0.92],
      );
    }
    return d;
  };
  const strokes =
    wheel(0, 5.6) +
    wheel(21, 4.4) +
    // Frame: rear axle → crank → saddle post; down tube to the front fork; handlebar.
    line([0, -5.6], [12, -6]) +
    line([12, -6], [14.5, -12.5]) +
    line([12, -6], [21, -4.4]) +
    line([21, -4.4], [19.6, -14]) +
    line([18, -14], [21.4, -14.4]);
  const fill =
    // Passenger seat over the rear wheel, the hood (folded half up) behind it, the rider's saddle, a footboard.
    rect(-4.6, -13.6, 9.6, 3.4) +
    rect(-4.6, -10.4, 1.2, 4.2) +
    "M-5.6 -13.6C-6.6 -21 -3 -26 3.8 -25.4L5.2 -23.6C0.6 -23.4 -2 -20 -2.4 -13.6Z" +
    rect(13, -13.4, 3.6, 1.1) +
    rect(4.6, -7.2, 6, 1);
  return { fill, stroke: [{ d: strokes, width: 0.7 }], x0: -8, x1: 26 };
}
