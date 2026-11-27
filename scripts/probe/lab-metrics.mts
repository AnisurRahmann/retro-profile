/**
 * The lab's image metrics (T9), for comparing runs of `pnpm lab:shots`. They are not pass/fail gates. Each runs on a
 * 100% device-pixel crop of a 1440×900 shot (lab-shots.mts saves them to <run>/crops/), and goes into
 * <run>/metrics.json, one entry per crop. Pure functions over a Raster; tests/unit/vol-lab-metrics.test.ts checks
 * each one on a synthetic image. "Luma" is Rec.709 luma of the sRGB bytes (0..1), "saturation" HSV saturation.
 */
import { GEOMETRY } from "../../src/components/sky/volumetric/types";
import { type Plane, type Raster, lumaPlane, planesOf, resampleRgb, saturationPlane } from "./lab-image.mjs";

// ─── Crop geometry ────────────────────────────────────────────────────────────────────────────────────────────────

export const CROP_SIZE = 600;
export const BAND_SIZE = 300;
/** The 3×2 grid's centres, as fractions of the frame. */
export const GRID_X = [1 / 6, 1 / 2, 5 / 6] as const;
export const GRID_Y = [0.25, 0.55] as const;

export type CropRect = { name: string; x: number; y: number; w: number; h: number };

/**
 * Where a frame's crops sit, in device px: g0..g5 row-major, then the band, the BAND_SIZE px above the horizon.
 * Defined for a 1440×900 DPR 2 frame (2880×1800) or larger; a smaller frame gets a RangeError rather than crops
 * that fall off its edge.
 */
export function cropRects(width: number, height: number): CropRect[] {
  const out: CropRect[] = [];
  GRID_Y.forEach((fy, r) =>
    GRID_X.forEach((fx, c) =>
      out.push({ name: `g${r * 3 + c}`, x: Math.round(fx * width) - CROP_SIZE / 2, y: Math.round(fy * height) - CROP_SIZE / 2, w: CROP_SIZE, h: CROP_SIZE }),
    ),
  );
  out.push({ name: "band", x: 0, y: Math.round(GEOMETRY.HORIZON_AT * height) - BAND_SIZE, w: width, h: BAND_SIZE });
  for (const r of out) {
    if (r.x < 0 || r.y < 0 || r.x + r.w > width || r.y + r.h > height) {
      throw new RangeError(`crops of a ${width}×${height} frame fall outside it (they need 2880×1800, a 1440×900 DPR 2 frame)`);
    }
  }
  return out;
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
};

/** Sobel 3×3 derivatives of a plane (0 on the border row and column). */
function sobel(p: Plane): { gx: Float32Array; gy: Float32Array } {
  const { width: w, height: h, data } = p;
  const gx = new Float32Array(w * h);
  const gy = new Float32Array(w * h);
  for (let j = 1; j < h - 1; j++) {
    for (let i = 1; i < w - 1; i++) {
      const k = j * w + i;
      gx[k] = data[k - w + 1]! + 2 * data[k + 1]! + data[k + w + 1]! - data[k - w - 1]! - 2 * data[k - 1]! - data[k + w - 1]!;
      gy[k] = data[k + w - 1]! + 2 * data[k + w]! + data[k + w + 1]! - data[k - w - 1]! - 2 * data[k - w]! - data[k - w + 1]!;
    }
  }
  return { gx, gy };
}

// ─── lattice ──────────────────────────────────────────────────────────────────────────────────────────────────────

/** A 2×2 window counts only when all four texels have a saturation under this. */
export const LATTICE_MAX_SAT = 0.35;
export type Lattice = { lattice: number | null; latticeQuads: number };

/**
 * lattice: the crop box-resampled onto the cloud target's texel grid (`scale`, `origin` = resampleRgb), then the
 * mean absolute response of [[1, −1], [−1, 1]] on luma over 2×2 windows of low-saturation texels (cloud and haze;
 * the blue sky and the sun have real contrast at every scale and would drown it). A 2×2 checkerboard of amplitude A
 * on the texel grid reads 4A; a smooth image reads near 0. latticeQuads is how many windows counted.
 */
