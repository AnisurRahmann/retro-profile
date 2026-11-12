import { describe, expect, it } from "vitest";
import { buses, projects } from "@/content";
import { wirePairs } from "@/lib/derive";
import { wobblyEllipse } from "@/lib/handdrawn";
import { layoutMap, segmentCrossesRect, wrapLabel } from "@/lib/mapLayout";
import { staticTracePath, yAt } from "@/lib/trace";

const order = buses.map((b) => b.id);
const layout = layoutMap(projects, order);

describe("system map layout", () => {
  it("is deterministic", () => {
    expect(layoutMap(projects, order)).toEqual(layout);
  });

  it("places every project exactly once", () => {
    expect(layout.nodes.map((n) => n.id).sort()).toEqual(projects.map((p) => p.id).sort());
  });

  it("has six bus rails", () => {
    expect(layout.rows.length).toBe(6);
  });

  it("keeps every node inside the viewBox", () => {
    for (const n of layout.nodes) {
      expect(n.x).toBeGreaterThanOrEqual(0);
      expect(n.y).toBeGreaterThanOrEqual(0);
      expect(n.x + n.w).toBeLessThanOrEqual(layout.width);
      expect(n.y + n.h).toBeLessThanOrEqual(layout.height);
    }
  });

  it("never overlaps two nodes", () => {
    for (const a of layout.nodes) {
      for (const b of layout.nodes) {
        if (a.id >= b.id) continue;
        const apart = a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;
        expect(apart, `${a.id} overlaps ${b.id}`).toBe(true);
      }
    }
  });

  it("hangs each node under its own rail", () => {
    for (const n of layout.nodes) {
      const row = layout.rows[n.row];
      expect(row?.bus).toBe(n.bus);
      expect(n.y).toBeGreaterThan(n.railY);
      expect(n.stubX).toBeGreaterThan(row?.railX0 ?? Infinity);
    }
  });

  it("draws one wire per connection, orthogonal only", () => {
    expect(layout.wires.length).toBe(wirePairs(projects).length);
    for (const w of layout.wires) {
      for (let i = 0; i < w.points.length - 1; i++) {
        const [x1, y1] = w.points[i] as [number, number];
        const [x2, y2] = w.points[i + 1] as [number, number];
        expect(x1 === x2 || y1 === y2, `${w.a}-${w.b} segment ${i}`).toBe(true);
      }
    }
  });

  it("never routes a wire through a node", () => {
    for (const w of layout.wires) {
      for (let i = 0; i < w.points.length - 1; i++) {
        for (const n of layout.nodes) {
          const p = w.points[i] as [number, number];
          const q = w.points[i + 1] as [number, number];
          expect(segmentCrossesRect(p, q, n), `${w.a}-${w.b} crosses ${n.id}`).toBe(false);
        }
      }
    }
  });

  it("never routes a wire across a bus rail", () => {
    for (const w of layout.wires) {
      for (let i = 0; i < w.points.length - 1; i++) {
        const [x1, y1] = w.points[i] as [number, number];
        const [x2, y2] = w.points[i + 1] as [number, number];
        if (x1 !== x2) continue;
        for (const row of layout.rows) {
          const crosses =
            Math.min(y1, y2) < row.railY && Math.max(y1, y2) > row.railY && x1 >= row.railX0;
          expect(crosses, `${w.a}-${w.b} crosses rail ${row.bus}`).toBe(false);
        }
      }
    }
  });

  it("starts and ends every wire on a node edge", () => {
    const byId = new Map(layout.nodes.map((n) => [n.id, n]));
    for (const w of layout.wires) {
      const a = byId.get(w.a);
      const b = byId.get(w.b);
      const first = w.points[0];
      const last = w.points[w.points.length - 1];
      expect(first?.[1]).toBe((a?.y ?? 0) + (a?.h ?? 0));
      expect(last?.[1]).toBe((b?.y ?? 0) + (b?.h ?? 0));
    }
  });

  it("wraps labels without losing words", () => {
    for (const p of projects) {
      const lines = wrapLabel(p.name);
      expect(lines.length).toBeLessThanOrEqual(3);
      expect(lines.join(" ")).toBe(p.name);
    }
  });
});

describe("deterministic drawing helpers", () => {
  it("draws the same hand-drawn path for the same seed", () => {
    expect(wobblyEllipse(50, 20, 40, 15, 7)).toBe(wobblyEllipse(50, 20, 40, 15, 7));
    expect(wobblyEllipse(50, 20, 40, 15, 7)).not.toBe(wobblyEllipse(50, 20, 40, 15, 8));
  });
  it("keeps the trace in range and flat after the verifier", () => {
    for (let u = 0; u <= 1; u += 0.001) {
      expect(Math.abs(yAt(u, 1.3, 1.4))).toBeLessThanOrEqual(1.2);
    }
    expect(yAt(0.95, 3, 1.4)).toBe(0);
    expect(staticTracePath(1200, 200)).toBe(staticTracePath(1200, 200));
  });
});
