import type { BusId, Project } from "@/content.schema";
import { wirePairs } from "./derive";

/**
 * Pure layout for the system map (FIG. 2).
 *
 * Six horizontal bus rails. Each node hangs under its rail from a stub with a
 * junction dot. Wires leave from the bottom edge of a node and run in lanes
 * below the node row, so a wire can never pass through a node. Wires between
 * rows use a vertical channel in the gutter left of the rails.
 * Routing is orthogonal only and the output is deterministic.
 */

export const MAP = {
  width: 1280,
  labelW: 150,
  gutter: 28,
  slot: 136,
  nodeW: 122,
  nodeH: 62,
  railPad: 20,
  noteGap: 30,
  laneFirst: 12,
  laneGap: 9,
  rowPad: 16,
  stubInset: 14,
  bottomPad: 8,
} as const;

export type Pt = readonly [number, number];

export type MapNode = {
  id: string;
  bus: BusId;
  row: number;
  col: number;
  x: number;
  y: number;
  w: number;
  h: number;
  stubX: number;
  railY: number;
  /** Ids this node is wired to. */
  near: string[];
};

export type MapRow = {
  bus: BusId;
  y: number;
  height: number;
  railY: number;
  railX0: number;
  railX1: number;
};

export type MapWire = { a: string; b: string; points: Pt[] };

export type MapLayout = {
  width: number;
  height: number;
  rows: MapRow[];
  nodes: MapNode[];
  wires: MapWire[];
  /** Every wire turn that sits on another wire or a port, drawn as a dot. */
  junctions: Pt[];
};

type LayoutProject = Pick<Project, "id" | "bus" | "connectsTo">;

type End = { wire: number; node: string; lane: number; dir: "left" | "right" };