export function lattice(img: Raster, scale: number, origin: [number, number]): Lattice {
  const { y, s } = planesOf(resampleRgb(img, scale, origin));
  const { width: w, data: L } = y;
  const { data: S } = s;
  let sum = 0;
  let quads = 0;
  for (let j = 0; j < y.height - 1; j++) {
    for (let i = 0; i < w - 1; i++) {
      const a = j * w + i;
      const b = a + 1;
      const c = a + w;
      const d = c + 1;
      if (S[a]! >= LATTICE_MAX_SAT || S[b]! >= LATTICE_MAX_SAT || S[c]! >= LATTICE_MAX_SAT || S[d]! >= LATTICE_MAX_SAT) continue;
      sum += Math.abs(L[a]! - L[b]! - L[c]! + L[d]!);
      quads++;
    }
  }
  return { lattice: quads ? sum / quads : null, latticeQuads: quads };
}

// ─── edgeWidth ────────────────────────────────────────────────────────────────────────────────────────────────────

/** edgeWidth profiles this share of the pixels (those with the largest gradient magnitude). */
export const EDGE_TOP = 0.01;
/** edgeWidth samples the luma profile this far (device px) either side of the pixel, every EDGE_STEP. */
export const EDGE_HALF = 12;
const EDGE_STEP = 0.5;

export type EdgeWidth = { edgeWidth: number | null; edgeSamples: number };

const catmull = (p0: number, p1: number, p2: number, p3: number, t: number) =>
  p1 + 0.5 * t * (p2 - p0 + t * (2 * p0 - 5 * p1 + 4 * p2 - p3 + t * (3 * (p1 - p2) + p3 - p0)));

/** Catmull-Rom sample of a plane at (x, y) in pixel-centre coordinates; the 4×4 stencil must lie inside. */
function bicubic(p: Plane, x: number, y: number): number {
  const i = Math.floor(x);
  const j = Math.floor(y);
  const w = p.width;
  const d = p.data;
  const row = (jj: number) => catmull(d[jj * w + i - 1]!, d[jj * w + i]!, d[jj * w + i + 1]!, d[jj * w + i + 2]!, x - i);
  return catmull(row(j - 1), row(j), row(j + 1), row(j + 2), y - j);
}

/** Where the profile first reaches `level` after index `from` (rising: ≥, falling: ≤), in samples; NaN if never. */
function crossing(p: Float64Array, from: number, level: number, rise: boolean): number {
  for (let j = from + 1; j < p.length; j++) {
    if (rise ? p[j]! < level : p[j]! > level) continue;
    return j - 1 + (level - p[j - 1]!) / (p[j]! - p[j - 1]!);
  }
  return NaN;
}

/**
 * edgeWidth: the median 10–90% rise width of the EDGE_TOP strongest Sobel edges, in CSS px (device px / dpr). For
 * each: the luma profile ±EDGE_HALF px along the gradient (bicubic samples every EDGE_STEP), and the distance between
 * where it crosses 10% and 90% of its own range. A profile with no range (flat) doesn't count. Wider is softer.
 *
 * On known erf edges it reads within 1% from about 4 to 10 device px of width. The window bounds it: a wider edge
 * no longer reaches both plateaus at ±12 px and reads narrow (−4% at 12.8 px, −7% at 15.4 px), and a razor-sharp one
 * reads 4% wide from the interpolation's ringing.
 */
export function edgeWidth(img: Raster, dpr: number): EdgeWidth {
  const Y = lumaPlane(img);
  const { gx, gy } = sobel(Y);
  const { width: w, height: h } = img;
  const m = EDGE_HALF;
  if (w < 2 * m + 5 || h < 2 * m + 5) return { edgeWidth: null, edgeSamples: 0 };
  // Pixels with room for the whole profile and the bicubic stencil.
  const cand: number[] = [];
  for (let j = m + 2; j < h - m - 2; j++) for (let i = m + 2; i < w - m - 2; i++) cand.push(j * w + i);
  const take = Math.max(1, Math.floor(cand.length * EDGE_TOP));
  const mags = Float32Array.from(cand, (k) => Math.hypot(gx[k]!, gy[k]!));
  const threshold = Float32Array.from(mags).sort()[mags.length - take]!;
  const widths: number[] = [];
  const prof = new Float64Array(Math.round((2 * m) / EDGE_STEP) + 1);
  for (let n = 0; n < cand.length && widths.length < take; n++) {
    if (mags[n]! < threshold) continue;
    const k = cand[n]!;
    const ux = gx[k]! / mags[n]!;
    const uy = gy[k]! / mags[n]!;
    const x = k % w;
    const y = (k - x) / w;
    let iMin = 0;
    let iMax = 0;
    for (let i = 0; i < prof.length; i++) {
      const t = i * EDGE_STEP - m;
      prof[i] = bicubic(Y, x + t * ux, y + t * uy);
      if (prof[i]! < prof[iMin]!) iMin = i;
      if (prof[i]! > prof[iMax]!) iMax = i;
    }
    const lo = prof[iMin]!;
    const hi = prof[iMax]!;
    if (hi - lo < 1e-3) continue;
    const rise = iMin < iMax;
    const from = rise ? iMin : iMax;
    const a = crossing(prof, from, lo + 0.1 * (hi - lo), rise);
    const b = crossing(prof, from, lo + 0.9 * (hi - lo), rise);
    if (Number.isFinite(a) && Number.isFinite(b)) widths.push(Math.abs(b - a) * EDGE_STEP);
  }
  return { edgeWidth: widths.length ? median(widths) / dpr : null, edgeSamples: widths.length };
}

