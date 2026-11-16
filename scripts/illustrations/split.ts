import type { Box, Component, Raster } from "./types";

export interface SplitOptions {
  /** components smaller than this share of the canvas are dropped as specks */
  minShare: number;
  /** two components are in the same reading row when their centroids are closer than this share of the height */
  bandShare: number;
}

export const SPLIT_DEFAULTS: SplitOptions = { minShare: 0.0005, bandShare: 0.06 };

export interface SplitResult {
  /** per pixel: 0 for background and specks, otherwise the component label */
  labels: Int32Array;
  components: Component[];
  dropped: number;
}

/**
 * Stage b. Connected components on the binary matte (alpha of one half or more), 8-connectivity.
 * Components are returned in reading order: row bands by centroid y, then left to right.
 */
export function split(image: Raster, options: Partial<SplitOptions> = {}): SplitResult {
  const { minShare, bandShare } = { ...SPLIT_DEFAULTS, ...options };
  const { width, height, data } = image;
  const labels = new Int32Array(width * height);
  const stack: number[] = [];
  const found: Omit<Component, "index">[] = [];
  let next = 0;
  for (let start = 0; start < labels.length; start += 1) {
    if (labels[start] !== 0 || data[start * 4 + 3]! < 128) continue;
    next += 1;
    let area = 0;
    let sumX = 0;
    let sumY = 0;
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;
    labels[start] = next;
    stack.push(start);
    while (stack.length > 0) {
      const at = stack.pop()!;
      const x = at % width;
      const y = (at - x) / width;
      area += 1;
      sumX += x;
      sumY += y;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      for (let dy = -1; dy <= 1; dy += 1) {
        const ny = y + dy;
        if (ny < 0 || ny >= height) continue;
        for (let dx = -1; dx <= 1; dx += 1) {
          const nx = x + dx;
          if (nx < 0 || nx >= width) continue;
          const to = ny * width + nx;
          if (labels[to] !== 0 || data[to * 4 + 3]! < 128) continue;
          labels[to] = next;
          stack.push(to);
        }
      }
    }
    const box: Box = { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
    found.push({ label: next, box, area, cx: sumX / area, cy: sumY / area });
  }

  const minArea = minShare * width * height;
  const kept = found.filter((component) => component.area >= minArea);
  const keptLabels = new Set(kept.map((component) => component.label));
  for (let i = 0; i < labels.length; i += 1) if (!keptLabels.has(labels[i]!)) labels[i] = 0;

  // reading order: walk down by centroid y, a new band starts when the gap to the band's first row is too large
  const byY = [...kept].sort((a, b) => a.cy - b.cy);
  const bands: (typeof kept)[] = [];
  for (const component of byY) {
    const band = bands[bands.length - 1];
    if (band && component.cy - band[0]!.cy <= bandShare * height) band.push(component);
    else bands.push([component]);
  }
  const components = bands.flatMap((band) => band.sort((a, b) => a.cx - b.cx)).map((component, index) => ({ ...component, index }));
  return { labels, components, dropped: found.length - kept.length };
}

/** Cuts the listed components out of the keyed sheet into one raster, padded, everything else transparent. */
export function extract(image: Raster, labels: Int32Array, components: Component[], pad = 2): { raster: Raster; box: Box } {
  const wanted = new Set(components.map((component) => component.label));
  const x0 = Math.max(0, Math.min(...components.map((c) => c.box.x)) - pad);
  const y0 = Math.max(0, Math.min(...components.map((c) => c.box.y)) - pad);
  const x1 = Math.min(image.width, Math.max(...components.map((c) => c.box.x + c.box.w)) + pad);
  const y1 = Math.min(image.height, Math.max(...components.map((c) => c.box.y + c.box.h)) + pad);
  const w = x1 - x0;
  const h = y1 - y0;
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const from = (y + y0) * image.width + (x + x0);
      // soft edge pixels just outside the binary matte belong to the nearest wanted component
      let own = wanted.has(labels[from]!);
      if (!own && labels[from] === 0 && image.data[from * 4 + 3]! > 0) {
        for (let dy = -1; dy <= 1 && !own; dy += 1) {
          for (let dx = -1; dx <= 1 && !own; dx += 1) {
            const nx = x + x0 + dx;
            const ny = y + y0 + dy;
            if (nx < 0 || ny < 0 || nx >= image.width || ny >= image.height) continue;
            own = wanted.has(labels[ny * image.width + nx]!);
          }
        }
      }
      if (!own) continue;
      const to = (y * w + x) * 4;
      data[to] = image.data[from * 4]!;
      data[to + 1] = image.data[from * 4 + 1]!;
      data[to + 2] = image.data[from * 4 + 2]!;
      data[to + 3] = image.data[from * 4 + 3]!;
    }
  }
  return { raster: { width: w, height: h, data }, box: { x: x0, y: y0, w, h } };
}
