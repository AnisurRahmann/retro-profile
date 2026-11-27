/**
 * The lab probes' image tools and metrics (T9): every metric on a synthetic image (a 2×2 checkerboard, a step edge
 * blurred with a known sigma, stripes), the PNG codec, the exact crops and the texel-aligned resample, and the
 * probes' LAB_URL requirement. The metrics compare runs; these tests only pin their definitions.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { crop, decodePng, encodePng, resampleRgb, type Raster } from "../../scripts/probe/lab-image.mjs";
import { BAND_SIZE, BODY_BOX, CROP_SIZE, bodyStd, cropRects, edgeWidth, lattice, measureCrop, streak } from "../../scripts/probe/lab-metrics.mjs";
import { labUrlProblem } from "../../scripts/probe/lab-url.mjs";

type Rgb = [number, number, number];
const ROOT = path.resolve(import.meta.dirname, "../..");

/** A 1440×900 DPR 2 frame in device px. */
const FRAME_W = 2880;
const FRAME_H = 1800;

const image = (width: number, height: number, px: (x: number, y: number) => Rgb): Raster => {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0, i = 0; y < height; y++) {
    for (let x = 0; x < width; x++, i += 4) {
      const [r, g, b] = px(x, y);
      data[i] = Math.round(r * 255);
      data[i + 1] = Math.round(g * 255);
      data[i + 2] = Math.round(b * 255);
      data[i + 3] = 255;
    }
  }
  return { width, height, data };
};
const grey = (v: number): Rgb => [v, v, v];
/** A checkerboard of two colours with `cell` px squares. */
const checker = (a: Rgb, b: Rgb, cell = 1) => (x: number, y: number): Rgb => ((Math.floor(x / cell) + Math.floor(y / cell)) % 2 ? b : a);
/** A saturated sky blue (HSV saturation 0.76), and its neighbour. */
const SKY: Rgb = [0.2, 0.4, 0.85];
const SKY_HI: Rgb = [0.25, 0.45, 0.9];
const DARK = grey(0.3);
const LIGHT = grey(0.7);
/** DARK and LIGHT in 8 bits (77 and 179): their difference, the checkerboard's full step. */
const STEP = (179 - 77) / 255;
/** The kernel on a DARK/LIGHT checkerboard: 0.7 − 0.3 − 0.3 + 0.7, i.e. 4× its amplitude. */
const CHECKER = 2 * STEP;
/** The standard deviation of a 41×41 box holding 421 dark and 420 light pixels (variance = step² · p · (1 − p)). */
const SPLIT_STD = STEP * Math.sqrt((421 * 420) / (841 * 841));

// ─── PNG codec ────────────────────────────────────────────────────────────────────────────────────────────────────

const CRC = new Int32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb8_8320 ^ (c >>> 1) : c >>> 1;
  CRC[n] = c;
}
const crc32 = (b: number[]) => {
  let c = ~0;
  for (const v of b) c = CRC[(c ^ v) & 255]! ^ (c >>> 8);
  return ~c >>> 0;
};
const chunk = (type: string, data: number[]) => {
  const body = [...type].map((ch) => ch.charCodeAt(0)).concat(data);
  const out = Buffer.alloc(data.length + 12);
  out.writeUInt32BE(data.length, 0);
  body.forEach((v, i) => (out[4 + i] = v));
  out.writeUInt32BE(crc32(body), data.length + 8);
  return out;
};
/** A PNG written here (not by encodePng), so the decoder is tested on its own. */
const png = (width: number, height: number, colourType: number, depth: number, interlace: number, raw: Uint8Array) =>
  Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", [...be32(width), ...be32(height), depth, colourType, 0, 0, interlace]),
    chunk("IDAT", [...deflateSync(raw)]),
    chunk("IEND", []),
  ]);
const be32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];

/** `raw`'s scanlines each prefixed with filter `f`, the filter applied forward (the decoder's inverse). */
const filtered = (raw: Uint8Array, width: number, samples: number, f: number) => {
  const stride = width * samples;
  const rows = raw.length / stride;
  const out = new Uint8Array((stride + 1) * rows);
  for (let r = 0; r < rows; r++) out[r * (stride + 1)] = f;
  for (let i = 0; i < raw.length; i++) {
    const a = i % stride >= samples ? raw[i - samples]! : 0;
    const b = i >= stride ? raw[i - stride]! : 0;
    const c = i >= stride && i % stride >= samples ? raw[i - stride - samples]! : 0;
    const p = a + b - c;
    const pa = Math.abs(p - a);
    const pb = Math.abs(p - b);
    const pc = Math.abs(p - c);
    const pred = f === 1 ? a : f === 2 ? b : f === 3 ? (a + b) >> 1 : f === 4 ? (pa <= pb && pa <= pc ? a : pb <= pc ? b : c) : 0;
    // Byte i of the unfiltered data sits at column i % stride, so one byte further per row already written.
    out[i + Math.floor(i / stride) + 1] = (raw[i]! - pred) & 255;
  }
  return out;
};

