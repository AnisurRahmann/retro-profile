import { OUTLINE, PALETTE_NAMES, type Layer, type PaletteName } from "./types";

/** A tracer turns a binary mask (1 is ink) into SVG path data in mask pixel units, absolute M, L, C and Z only. */
export type Tracer = (mask: Uint8Array, width: number, height: number) => Promise<string>;

export interface TraceOptions {
  /** fills smaller than this many mask pixels are left to the layer below */
  minArea: number;
  /** how far (mask pixels) a fill grows under the fills stacked above it, so no seam shows between them */
  overlap: number;
}

export const TRACE_DEFAULTS: TraceOptions = { minArea: 150, overlap: 3 };

/**
 * Plans the stacked layers for a class map: the whole silhouette first, in the outline colour,
 * then every other colour from the largest area to the smallest. Outline pixels are never traced on their own:
 * they are what shows of the silhouette between the fills. Pure, the masks go to a tracer afterwards.
 */
export function planLayers(classes: Uint8Array, width: number, height: number, options: Partial<TraceOptions> = {}): { cls: PaletteName; mask: Uint8Array }[] {
  const { minArea, overlap } = { ...TRACE_DEFAULTS, ...options };
  const outline = PALETTE_NAMES.indexOf(OUTLINE) + 1;
  const areas = new Array<number>(PALETTE_NAMES.length + 1).fill(0);
  const silhouette = new Uint8Array(classes.length);
  for (let i = 0; i < classes.length; i += 1) {
    const value = classes[i]!;
    if (value === 0) continue;
    silhouette[i] = 1;
    areas[value]! += 1;
  }
  const layers: { cls: PaletteName; mask: Uint8Array }[] = [{ cls: OUTLINE, mask: silhouette }];
  const order = areas
    .map((area, value) => ({ area, value }))
    .filter(({ area, value }) => value !== 0 && value !== outline && area >= minArea)
    .sort((a, b) => b.area - a.area);
  order.forEach(({ value }, position) => {
    const above = new Set(order.slice(position + 1).map((entry) => entry.value));
    const mask = new Uint8Array(classes.length);
    for (let i = 0; i < classes.length; i += 1) if (classes[i] === value) mask[i] = 1;
    // grow under the fills that are drawn later
    for (let step = 0; step < overlap && above.size > 0; step += 1) {
      const grown: number[] = [];
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const i = y * width + x;
          if (mask[i] || !above.has(classes[i]!)) continue;
          if ((x > 0 && mask[i - 1]) || (x < width - 1 && mask[i + 1]) || (y > 0 && mask[i - width]) || (y < height - 1 && mask[i + width])) grown.push(i);
        }
      }
      for (const i of grown) mask[i] = 1;
    }
    layers.push({ cls: PALETTE_NAMES[value - 1]!, mask });
  });
  return layers;
}

/** Stage d. Vectorises the planned layers. The outline silhouette is the first path, under every fill. */
export async function trace(classes: Uint8Array, width: number, height: number, tracer: Tracer, options: Partial<TraceOptions> = {}): Promise<Layer[]> {
  const layers: Layer[] = [];
  for (const { cls, mask } of planLayers(classes, width, height, options)) {
    const d = await tracer(mask, width, height);
    if (d) layers.push({ cls, d });
  }
  return layers;
}

const NUMBER = /-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi;

/** Maps absolute path data through x' = (x + tx) * scale. Throws on commands a tracer should never emit. */
export function transformPath(d: string, scale: number, tx = 0, ty = 0): string {
  const bad = d.replace(NUMBER, "").match(/[^MLCZ\s,]/);
  if (bad) throw new Error(`transformPath: unsupported path command "${bad[0]}"`);
  let axis = 0;
  return d
    .replace(/[MLCZ]/g, (command) => {
      return ` ${command} `;
    })
    .split(/\s+|,/)
    .filter(Boolean)
    .map((token) => {
      if (/^[MLCZ]$/.test(token)) {
        axis = 0;
        return token;
      }
      const value = (Number(token) + (axis % 2 === 0 ? tx : ty)) * scale;
      axis += 1;
      return String(Math.round(value * 100) / 100);
    })
    .join(" ");
}

/** Number of drawing commands in a path: the node count used to compare tracers. */
export function countNodes(d: string): number {
  return (d.match(/[MLCQSTAHV]/gi) ?? []).length;
}