// ─── bodyStd ──────────────────────────────────────────────────────────────────────────────────────────────────────

/** bodyStd tiles the crop with boxes of this side (whole pixels, from the top-left corner). */
export const BODY_BOX = 41;
/** A box is a cloud body when its mean saturation is under this. */
export const BODY_MAX_SAT = 0.2;
export type BodyStd = { bodyStd: number | null; bodyBoxes: number };

/**
 * bodyStd: the median, over the BODY_BOX² boxes of whole pixels whose mean saturation is under BODY_MAX_SAT (cloud
 * bodies; sky and sun are excluded), of the standard deviation of luma in the box. Low is flat or smeared.
 */
export function bodyStd(img: Raster): BodyStd {
  const Y = lumaPlane(img);
  const S = saturationPlane(img);
  const nx = Math.floor(img.width / BODY_BOX);
  const ny = Math.floor(img.height / BODY_BOX);
  const n = BODY_BOX * BODY_BOX;
  const stds: number[] = [];
  for (let by = 0; by < ny; by++) {
    for (let bx = 0; bx < nx; bx++) {
      let sat = 0;
      for (let j = 0; j < BODY_BOX; j++) for (let i = 0; i < BODY_BOX; i++) sat += S.data[(by * BODY_BOX + j) * img.width + bx * BODY_BOX + i]!;
      if (sat / n >= BODY_MAX_SAT) continue;
      let sum = 0;
      let sum2 = 0;
      for (let j = 0; j < BODY_BOX; j++) {
        for (let i = 0; i < BODY_BOX; i++) {
          const v = Y.data[(by * BODY_BOX + j) * img.width + bx * BODY_BOX + i]!;
          sum += v;
          sum2 += v * v;
        }
      }
      stds.push(Math.sqrt(Math.max(0, sum2 / n - (sum / n) ** 2)));
    }
  }
  return { bodyStd: stds.length ? median(stds) : null, bodyBoxes: stds.length };
}

// ─── streak (the horizon band) ────────────────────────────────────────────────────────────────────────────────────

/**
 * streak: Σ(dL/dy)² ÷ Σ(dL/dx)² over the band's Sobel gradients. Above 1, luminance changes more down the band than
 * along it: horizontal streaks or banding. Infinity when nothing changes along x; null when nothing changes at all.
 */
export function streak(img: Raster): number | null {
  const { gx, gy } = sobel(lumaPlane(img));
  let along = 0;
  let down = 0;
  for (let i = 0; i < gx.length; i++) {
    along += gx[i]! * gx[i]!;
    down += gy[i]! * gy[i]!;
  }
  if (along === 0) return down === 0 ? null : Infinity;
  return down / along;
}

// ─── All of them, for one crop ────────────────────────────────────────────────────────────────────────────────────

export type CropMetrics = {
  lattice: number | null;
  latticeQuads: number;
  /** CSS px. */
  edgeWidth: number | null;
  edgeSamples: number;
  bodyStd: number | null;
  bodyBoxes: number;
  /** The horizon band only; null elsewhere. */
  streak: number | null;
};

/** `scale` is the cloud target's scale for the shot (the state's, else the tier's) and `origin` the crop's top-left in the frame. */
export function measureCrop(
  img: Raster,
  opts: { scale: number; origin: [number, number]; dpr: number; band: boolean },
): CropMetrics {
  return {
    ...lattice(img, opts.scale, opts.origin),
    ...edgeWidth(img, opts.dpr),
    ...bodyStd(img),
    streak: opts.band ? streak(img) : null,
  };
}