describe("PNG codec", () => {
  it("round-trips losslessly", () => {
    const img = image(67, 41, (x, y) => [x / 66, y / 40, ((x * 7 + y * 13) % 5) / 4]);
    const back = decodePng(encodePng(img));
    expect([back.width, back.height]).toEqual([67, 41]);
    expect(Buffer.from(back.data).equals(Buffer.from(img.data))).toBe(true);
    // A flat image: every row filter costs the same, so the first (none) is taken.
    const flat = image(3, 2, () => DARK);
    expect(Buffer.from(decodePng(encodePng(flat)).data).equals(Buffer.from(flat.data))).toBe(true);
  });

  it("round-trips images that suit each row filter", () => {
    // Flat rows (none), a ramp along x (sub), a ramp down y (up), ramps both ways (average, paeth).
    const flat = image(40, 30, () => [0.3, 0.5, 0.7]);
    const along = image(40, 30, (x) => [x / 39, 0.2, 0.8 - x / 60]);
    const down = image(40, 30, (_x, y) => [0.1, y / 29, 0.9 - y / 50]);
    const both = image(40, 30, (x, y) => [x / 39, y / 29, (x + y) / 68]);
    for (const img of [flat, along, down, both]) {
      expect(Buffer.from(decodePng(encodePng(img)).data).equals(Buffer.from(img.data))).toBe(true);
    }
  });

  it.each([0, 1, 2, 3, 4])("decodes rows filtered with filter %i", (f) => {
    const width = 13;
    const height = 7;
    const rgba = Uint8Array.from({ length: width * height * 4 }, (_, i) => (i * 97 + (i >> 3) * 31 + 7) % 256);
    const out = decodePng(png(width, height, 6, 8, 0, filtered(rgba, width, 4, f)));
    expect(Buffer.from(out.data).equals(Buffer.from(rgba))).toBe(true);
  });

  it("expands RGB, grey and grey+alpha to RGBA, taking bytes as stored", () => {
    const width = 5;
    const height = 3;
    const rgb = Uint8Array.from({ length: width * height * 3 }, (_, i) => (i * 37) % 256);
    const from = (bytes: number[], samples: number) => {
      const raw = new Uint8Array((width * samples + 1) * height);
      bytes.forEach((v, i) => (raw[Math.floor(i / (width * samples)) + i + 1] = v));
      return [...decodePng(png(width, height, samples === 3 ? 2 : samples === 2 ? 4 : 0, 8, 0, raw)).data];
    };
    const rgbaOf = from([...rgb], 3);
    expect(rgbaOf.slice(0, 8)).toEqual([rgb[0], rgb[1], rgb[2], 255, rgb[3], rgb[4], rgb[5], 255]);
    const greyBytes = [...rgb].slice(0, width * height);
    expect(from(greyBytes, 1).slice(0, 8)).toEqual([greyBytes[0], greyBytes[0], greyBytes[0], 255, greyBytes[1], greyBytes[1], greyBytes[1], 255]);
    const ga = [...rgb].slice(0, width * height * 2);
    expect(from(ga, 2).slice(0, 8)).toEqual([ga[0], ga[0], ga[0], ga[1], ga[2], ga[2], ga[2], ga[3]]);
  });

  it("refuses what it does not decode", () => {
    const width = 4;
    const height = 4;
    const raw = new Uint8Array((width * 4 + 1) * height);
    expect(() => decodePng(Buffer.from("not a png at all"))).toThrow("bad signature");
    expect(() => decodePng(png(width, height, 6, 16, 0, raw))).toThrow("16-bit");
    expect(() => decodePng(png(width, height, 6, 8, 1, raw))).toThrow("interlace 1");
    expect(() => decodePng(png(width, height, 3, 8, 0, raw))).toThrow("colour type 3");
    expect(() => decodePng(png(width, height, 6, 8, 0, raw.subarray(0, 10)))).toThrow("truncated");
    // A known filter byte out of range.
    const bad = filtered(raw, width, 4, 0);
    bad[0] = 7;
    expect(() => decodePng(png(width, height, 6, 8, 0, bad))).toThrow("unknown PNG filter 7");
    // The header's size is the file's word: an absurd or empty frame is refused before any buffer is allocated.
    expect(() => decodePng(png(0, height, 6, 8, 0, raw))).toThrow("unsupported PNG size 0×4");
    expect(() => decodePng(png(1 << 20, 1 << 20, 8, 8, 0, raw))).toThrow("unsupported PNG size");
  });
});

