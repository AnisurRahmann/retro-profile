import { ciede2000, hexToRgb, rgbToHex, rgbToLab, type Lab } from "./color";
import { PALETTE, PALETTE_NAMES, type PaletteName, type Raster } from "./types";

const PALETTE_LAB: Lab[] = PALETTE_NAMES.map((name) => rgbToLab(hexToRgb(PALETTE[name])));

export interface Snapped {
  cls: PaletteName;
  /** CIEDE2000 distance to that palette colour */
  distance: number;
}

/** Nearest palette colour by CIEDE2000. */
export function snapColour(r: number, g: number, b: number): Snapped {
  const lab = rgbToLab([r, g, b]);
  let best = 0;
  let distance = Infinity;
  PALETTE_LAB.forEach((entry, index) => {
    const d = ciede2000(lab, entry);
    if (d < distance) {
      distance = d;
      best = index;
    }
  });
  return { cls: PALETTE_NAMES[best]!, distance };
}

export interface FarRegion {
  /** mean colour of the region */
  colour: string;
  /** the palette class it was snapped to anyway */
  cls: PaletteName;
  distance: number;
  /** share of the part's opaque area */
  share: number;
}

export interface SnapOptions {
  /** CIEDE2000 distance beyond which a pixel counts as off-palette */
  farDistance: number;
  /** off-palette pixels are reported once they cover this share of the part */
  farShare: number;
  /** passes of the 3 x 3 majority filter that removes compression noise from the class map */
  smoothPasses: number;
  /** a colour must keep this many pixels after a 2 pixel erosion, or it is a rim of blended edge pixels and is dissolved */
  minCore: number;
}

export const SNAP_DEFAULTS: SnapOptions = { farDistance: 22, farShare: 0.004, smoothPasses: 2, minCore: 60 };

export interface SnapResult {
  /** per pixel: 0 transparent, otherwise 1 + index into PALETTE_NAMES */
  classes: Uint8Array;
  far: FarRegion[];
}

/**
 * Stage e. Maps every opaque pixel to its nearest palette colour and reports what does not belong.
 * It runs on pixels, before the geometry is traced, so regions that land on the same colour merge for real
 * (one region, one path) instead of being concatenated afterwards. See docs/DECISIONS.md.
 */
export function snap(image: Raster, options: Partial<SnapOptions> = {}): SnapResult {
  const { farDistance, farShare, smoothPasses, minCore } = { ...SNAP_DEFAULTS, ...options };
  const { width, height, data } = image;
  const total = width * height;
  let classes = new Uint8Array(total);
  const cache = new Map<number, Snapped>();
  // off-palette pixels, bucketed by the class they fall to: sums for the mean colour
  const far = PALETTE_NAMES.map(() => ({ n: 0, r: 0, g: 0, b: 0, d: 0 }));
  const isFar = new Uint8Array(total);
  let opaque = 0;
  for (let i = 0; i < total; i += 1) {
    if (data[i * 4 + 3]! < 128) continue;
    opaque += 1;
    const r = data[i * 4]!;
    const g = data[i * 4 + 1]!;
    const b = data[i * 4 + 2]!;
    const cacheKey = ((r >> 2) << 12) | ((g >> 2) << 6) | (b >> 2);
    let hit = cache.get(cacheKey);
    if (!hit) {
      hit = snapColour(r, g, b);
      cache.set(cacheKey, hit);
    }
    const index = PALETTE_NAMES.indexOf(hit.cls);
    classes[i] = index + 1;
    if (hit.distance > farDistance) isFar[i] = 1;
  }

  // an off-palette pixel only counts when its whole 5 x 5 neighbourhood is off-palette too:
  // anti-aliased rims between a fill and the outline are blends, not foreign colours
  for (let y = 2; y < height - 2; y += 1) {
    for (let x = 2; x < width - 2; x += 1) {
      const i = y * width + x;
      if (!isFar[i]) continue;
      let solid = true;
      for (let dy = -2; dy <= 2 && solid; dy += 1) for (let dx = -2; dx <= 2 && solid; dx += 1) solid = isFar[i + dy * width + dx] === 1;
      if (!solid) continue;
      const bucket = far[classes[i]! - 1]!;
      bucket.n += 1;
      bucket.r += data[i * 4]!;
      bucket.g += data[i * 4 + 1]!;
      bucket.b += data[i * 4 + 2]!;
    }
  }

  for (let pass = 0; pass < smoothPasses; pass += 1) classes = majority(classes, width, height);
  // a colour needs a solid core of its own: a fixed floor, or a thousandth of the part on large parts
  dissolveRims(classes, width, height, Math.max(minCore, opaque * 0.001));

  const report: FarRegion[] = [];
  far.forEach((bucket, index) => {
    if (opaque === 0 || bucket.n / opaque < farShare) return;
    const mean = [bucket.r / bucket.n, bucket.g / bucket.n, bucket.b / bucket.n] as const;
    report.push({
      colour: rgbToHex(mean),
      cls: PALETTE_NAMES[index]!,
      distance: Math.round(snapColour(mean[0], mean[1], mean[2]).distance * 10) / 10,
      share: Math.round((bucket.n / opaque) * 1000) / 1000,
    });
  });
  return { classes, far: report };
}

