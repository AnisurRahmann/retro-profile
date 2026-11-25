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