// ─── Crops and the resample ──────────────────────────────────────────────────────────────────────────────────────

describe("crops", () => {
  it("copies exact pixels and refuses a rectangle outside the image", () => {
    const img = image(8, 6, (x, y) => [(x * 30) / 255, (y * 40) / 255, 1]);
    const c = crop(img, 2, 1, 3, 2);
    expect([c.width, c.height]).toEqual([3, 2]);
    const expected: number[] = [];
    for (const y of [1, 2]) for (const x of [2, 3, 4]) expected.push(...img.data.subarray((y * 8 + x) * 4, (y * 8 + x) * 4 + 4));
    expect([...c.data]).toEqual(expected);
    expect(() => crop(img, 6, 0, 3, 1)).toThrow(RangeError);
    expect(() => crop(img, 0, 5, 1, 2)).toThrow(RangeError);
    expect(() => crop(img, -1, 0, 1, 1)).toThrow(RangeError);
    expect(() => crop(img, 1.5, 0, 1, 1)).toThrow(RangeError);
  });

  it("lays out six 600×600 crops and the 300 px above the horizon of a 1440×900 DPR 2 frame", () => {
    const rects = cropRects(FRAME_W, FRAME_H);
    expect(rects.map((r) => r.name)).toEqual(["g0", "g1", "g2", "g3", "g4", "g5", "band"]);
    const centresX = [FRAME_W / 6, FRAME_W / 2, (5 * FRAME_W) / 6];
    const centresY = [FRAME_H / 4, (FRAME_H * 55) / 100];
    rects.slice(0, 6).forEach((r, i) => {
      expect([r.w, r.h]).toEqual([CROP_SIZE, CROP_SIZE]);
      expect(r.x + CROP_SIZE / 2).toBe(centresX[i % 3]);
      expect(r.y + CROP_SIZE / 2).toBe(centresY[Math.floor(i / 3)]);
    });
    // The horizon is at 82% of the height: the band ends on it.
    expect(rects[6]).toEqual({ name: "band", x: 0, y: Math.round(0.82 * FRAME_H) - BAND_SIZE, w: FRAME_W, h: BAND_SIZE });
    expect(rects[6]!.y + rects[6]!.h).toBe(1476);
    for (const r of rects) expect(r.x >= 0 && r.y >= 0 && r.x + r.w <= FRAME_W && r.y + r.h <= FRAME_H).toBe(true);
  });

  it("refuses a frame too small for the crops", () => {
    expect(() => cropRects(1440, 900)).toThrow(RangeError); // DPR 1: the outer columns would start at −60
  });

  it("resamples by whole texels of the cloud target's grid", () => {
    // At scale 0.5 texel k covers device px [2k, 2k + 2).
    const img = image(4, 2, (x, y) => grey((x + 4 * y) / 8));
    const out = resampleRgb(img, 0.5, [0, 0]);
    expect([out.width, out.height]).toEqual([2, 1]);
    const at = (x: number, y: number) => img.data[(y * 4 + x) * 4]! / 255;
    expect(out.data[0]).toBeCloseTo((at(0, 0) + at(1, 0) + at(0, 1) + at(1, 1)) / 4, 6);
    expect(out.data[3]).toBeCloseTo((at(2, 0) + at(3, 0) + at(2, 1) + at(3, 1)) / 4, 6);
    // The origin is the image's place in the frame: shifted a whole texel, the boxes are the same…
    expect([...resampleRgb(img, 0.5, [2, 0]).data]).toEqual([...out.data]);
    // …shifted half a texel, only the texels that still fit whole are kept.
    const half = resampleRgb(img, 0.5, [1, 0]);
    expect([half.width, half.height]).toEqual([1, 1]);
    expect(half.data[0]).toBeCloseTo((at(1, 0) + at(2, 0) + at(1, 1) + at(2, 1)) / 4, 6);
    // The review crops of a 2880×1800 frame at the high tier's 0.35: 180 × 0.35 = 63 texels, 150 × 0.35 = 52.5.
    const review = resampleRgb(image(CROP_SIZE, CROP_SIZE, () => DARK), 0.35, [180, 150]);
    expect([review.width, review.height]).toEqual([210, 209]);
    // A scale of 1 is the image itself, as floats.
    const identity = resampleRgb(img, 1, [0, 0]).data.filter((_, i) => i % 3 === 0);
    [0, 1].flatMap((y) => [0, 1, 2, 3].map((x) => at(x, y))).forEach((v, i) => expect(identity[i]).toBeCloseTo(v, 6));
  });
});

