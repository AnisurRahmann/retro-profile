/**
 * Lossless image tools for the lab probes (T9): PNG decode and encode (8-bit, no interlace), exact crops, and a
 * box-filter resample onto the cloud target's texel grid. Node only (zlib), so there is no image dependency, and pure,
 * so the metrics built on it are unit-tested (tests/unit/vol-lab-metrics.test.ts).
 */
import { deflateSync, inflateSync } from "node:zlib";

/** 8-bit RGBA, row-major, 4 bytes per pixel. */
export type Raster = { width: number; height: number; data: Uint8Array };
/** One float channel, 0..1, row-major. */
export type Plane = { width: number; height: number; data: Float32Array };
/** Float RGB, 0..1, row-major, 3 values per pixel. */
export type FloatImage = { width: number; height: number; data: Float32Array };

// ─── Decode ────────────────────────────────────────────────────────────────────────────────────────────────────────

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
/** PNG colour type → samples per pixel. */
const SAMPLES: Record<number, number> = { 0: 1, 2: 3, 4: 2, 6: 4 };
/** The most pixels decodePng will allocate for: 2²⁶, an 8192×8192 frame (a lab shot is 2880×1800). */
const MAX_PIXELS = 1 << 26;

const u32 = (b: Uint8Array, o: number) => ((b[o]! << 24) | (b[o + 1]! << 16) | (b[o + 2]! << 8) | b[o + 3]!) >>> 0;

/** The PNG Paeth predictor on exact (not wrapped) byte arithmetic. */
const paeth = (a: number, b: number, c: number) => {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
};

/** Decodes a PNG into RGBA8 (8-bit, not interlaced: what browsers and encodePng write). Bytes are taken as stored. */
export function decodePng(buf: Uint8Array): Raster {
  if (buf.length < 8 || !SIGNATURE.every((s, i) => buf[i] === s)) throw new Error("not a PNG (bad signature)");
  let width = 0;
  let height = 0;
  let depth = 0;
  let colour = -1;
  let interlace = 0;
  const idat: Uint8Array[] = [];
  for (let o = 8; o + 12 <= buf.length; ) {
    const len = u32(buf, o);
    const type = String.fromCharCode(buf[o + 4]!, buf[o + 5]!, buf[o + 6]!, buf[o + 7]!);
    const data = buf.subarray(o + 8, o + 8 + len);
    if (type === "IHDR") {
      width = u32(data, 0);
      height = u32(data, 4);
      depth = data[8]!;
      colour = data[9]!;
      interlace = data[12]!;
    } else if (type === "IDAT") idat.push(data);
    o += len + 12;
    if (type === "IEND") break;
  }
  if (colour < 0) throw new Error("PNG without IHDR");
  if (depth !== 8 || interlace !== 0) throw new Error(`unsupported PNG: ${depth}-bit, interlace ${interlace}`);
  // The header is the file's word: don't let it ask for an absurd buffer (a 2880×1800 shot is 5 Mpx).
  if (!(width > 0 && height > 0) || width * height > MAX_PIXELS) throw new Error(`unsupported PNG size ${width}×${height}`);
  const samples = SAMPLES[colour];
  if (!samples) throw new Error(`unsupported PNG colour type ${colour}`);

  const stride = width * samples;
  const raw = inflateSync(Buffer.concat(idat));
  if (raw.length < (stride + 1) * height) throw new Error("truncated PNG data");
  const px = new Uint8Array(stride * height);
  for (let y = 0, pos = 0; y < height; y++) {
    const filter = raw[pos++]!;
    if (filter > 4) throw new Error(`unknown PNG filter ${filter}`);
    const row = px.subarray(y * stride, (y + 1) * stride);
    const prev = y ? px.subarray((y - 1) * stride, y * stride) : null;
    row.set(raw.subarray(pos, pos + stride));
    pos += stride;
    // Left to right, so row[i − samples] is already reconstructed; a write past 255 wraps, as the format wants.
    for (let i = 0; i < stride; i++) {
      const a = i >= samples ? row[i - samples]! : 0;
      const b = prev ? prev[i]! : 0;
      const c = prev && i >= samples ? prev[i - samples]! : 0;
      const v = row[i]!;
      row[i] = filter === 1 ? v + a : filter === 2 ? v + b : filter === 3 ? v + ((a + b) >> 1) : filter === 4 ? v + paeth(a, b, c) : v;
    }
  }
  if (samples === 4) return { width, height, data: px };
  const out = new Uint8Array(width * height * 4);
  for (let i = 0, j = 0; i < px.length; i += samples, j += 4) {
    const alpha = samples === 2 || samples === 4 ? px[i + samples - 1]! : 255;
    if (samples <= 2) {
      out[j] = out[j + 1] = out[j + 2] = px[i]!;
    } else {
      out[j] = px[i]!;
      out[j + 1] = px[i + 1]!;
      out[j + 2] = px[i + 2]!;
    }
    out[j + 3] = alpha;
  }
  return { width, height, data: out };
}

