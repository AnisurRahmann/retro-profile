import { hexToRgb, rgbToLab } from "./color";
import { KEY_COLOUR, PALETTE, type Raster } from "./types";

export interface KeyOptions {
  /** distance to the key colour at and below which a pixel is fully background */
  lo: number;
  /** distance at and above which a pixel is fully foreground */
  hi: number;
  /** allowed share of background on the canvas */
  minBackground: number;
  maxBackground: number;
}

export const KEY_DEFAULTS: KeyOptions = { lo: 28, hi: 60, minBackground: 0.2, maxBackground: 0.9 };

export interface KeyResult {
  image: Raster;
  /** share of the canvas classified as background (alpha below one half) */
  background: number;
}

const KEY_LAB = rgbToLab(hexToRgb(KEY_COLOUR));
const KEY_RGB = hexToRgb(KEY_COLOUR);
const OUTLINE_RGB = hexToRgb(PALETTE.iron);

/**
 * Distance to the key colour in CIELAB with lightness at half weight: Gemini sometimes paints a darker
 * magenta ground shadow, which is still background, while a real colour differs in a and b.
 */
export function keyDistance(r: number, g: number, b: number): number {
  const [l, a, bb] = rgbToLab([r, g, b]);
  return Math.hypot((l - KEY_LAB[0]) * 0.5, a - KEY_LAB[1], bb - KEY_LAB[2]);
}

/**
 * Stage a. Removes the magenta background: builds a soft alpha matte from the distance band,
 * then despills the semi-transparent edge pixels by unmixing the key and pulling them to the outline colour.
 * Throws when the background share is implausible (wrong file, or a sheet with no flat key).
 */
export function key(source: Raster, options: Partial<KeyOptions> = {}): KeyResult {
  const { lo, hi, minBackground, maxBackground } = { ...KEY_DEFAULTS, ...options };
  const { width, height, data } = source;
  const out = new Uint8Array(data.length);
  let background = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    const alpha = Math.min(1, Math.max(0, (keyDistance(r, g, b) - lo) / (hi - lo)));
    if (alpha < 0.5) background += 1;
    if (alpha === 0) continue;
    if (alpha === 1) {
      out[i] = r;
      out[i + 1] = g;
      out[i + 2] = b;
      out[i + 3] = 255;
      continue;
    }
    const pixel = [r, g, b] as const;
    for (let c = 0; c < 3; c += 1) {
      const unmixed = Math.min(255, Math.max(0, (pixel[c]! - (1 - alpha) * KEY_RGB[c]!) / alpha));
      out[i + c] = Math.round(OUTLINE_RGB[c]! * (1 - alpha) + unmixed * alpha);
    }
    out[i + 3] = Math.round(alpha * 255);
  }
  const share = background / (width * height);
  if (share < minBackground || share > maxBackground) {
    throw new Error(
      `key: ${(share * 100).toFixed(1)}% of the canvas is background, expected ${minBackground * 100}% to ${maxBackground * 100}%. ` +
        `The sheet is probably not on flat ${KEY_COLOUR}.`,
    );
  }
  return { image: { width, height, data: out }, background: share };
}