// ─── lattice ──────────────────────────────────────────────────────────────────────────────────────────────────────

describe("lattice", () => {
  it("reads a 2×2 checkerboard as 4× its amplitude", () => {
    const board = lattice(image(64, 64, checker(DARK, LIGHT)), 1, [0, 0]);
    expect(board.latticeQuads).toBe(63 * 63);
    expect(board.lattice!).toBeCloseTo(CHECKER, 6); // float32: 0.8 comes back as 0.8000000119
    // The opposite phase gives the same magnitude.
    expect(lattice(image(64, 64, checker(LIGHT, DARK)), 1, [0, 0]).lattice!).toBeCloseTo(CHECKER, 6);
  });

  it("reads about 0 on a smooth image", () => {
    expect(lattice(image(64, 64, () => DARK), 1, [0, 0]).lattice).toBe(0);
    // A linear ramp: the kernel is its second difference.
    expect(lattice(image(64, 64, (x, y) => grey((x + 2 * y) / 200)), 1, [0, 0]).lattice!).toBeLessThan(0.004);
  });

  it("counts only 2×2 windows whose texels are all low-saturation", () => {
    expect(lattice(image(64, 64, checker(SKY, SKY_HI)), 1, [0, 0])).toEqual({ lattice: null, latticeQuads: 0 });
    // Sky on the right half: a window is counted only where all four texels are grey.
    const half = image(64, 64, (x, y) => (x >= 32 ? checker(SKY, SKY_HI)(x, y) : checker(DARK, LIGHT)(x, y)));
    const { latticeQuads } = lattice(half, 1, [0, 0]);
    expect(latticeQuads).toBe(31 * 63); // a window spans columns i and i + 1: i = 0..30, rows 0..62
  });

  it("resamples onto the tier's texel grid first, in phase with the frame", () => {
    // At scale 0.5 a texel is 2 px: 2-px cells stay a checkerboard, 1-px cells average away.
    expect(lattice(image(64, 64, checker(DARK, LIGHT, 2)), 0.5, [0, 0]).lattice).toBeCloseTo(CHECKER, 5);
    expect(lattice(image(64, 64, checker(DARK, LIGHT, 1)), 0.5, [0, 0]).lattice!).toBeLessThan(0.004);
    // A crop taken one pixel into the frame: its boxes follow the frame's grid, not the crop's corner.
    const frame = image(66, 64, checker(DARK, LIGHT, 2));
    expect(lattice(crop(frame, 1, 0, 64, 64), 0.5, [1, 0]).lattice).toBeCloseTo(CHECKER, 5);
    // Told its origin were the frame's corner, the same pixels are half a texel out of phase and read flat.
    expect(lattice(crop(frame, 1, 0, 64, 64), 0.5, [0, 0]).lattice!).toBeLessThan(0.004);
  });
});

// ─── edgeWidth ────────────────────────────────────────────────────────────────────────────────────────────────────

/** The normal CDF, Φ(z) = (1 + erf(z/√2)) / 2 (erf by Abramowitz–Stegun 7.1.26, |error| < 1.5e-7). */
const phi = (z: number) => {
  const t = 1 / (1 + 0.3275911 * Math.abs(z / Math.SQRT2));
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t) * Math.exp((-z * z) / 2);
  return 0.5 * (1 + Math.sign(z) * y);
};
/** A vertical step edge at x = 39.5 blurred with `sigma` px: luma 0.1 → 0.9 (the 10–90% width of erf is 2.5631 σ). */
const blurredStep = (sigma: number) => image(80, 60, (x) => grey(0.1 + 0.8 * phi((x - 39.5) / sigma)));
const W10_90 = 2.5631;