// ─── Encode ────────────────────────────────────────────────────────────────────────────────────────────────────────

const CRC = new Int32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb8_8320 ^ (c >>> 1) : c >>> 1;
  CRC[n] = c;
}
const crc32 = (b: Uint8Array) => {
  let c = ~0;
  for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]!) & 255]! ^ (c >>> 8);
  return ~c >>> 0;
};

function chunk(type: string, data: Uint8Array): Buffer {
  const out = Buffer.alloc(data.length + 12);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "latin1");
  out.set(data, 8);
  out.writeUInt32BE(crc32(out.subarray(4, data.length + 8)), data.length + 8);
  return out;
}

/** One scanline filtered with f (0 none, 1 sub, 2 up, 3 average, 4 paeth) against the row above. */
function filterLine(f: number, line: Uint8Array, prev: Uint8Array | null, bpp: number, out: Uint8Array): void {
  for (let i = 0; i < line.length; i++) {
    const a = i >= bpp ? line[i - bpp]! : 0;
    const b = prev ? prev[i]! : 0;
    const x = line[i]!;
    out[i] = f === 1 ? x - a : f === 2 ? x - b : f === 3 ? x - ((a + b) >> 1) : f === 4 ? x - paeth(a, b, prev && i >= bpp ? prev[i - bpp]! : 0) : x;
  }
}

/** Encodes RGBA8 as a PNG: 8-bit RGBA, no interlace, the per-row filter with the smallest sum of signed bytes. */
export function encodePng(img: Raster): Buffer {
  const { width, height } = img;
  const stride = width * 4;
  const lines = Buffer.alloc((stride + 1) * height);
  const trial = new Uint8Array(stride);
  for (let y = 0; y < height; y++) {
    const line = img.data.subarray(y * stride, (y + 1) * stride);
    const prev = y ? img.data.subarray((y - 1) * stride, y * stride) : null;
    let best = Infinity;
    for (let f = 0; f < 5; f++) {
      filterLine(f, line, prev, 4, trial);
      let cost = 0;
      for (let i = 0; i < stride; i++) cost += trial[i]! < 128 ? trial[i]! : 256 - trial[i]!;
      if (cost < best) {
        best = cost;
        lines[y * (stride + 1)] = f;
        lines.set(trial, y * (stride + 1) + 1);
      }
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from(SIGNATURE),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(lines, { level: 6 })),
    chunk("IEND", new Uint8Array(0)),
  ]);
}

// ─── Crops and channels ───────────────────────────────────────────────────────────────────────────────────────────

/** An exact copy of a rectangle of pixels (no scaling, no interpolation). */
export function crop(img: Raster, x: number, y: number, w: number, h: number): Raster {
  if (!Number.isInteger(x) || !Number.isInteger(y) || w <= 0 || h <= 0 || x < 0 || y < 0 || x + w > img.width || y + h > img.height) {
    throw new RangeError(`crop ${w}×${h} at (${x}, ${y}) lies outside ${img.width}×${img.height}`);
  }
  const data = new Uint8Array(w * h * 4);
  for (let r = 0; r < h; r++) {
    const from = ((y + r) * img.width + x) * 4;
    data.set(img.data.subarray(from, from + w * 4), r * w * 4);
  }
  return { width: w, height: h, data };
}

/** Rec.709 luma of the sRGB-encoded values, 0..1: the brightness the eye reads off the screen. */
export function lumaPlane(img: Raster): Plane {
  const out = new Float32Array(img.width * img.height);
  for (let i = 0, j = 0; i < out.length; i++, j += 4) out[i] = (0.2126 * img.data[j]! + 0.7152 * img.data[j + 1]! + 0.0722 * img.data[j + 2]!) / 255;
  return { width: img.width, height: img.height, data: out };
}

/** HSV saturation (max − min) / max of the sRGB values, 0..1 (0 for black). */
export function saturationPlane(img: Raster): Plane {
  const out = new Float32Array(img.width * img.height);
  for (let i = 0, j = 0; i < out.length; i++, j += 4) {
    const max = Math.max(img.data[j]!, img.data[j + 1]!, img.data[j + 2]!);
    out[i] = max > 0 ? (max - Math.min(img.data[j]!, img.data[j + 1]!, img.data[j + 2]!)) / max : 0;
  }
  return { width: img.width, height: img.height, data: out };
}