/** 3 x 3 majority filter over opaque pixels. Transparent pixels stay transparent. */
function majority(classes: Uint8Array, width: number, height: number): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(classes.length);
  const counts = new Uint8Array(PALETTE_NAMES.length + 1);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = y * width + x;
      const own = classes[i]!;
      if (own === 0) continue;
      counts.fill(0);
      for (let dy = -1; dy <= 1; dy += 1) {
        const ny = y + dy;
        if (ny < 0 || ny >= height) continue;
        for (let dx = -1; dx <= 1; dx += 1) {
          const nx = x + dx;
          if (nx < 0 || nx >= width) continue;
          counts[classes[ny * width + nx]!]! += 1;
        }
      }
      let best = own;
      for (let c = 1; c < counts.length; c += 1) if (counts[c]! > counts[best]!) best = c;
      out[i] = best;
    }
  }
  return out;
}

/**
 * Blends along an edge (dark red between a red fill and the outline) can land on a third palette colour.
 * Such a colour has no solid core: it disappears under erosion. Its pixels are handed to the neighbouring colours.
 */
function dissolveRims(classes: Uint8Array, width: number, height: number, minCore: number): void {
  const core = new Array<number>(PALETTE_NAMES.length + 1).fill(0);
  const present = new Array<number>(PALETTE_NAMES.length + 1).fill(0);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const own = classes[y * width + x]!;
      if (own === 0) continue;
      present[own]! += 1;
      if (x < 2 || y < 2 || x >= width - 2 || y >= height - 2) continue;
      let solid = true;
      for (let dy = -2; dy <= 2 && solid; dy += 1) for (let dx = -2; dx <= 2 && solid; dx += 1) solid = classes[(y + dy) * width + x + dx] === own;
      if (solid) core[own]! += 1;
    }
  }
  const weak = new Set<number>();
  present.forEach((count, value) => {
    if (value !== 0 && count > 0 && core[value]! < minCore) weak.add(value);
  });
  if (weak.size === 0 || weak.size === present.filter((count) => count > 0).length) return;
  // grow the solid colours into the weak pixels, one ring at a time
  for (let guard = 0; guard < width + height; guard += 1) {
    const changes: [number, number][] = [];
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const i = y * width + x;
        if (!weak.has(classes[i]!)) continue;
        const around = [x > 0 ? classes[i - 1]! : 0, x < width - 1 ? classes[i + 1]! : 0, y > 0 ? classes[i - width]! : 0, y < height - 1 ? classes[i + width]! : 0];
        const donor = around.find((value) => value !== 0 && !weak.has(value));
        if (donor) changes.push([i, donor]);
      }
    }
    if (changes.length === 0) break;
    for (const [i, value] of changes) classes[i] = value;
  }
}
