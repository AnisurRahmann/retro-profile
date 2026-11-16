import { ColorMode, Hierarchical, PathSimplifyMode, vectorize } from "@neplex/vectorizer";
import potrace from "potrace";
import { maskToPng } from "./io";
import type { Tracer } from "./trace";

/** Potrace (JS port of Peter Selinger's tracer). One compound path per mask, holes by even-odd. */
export const potraceTracer: Tracer = async (mask, width, height) => {
  const png = await maskToPng(mask, width, height);
  return new Promise<string>((resolve, reject) => {
    const tracer = new potrace.Potrace({ turdSize: 25, optTolerance: 0.6, alphaMax: 1, threshold: 128 });
    tracer.loadImage(png, (error: Error | null) => {
      if (error) reject(error);
      else resolve(/ d="([^"]*)"/.exec(tracer.getPathTag())?.[1] ?? "");
    });
  });
};

/** VTracer (visioncortex) in binary mode with spline fitting. Emits one translated path per cluster. */
export const vtracerTracer: Tracer = async (mask, width, height) => {
  const png = await maskToPng(mask, width, height);
  const svg = await vectorize(png, {
    colorMode: ColorMode.Binary,
    hierarchical: Hierarchical.Stacked,
    filterSpeckle: 5,
    colorPrecision: 8,
    layerDifference: 16,
    mode: PathSimplifyMode.Spline,
    cornerThreshold: 60,
    lengthThreshold: 4,
    maxIterations: 2,
    spliceThreshold: 45,
    pathPrecision: 2,
  });
  const parts: string[] = [];
  for (const match of svg.matchAll(/<path d="([^"]*)"[^>]*?transform="translate\(([-\d.]+),([-\d.]+)\)"/g)) {
    const [, d, tx, ty] = match;
    parts.push(shift(d!, Number(tx), Number(ty)));
  }
  return parts.join(" ");
};

function shift(d: string, tx: number, ty: number): string {
  let axis = 0;
  return d
    .replace(/[MLCZ]/g, (command) => ` ${command} `)
    .split(/\s+|,/)
    .filter(Boolean)
    .map((token) => {
      if (/^[MLCZ]$/.test(token)) {
        axis = 0;
        return token;
      }
      const value = Number(token) + (axis % 2 === 0 ? tx : ty);
      axis += 1;
      return String(Math.round(value * 100) / 100);
    })
    .join(" ");
}