const saturationOf = (img: FloatImage): Plane => {
  const out = new Float32Array(img.width * img.height);
  for (let i = 0, j = 0; i < out.length; i++, j += 3) {
    const r = img.data[j]!;
    const g = img.data[j + 1]!;
    const b = img.data[j + 2]!;
    const max = Math.max(r, g, b);
    out[i] = max > 0 ? (max - Math.min(r, g, b)) / max : 0;
  }
  return { width: img.width, height: img.height, data: out };
};

/** Luma and saturation planes of a float RGB image. */
export function planesOf(img: FloatImage): { y: Plane; s: Plane } {
  const out = new Float32Array(img.width * img.height);
  for (let i = 0, j = 0; i < out.length; i++, j += 3) out[i] = 0.2126 * img.data[j]! + 0.7152 * img.data[j + 1]! + 0.0722 * img.data[j + 2]!;
  return { y: { width: img.width, height: img.height, data: out }, s: saturationOf(img) };
}

/**
 * Box-filter resample by `scale` onto the cloud target's texel grid: in the frame, texel k covers device px
 * [k/scale, (k+1)/scale), and `origin` is this image's top-left in the frame (device px). Only whole texels are kept,
 * so each is the mean of the pixels under it (area-weighted where its edges fall between pixels). A crop that starts
 * anywhere still lands in phase with the target, which is what keeps a 2×2 checkerboard from averaging away.
 * scale ≥ 1 gives the image itself as floats.
 */
export function resampleRgb(img: Raster, scale: number, origin: [number, number]): FloatImage {
  const { width: w, height: h, data } = img;
  if (scale >= 1) {
    // The image itself: RGBA bytes to float RGB.
    const out = new Float32Array(w * h * 3);
    for (let i = 0, j = 0; i < out.length; i += 3, j += 4) {
      out[i] = data[j]! / 255;
      out[i + 1] = data[j + 1]! / 255;
      out[i + 2] = data[j + 2]! / 255;
    }
    return { width: w, height: h, data: out };
  }
  /** Whole texels along an axis that starts at `o` and is `n` px long: where each begins (px, image-relative) and its length. */
  const axis = (o: number, n: number) => {
    // k/scale ≥ o and (k+1)/scale ≤ o + n (1e-9: 180 × 0.35 is 63 up to rounding).
    const k0 = Math.ceil(o * scale - 1e-9);
    const count = Math.max(0, Math.floor((o + n) * scale + 1e-9) - k0);
    const start = new Float64Array(count);
    const span = 1 / scale;
    for (let k = 0; k < count; k++) start[k] = (k0 + k) * span - o;
    return { count, start, span };
  };
  const hx = axis(origin[0], w);
  const hy = axis(origin[1], h);
  const mid = new Float32Array(hx.count * h * 3);
  for (let y = 0; y < h; y++) {
    for (let k = 0; k < hx.count; k++) {
      const s = hx.start[k]!;
      for (let x = Math.max(0, Math.floor(s)); x < Math.min(w, Math.ceil(s + hx.span)); x++) {
        const weight = Math.min(x + 1, s + hx.span) - Math.max(x, s);
        if (weight <= 0) continue;
        const from = (y * w + x) * 4;
        const to = (y * hx.count + k) * 3;
        mid[to] = mid[to]! + weight * data[from]!;
        mid[to + 1] = mid[to + 1]! + weight * data[from + 1]!;
        mid[to + 2] = mid[to + 2]! + weight * data[from + 2]!;
      }
    }
  }
  const out = new Float32Array(hx.count * hy.count * 3);
  for (let j = 0; j < hy.count; j++) {
    const s = hy.start[j]!;
    for (let y = Math.max(0, Math.floor(s)); y < Math.min(h, Math.ceil(s + hy.span)); y++) {
      // The box's area × 255: the texel is the mean of the pixels under it, in 0..1.
      const weight = (Math.min(y + 1, s + hy.span) - Math.max(y, s)) / (255 * hx.span * hy.span);
      if (weight <= 0) continue;
      const from = y * hx.count * 3;
      const to = j * hx.count * 3;
      for (let i = 0; i < hx.count * 3; i++) out[to + i] = out[to + i]! + weight * mid[from + i]!;
    }
  }
  return { width: hx.count, height: hy.count, data: out };
}