describe("edgeWidth", () => {
  // Measured here: 1.5 → +0.3%, 2 → −0.4%, 3 → −1.0%, 4 → −0.3%.
  it.each([1.5, 2, 3, 4])("reads a step edge blurred with sigma %i px at 2.563 × sigma", (sigma) => {
    const { edgeWidth: w, edgeSamples } = edgeWidth(blurredStep(sigma), 1);
    expect(edgeSamples).toBeGreaterThan(0);
    expect(Math.abs(w! / (W10_90 * sigma) - 1)).toBeLessThan(0.02);
  });

  it("is bounded by its ±12 px window: a wider edge reads narrow, a razor-sharp one a little wide", () => {
    // Past about 12 px the profile no longer reaches both plateaus (measured: 5 → −3.8%, 6 → −7.3%); at 1 px the
    // interpolation rings (measured +4.0%).
    expect(Math.abs(edgeWidth(blurredStep(5), 1).edgeWidth! / (W10_90 * 5) - 1)).toBeLessThan(0.05);
    expect(Math.abs(edgeWidth(blurredStep(6), 1).edgeWidth! / (W10_90 * 6) - 1)).toBeLessThan(0.1);
    expect(Math.abs(edgeWidth(blurredStep(1), 1).edgeWidth! / W10_90 - 1)).toBeLessThan(0.05);
  });

  it("reports CSS px: device px over the DPR", () => {
    const wide = edgeWidth(blurredStep(4), 1).edgeWidth!;
    expect(edgeWidth(blurredStep(4), 2).edgeWidth!).toBeCloseTo(wide / 2, 6);
    expect(edgeWidth(blurredStep(4), 3).edgeWidth!).toBeCloseTo(wide / 3, 6);
  });

  it("reads a sharp edge as narrow, and nothing on a flat image", () => {
    const sharp = edgeWidth(image(80, 60, (x) => grey(x < 40 ? 0.1 : 0.9)), 1);
    expect(sharp.edgeWidth!).toBeGreaterThan(0.5);
    expect(sharp.edgeWidth!).toBeLessThan(2);
    expect(edgeWidth(image(80, 60, () => DARK), 1)).toEqual({ edgeWidth: null, edgeSamples: 0 });
    // A horizontal edge reads the same as a vertical one.
    expect(Math.abs(edgeWidth(image(60, 80, (_x, y) => grey(0.1 + 0.8 * phi((y - 39.5) / 3))), 1).edgeWidth! / (W10_90 * 3) - 1)).toBeLessThan(0.03);
  });

  it("measures the strongest 1% of pixels: a sharp edge outranks a soft one", () => {
    // A sharp edge (sigma 0.6) left of centre and a soft one (sigma 3) right of it. The sharp edge's ridge alone
    // holds more than 1% of the pixels, so none of the soft edge's are profiled.
    const at = (x: number, x0: number, sigma: number) => 0.1 + 0.8 * phi((x - x0) / sigma);
    const softOnly = image(80, 60, (x) => grey(at(x, 59.5, 3)));
    const both = image(80, 60, (x) => grey(x < 40 ? at(x, 19.5, 0.6) : at(x, 59.5, 3)));
    const soft = edgeWidth(softOnly, 1).edgeWidth!;
    expect(Math.abs(soft / (W10_90 * 3) - 1)).toBeLessThan(0.03);
    const mixed = edgeWidth(both, 1).edgeWidth!;
    expect(mixed).toBeGreaterThan(0.3);
    expect(mixed).toBeLessThan(soft / 3);
  });
});

// ─── bodyStd ──────────────────────────────────────────────────────────────────────────────────────────────────────

describe("bodyStd", () => {
  it("reads 0 on a flat grey", () => {
    const flat = bodyStd(image(82, 82, () => DARK));
    expect(flat.bodyBoxes).toBe(4);
    expect(flat.bodyStd!).toBeCloseTo(0, 6); // float32 round-off, not exactly 0
  });

  it("reads the standard deviation inside every low-saturation box", () => {
    const img = image(2 * BODY_BOX, 2 * BODY_BOX, checker(DARK, LIGHT, 1));
    const { bodyStd: s, bodyBoxes } = bodyStd(img);
    expect(bodyBoxes).toBe(4);
    expect(s!).toBeCloseTo(SPLIT_STD, 5);
  });

  it("leaves saturated boxes out, and returns null when there is no body", () => {
    expect(bodyStd(image(82, 82, checker(SKY, SKY_HI)))).toEqual({ bodyStd: null, bodyBoxes: 0 });
    const half = image(2 * BODY_BOX, BODY_BOX, (x, y) => (x < BODY_BOX ? checker(DARK, LIGHT)(x, y) : checker(SKY, SKY_HI)(x, y)));
    expect(bodyStd(half).bodyBoxes).toBe(1);
    expect(bodyStd(half).bodyStd).toBeCloseTo(SPLIT_STD, 5);
    // No whole box fits.
    expect(bodyStd(image(40, 40, () => DARK))).toEqual({ bodyStd: null, bodyBoxes: 0 });
  });
});

