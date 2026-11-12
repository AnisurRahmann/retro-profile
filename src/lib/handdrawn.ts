/**
 * Deterministic "marked by hand" geometry for redlines.
 * Seeded, so server and client render identical paths (no hydration mismatch).
 */

function rng(seed: number): () => number {
  let a = (seed * 2654435761) >>> 0 || 1;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const r2 = (n: number) => Math.round(n * 100) / 100;

type Pt = readonly [number, number];

/** Catmull-Rom through points, emitted as cubic beziers. */
function smooth(points: Pt[]): string {
  const first = points[0];
  if (!first) return "";
  let d = `M${r2(first[0])} ${r2(first[1])}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)] as Pt;
    const p1 = points[i] as Pt;
    const p2 = points[i + 1] as Pt;
    const p3 = points[Math.min(points.length - 1, i + 2)] as Pt;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += `C${r2(c1x)} ${r2(c1y)} ${r2(c2x)} ${r2(c2y)} ${r2(p2[0])} ${r2(p2[1])}`;
  }
  return d;
}

/** An ellipse drawn in one quick stroke: slightly irregular and it overshoots its start. */
export function wobblyEllipse(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  seed: number,
): string {
  const rand = rng(seed);
  const n = 16;
  const start = -2.5 + rand() * 0.6;
  const turns = 1.08 + rand() * 0.05;
  const pts: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const k = i / n;
    const a = start + k * Math.PI * 2 * turns;
    const drift = 1 - 0.07 * k;
    const j = 1 + (rand() - 0.5) * 0.09;
    pts.push([cx + Math.cos(a) * rx * drift * j, cy + Math.sin(a) * ry * drift * j]);
  }
  return smooth(pts);
}

/** A straight-ish stroke with a slight bow, like a line pulled without a ruler. */
export function wobblyLine(x1: number, y1: number, x2: number, y2: number, seed: number): string {
  const rand = rng(seed);
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const bow = (rand() - 0.5) * len * 0.12;
  const pts: Pt[] = [0, 0.33, 0.66, 1].map((k) => {
    const w = Math.sin(k * Math.PI) * bow + (rand() - 0.5) * 1.2;
    return [x1 + dx * k + nx * w, y1 + dy * k + ny * w] as const;
  });
  return smooth(pts);
}

/** Open two-stroke arrowhead at (x, y) pointing along `angle` (radians). */
export function arrowHead(x: number, y: number, angle: number, size: number, seed: number): string {
  const rand = rng(seed);
  const spread = 0.48 + (rand() - 0.5) * 0.12;
  const a1 = angle + Math.PI - spread;
  const a2 = angle + Math.PI + spread;
  const l1 = size * (0.92 + rand() * 0.2);
  const l2 = size * (0.92 + rand() * 0.2);
  return `M${r2(x + Math.cos(a1) * l1)} ${r2(y + Math.sin(a1) * l1)}L${r2(x)} ${r2(y)}L${r2(x + Math.cos(a2) * l2)} ${r2(y + Math.sin(a2) * l2)}`;
}

/** Small stable hash so components can seed from an id string. */
export function seedFrom(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 100000;
}
