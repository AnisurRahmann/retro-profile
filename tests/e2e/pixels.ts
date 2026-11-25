import type { Page } from "@playwright/test";

/** Brightest pixel (by WCAG luminance) inside a screenshot buffer, decoded in the page. */
export async function brightestPixel(page: Page, png: Buffer): Promise<[number, number, number]> {
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = "data:image/png;base64," + b64;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    const lin = (v: number) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    let best: [number, number, number] = [0, 0, 0];
    let bestL = -1;
    for (let i = 0; i < d.length; i += 4) {
      const L = 0.2126 * lin(d[i]!) + 0.7152 * lin(d[i + 1]!) + 0.0722 * lin(d[i + 2]!);
      if (L > bestL) {
        bestL = L;
        best = [d[i]!, d[i + 1]!, d[i + 2]!];
      }
    }
    return best;
  }, png.toString("base64"));
}

export function luminance([r, g, b]: [number, number, number]): number {
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrast(a: [number, number, number], b: [number, number, number]): number {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x! + 0.05) / (y! + 0.05);
}

export function hex(v: string): [number, number, number] {
  const n = parseInt(v.trim().slice(1, 7), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export type BoxMeasure = { text: [number, number, number]; bg: [number, number, number]; contrast: number; glyphs: number; pixels: number };

/**
 * Text and background of a loose-text element, from a screenshot of its box. Glyph pixels are those near the known
 * text colour (within 30% of the way to the box's median colour, at least 24/255). The background is the glyphs'
 * surround: non-glyph pixels between 1.5 and 6 CSS px from a glyph pixel (the anti-aliased fringe is left out, and
 * so is sky farther from the text than the halo reaches, which no reader compares the glyphs against).
 * Text = median glyph pixel by luminance, background = 90th-percentile surround pixel.
 */
export async function measureBox(page: Page, png: Buffer, textRgb: [number, number, number], dpr = 1): Promise<BoxMeasure> {
  return page.evaluate(
    async ({ b64, t, dpr }) => {
      const img = new Image();
      img.src = "data:image/png;base64," + b64;
      await img.decode();
      const W = img.width;
      const H = img.height;
      const c = document.createElement("canvas");
      c.width = W;
      c.height = H;
      const ctx = c.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, W, H).data;
      const lin = (v: number) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      };
      const L = (i: number) => 0.2126 * lin(d[i]!) + 0.7152 * lin(d[i + 1]!) + 0.0722 * lin(d[i + 2]!);
      const n = W * H;
      const order = Array.from({ length: n }, (_, k) => k).sort((p, q) => L(p * 4) - L(q * 4));
      const med = order[n >> 1]! * 4;
      const dist = (i: number, r: number, g: number, b: number) => Math.hypot(d[i]! - r, d[i + 1]! - g, d[i + 2]! - b);
      const thr = Math.max(24, 0.3 * dist(med, t[0], t[1], t[2]));
      const glyph = new Uint8Array(n);
      for (let k = 0; k < n; k++) glyph[k] = dist(k * 4, t[0], t[1], t[2]) < thr ? 1 : 0;
      // Square dilation by r device px (separable max filter).
      const dilate = (src: Uint8Array, r: number) => {
        const tmp = new Uint8Array(n);
        const out = new Uint8Array(n);
        for (let y = 0; y < H; y++)
          for (let x = 0; x < W; x++) {
            let v = 0;
            for (let dx = -r; dx <= r && !v; dx++) {
              const xx = x + dx;
              if (xx >= 0 && xx < W) v = src[y * W + xx]!;
            }
            tmp[y * W + x] = v;
          }
        for (let y = 0; y < H; y++)
          for (let x = 0; x < W; x++) {
            let v = 0;
            for (let dy = -r; dy <= r && !v; dy++) {
              const yy = y + dy;
              if (yy >= 0 && yy < H) v = tmp[yy * W + x]!;
            }
            out[y * W + x] = v;
          }
        return out;
      };
      const fringe = dilate(glyph, Math.max(1, Math.round(1.5 * dpr)));
      const reach = dilate(glyph, Math.round(6 * dpr));
      const g: number[] = [];
      const b: number[] = [];
      for (const k of order) {
        if (glyph[k]) g.push(k * 4);
        else if (!fringe[k] && reach[k]) b.push(k * 4);
      }
      const px = (i: number | undefined): [number, number, number] => (i === undefined ? [0, 0, 0] : [d[i]!, d[i + 1]!, d[i + 2]!]);
      const ti = g[g.length >> 1];
      const bi = b[Math.min(b.length - 1, Math.floor(b.length * 0.9))];
      const [hi, lo] = [ti === undefined ? 0 : L(ti), bi === undefined ? 0 : L(bi)].sort((p, q) => q - p);
      return { text: px(ti), bg: px(bi), contrast: g.length && b.length ? (hi! + 0.05) / (lo! + 0.05) : 0, glyphs: g.length, pixels: n };
    },
    { b64: png.toString("base64"), t: textRgb, dpr },
  );
}

/** Parse a computed CSS colour (rgb() or color(srgb …)) to 0–255. */
export function cssRgb(v: string): [number, number, number] {
  const m = v.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
  if (m) return [+m[1]!, +m[2]!, +m[3]!];
  const s = v.match(/^color\(srgb\s+([\d.e-]+)\s+([\d.e-]+)\s+([\d.e-]+)/);
  if (s) return [+s[1]! * 255, +s[2]! * 255, +s[3]! * 255].map(Math.round) as [number, number, number];
  throw new Error(`unparsed colour ${v}`);
}