export function layoutMap(
  projects: readonly LayoutProject[],
  busOrder: readonly BusId[],
): MapLayout {
  const pairs = wirePairs(projects);
  const rowOf = new Map<string, number>();
  const colOf = new Map<string, number>();
  busOrder.forEach((bus, row) => {
    projects
      .filter((p) => p.bus === bus)
      .forEach((p, col) => {
        rowOf.set(p.id, row);
        colOf.set(p.id, col);
      });
  });

  // 1. Lanes. Each row gets intervals (in column units); -1 is the gutter channel.
  type Interval = { wire: number; lo: number; hi: number; lane: number };
  const rowIntervals: Interval[][] = busOrder.map(() => []);
  pairs.forEach((pair, wire) => {
    const ra = rowOf.get(pair.a) as number;
    const rb = rowOf.get(pair.b) as number;
    const ca = colOf.get(pair.a) as number;
    const cb = colOf.get(pair.b) as number;
    if (ra === rb) {
      rowIntervals[ra]?.push({ wire, lo: Math.min(ca, cb), hi: Math.max(ca, cb), lane: -1 });
    } else {
      rowIntervals[ra]?.push({ wire, lo: -1, hi: ca, lane: -1 });
      rowIntervals[rb]?.push({ wire, lo: -1, hi: cb, lane: -1 });
    }
  });
  const laneOf = new Map<string, number>(); // `${row}:${wire}` -> lane
  const laneCount = rowIntervals.map((list, row) => {
    const sorted = [...list].sort((p, q) => p.hi - p.lo - (q.hi - q.lo) || p.wire - q.wire);
    let max = 0;
    for (const iv of sorted) {
      let lane = 0;
      while (sorted.some((o) => o.lane === lane && o.lo <= iv.hi && iv.lo <= o.hi)) lane++;
      iv.lane = lane;
      laneOf.set(`${row}:${iv.wire}`, lane);
      max = Math.max(max, lane + 1);
    }
    return max;
  });

  // 2. Rows and nodes.
  const x0 = MAP.labelW + MAP.gutter;
  const rows: MapRow[] = [];
  let y = 0;
  busOrder.forEach((bus, row) => {
    const lanes = laneCount[row] ?? 0;
    const lanesH = lanes > 0 ? MAP.laneFirst + (lanes - 1) * MAP.laneGap : 0;
    const height = MAP.railPad + MAP.noteGap + MAP.nodeH + lanesH + MAP.rowPad;
    rows.push({ bus, y, height, railY: y + MAP.railPad, railX0: x0 - 6, railX1: MAP.width - 10 });
    y += height;
  });

  const nodes: MapNode[] = projects.map((p) => {
    const row = rowOf.get(p.id) as number;
    const col = colOf.get(p.id) as number;
    const r = rows[row] as MapRow;
    const x = x0 + col * MAP.slot;
    return {
      id: p.id,
      bus: p.bus,
      row,
      col,
      x,
      y: r.railY + MAP.noteGap,
      w: MAP.nodeW,
      h: MAP.nodeH,
      stubX: x + MAP.stubInset,
      railY: r.railY,
      near: [...p.connectsTo].sort(),
    };
  });
  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  // 3. Ports. Order the wire ends on each node's bottom edge so nested lanes do not cross.
  const ends: End[] = [];
  pairs.forEach((pair, wire) => {
    const a = nodeById.get(pair.a) as MapNode;
    const b = nodeById.get(pair.b) as MapNode;
    if (a.row === b.row) {
      const lane = laneOf.get(`${a.row}:${wire}`) as number;
      const aLeft = a.col < b.col;
      ends.push({ wire, node: a.id, lane, dir: aLeft ? "right" : "left" });
      ends.push({ wire, node: b.id, lane, dir: aLeft ? "left" : "right" });
    } else {
      ends.push({ wire, node: a.id, lane: laneOf.get(`${a.row}:${wire}`) as number, dir: "left" });
      ends.push({ wire, node: b.id, lane: laneOf.get(`${b.row}:${wire}`) as number, dir: "left" });
    }
  });
  const portX = new Map<string, number>(); // `${node}:${wire}` -> x
  for (const node of nodes) {
    const mine = ends.filter((e) => e.node === node.id);
    const left = mine
      .filter((e) => e.dir === "left")
      .sort((p, q) => p.lane - q.lane || p.wire - q.wire);
    const right = mine
      .filter((e) => e.dir === "right")
      .sort((p, q) => q.lane - p.lane || p.wire - q.wire);
    const ordered = [...left, ...right];
    ordered.forEach((e, i) => {
      portX.set(
        `${node.id}:${e.wire}`,
        Math.round(node.x + (node.w * (i + 1)) / (ordered.length + 1)),
      );
    });
  }

  // 4. Wires.
  const laneY = (node: MapNode, wire: number) =>
    node.y + node.h + MAP.laneFirst + (laneOf.get(`${node.row}:${wire}`) as number) * MAP.laneGap;
  let channel = 0;
  const wires: MapWire[] = pairs.map((pair, wire) => {
    const a = nodeById.get(pair.a) as MapNode;
    const b = nodeById.get(pair.b) as MapNode;
    const ax = portX.get(`${a.id}:${wire}`) as number;
    const bx = portX.get(`${b.id}:${wire}`) as number;
    const ay = laneY(a, wire);
    const by = laneY(b, wire);
    if (a.row === b.row) {
      return {
        ...pair,
        points: [
          [ax, a.y + a.h],
          [ax, ay],
          [bx, ay],
          [bx, b.y + b.h],
        ],
      };
    }
    const cx = MAP.labelW + 8 + channel * 7;
    channel += 1;
    return {
      ...pair,
      points: [
        [ax, a.y + a.h],
        [ax, ay],
        [cx, ay],
        [cx, by],
        [bx, by],
        [bx, b.y + b.h],
      ],
    };
  });

  const junctions: Pt[] = wires.flatMap((w) => [
    w.points[0] as Pt,
    w.points[w.points.length - 1] as Pt,
  ]);

  return { width: MAP.width, height: y + MAP.bottomPad, rows, nodes, wires, junctions };
}

/** Wrap a node name into at most `maxLines` lines of about `maxChars` characters. */
export function wrapLabel(name: string, maxChars = 17, maxLines = 3): string[] {
  const words = name.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  if (lines.length <= maxLines) return lines;
  const head = lines.slice(0, maxLines - 1);
  return [...head, lines.slice(maxLines - 1).join(" ")];
}

/** True when the segment p-q passes through the interior of the rectangle. */
export function segmentCrossesRect(
  p: Pt,
  q: Pt,
  r: { x: number; y: number; w: number; h: number },
): boolean {
  const eps = 0.5;
  const left = r.x + eps;
  const right = r.x + r.w - eps;
  const top = r.y + eps;
  const bottom = r.y + r.h - eps;
  const minX = Math.min(p[0], q[0]);
  const maxX = Math.max(p[0], q[0]);
  const minY = Math.min(p[1], q[1]);
  const maxY = Math.max(p[1], q[1]);
  return minX < right && maxX > left && minY < bottom && maxY > top;
}