// ─── streak ───────────────────────────────────────────────────────────────────────────────────────────────────────

describe("streak", () => {
  it("reads high on horizontal stripes", () => {
    // Constant along x: no horizontal gradient at all.
    expect(streak(image(64, 64, (_x, y) => grey(y % 8 < 4 ? 0.2 : 0.8)))).toBe(Infinity);
    // The same stripes with a slow variation along x: finite, and high.
    const soft = (y: number) => 0.5 + 0.3 * phi((y % 8 - 3.5) / 0.8) * (y % 8 < 4 ? -1 : 1);
    expect(streak(image(64, 64, (x, y) => grey(soft(y) + 0.01 * Math.sin(x / 3))))).toBeGreaterThan(50);
  });

  it("reads low on vertical stripes and 1 on a checkerboard, null on a flat image", () => {
    expect(streak(image(64, 64, (x) => grey(x % 8 < 4 ? 0.2 : 0.8)))).toBe(0);
    expect(streak(image(64, 64, checker(DARK, LIGHT, 2)))).toBeCloseTo(1, 6);
    expect(streak(image(64, 64, () => DARK))).toBeNull();
  });
});

describe("measureCrop", () => {
  it("runs every metric on one crop, with streak on the band only", () => {
    const img = image(CROP_SIZE, CROP_SIZE, checker(DARK, LIGHT, 3));
    const opts = { scale: 0.35, origin: [180, 150] as [number, number], dpr: 2 };
    const grid = measureCrop(img, { ...opts, band: false });
    expect(Object.keys(grid).sort()).toEqual(["bodyBoxes", "bodyStd", "edgeSamples", "edgeWidth", "lattice", "latticeQuads", "streak"]);
    expect(grid.streak).toBeNull();
    expect(grid.lattice).not.toBeNull();
    expect(grid.edgeWidth).not.toBeNull();
    expect(grid.bodyStd).not.toBeNull();
    expect(measureCrop(img, { ...opts, band: true }).streak).toBeCloseTo(1, 5);
    // The same numbers as the metrics called one by one.
    expect(grid.lattice).toBe(lattice(img, 0.35, [180, 150]).lattice);
    expect(grid.edgeWidth).toBe(edgeWidth(img, 2).edgeWidth);
    expect(grid.bodyStd).toBe(bodyStd(img).bodyStd);
  });
});

// ─── LAB_URL ──────────────────────────────────────────────────────────────────────────────────────────────────────

describe("LAB_URL", () => {
  it("is required, and must be an http(s) URL", () => {
    expect(labUrlProblem(undefined)).toBe("LAB_URL is not set");
    expect(labUrlProblem("  ")).toBe("LAB_URL is not set");
    expect(labUrlProblem("localhost:3007")).toBe('LAB_URL="localhost:3007" is not an http(s) URL'); // a "localhost:" scheme
    expect(labUrlProblem("http://")).toBe('LAB_URL="http://" is not a URL');
    expect(labUrlProblem("ftp://localhost:3007")).toBe('LAB_URL="ftp://localhost:3007" is not an http(s) URL');
    expect(labUrlProblem("http://localhost:3007")).toBeNull();
    expect(labUrlProblem(" https://lab.example/ ")).toBeNull();
  });

  // Ends the process, so it runs the probes for real: both must exit 2 with the message, with no default port
  // (VOL_PORT no longer stands in) and before any browser starts.
  it.each(["lab-shots.mts", "lab-gpu.mts"])("%s exits with a clear error when LAB_URL is missing", (file) => {
    const env: NodeJS.ProcessEnv = { ...process.env, VOL_PORT: "3005" };
    delete env.LAB_URL;
    const r = spawnSync("pnpm", ["exec", "tsx", `scripts/probe/${file}`], { cwd: ROOT, env, encoding: "utf8", timeout: 60_000 });
    expect(r.error).toBeUndefined();
    expect(r.status).toBe(2);
    expect(r.stderr).toContain("LAB_URL is not set");
    expect(r.stderr).toContain("no default port");
    expect(r.stdout).toBe("");
  }, 60_000);
});
