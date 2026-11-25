/** Colour math for the sky: sRGB ↔ OKLab, mixing, WCAG contrast and alpha compositing. Pure. */

export type RGB = [number, number, number]; // sRGB, 0..1, gamma-encoded
export type Lab = [number, number, number]; // OKLab L, a, b

export function hexToRgb(hex: string): RGB {
  const n = parseInt(hex.replace("#", "").slice(0, 6), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export function rgbToHex(c: RGB): string {
  return `#${c.map((v) => Math.round(clamp01(v) * 255).toString(16).padStart(2, "0")).join("")}`;
}

export const toLinear = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
export const toGamma = (v: number) => (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055);

export function rgbToOklab([r, g, b]: RGB): Lab {
  const [R, G, B] = [toLinear(r), toLinear(g), toLinear(b)];
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

export function oklabToRgb([L, a, b]: Lab): RGB {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    clamp01(toGamma(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s)),
    clamp01(toGamma(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s)),
    clamp01(toGamma(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)),
  ];
}

export const hexToLab = (hex: string): Lab => rgbToOklab(hexToRgb(hex));
export const labToHex = (c: Lab): string => rgbToHex(oklabToRgb(c));

/** Linear mix in OKLab (t = 0 → a, 1 → b). Keeps twilight saturated where sRGB mixing goes grey. */
export function mixLab(a: Lab, b: Lab, t: number): Lab {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/** Scale lightness by (1 + k): k = 0.1 raises L by 10%, k = −0.08 drops it by 8%. */
export function scaleL([L, a, b]: Lab, k: number): Lab {
  return [Math.min(1, L * (1 + k)), a, b];
}

/** Move k of the way toward the neutral grey of equal OKLab lightness. */
export function desaturate([L, a, b]: Lab, k: number): Lab {
  return [L, a * (1 - k), b * (1 - k)];
}

/** WCAG 2 relative luminance. */
export function luminance([r, g, b]: RGB): number {
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

export function contrast(x: RGB, y: RGB): number {
  const [hi, lo] = [luminance(x), luminance(y)].sort((m, n) => n - m) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** `top` painted at alpha `a` over `bottom`, as browsers composite (in gamma-encoded sRGB). */
export function over(bottom: RGB, top: RGB, a: number): RGB {
  return [bottom[0] + (top[0] - bottom[0]) * a, bottom[1] + (top[1] - bottom[1]) * a, bottom[2] + (top[2] - bottom[2]) * a];
}
