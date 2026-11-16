import { optimize, type Config } from "svgo";
import type { Layer } from "./types";

/** Fixed SVGO configuration: one decimal, no ids, classes and viewBox kept. */
export const SVGO_CONFIG: Config = {
  multipass: true,
  floatPrecision: 1,
  plugins: [
    {
      name: "preset-default",
      params: {
        overrides: {
          inlineStyles: false,
          convertPathData: { floatPrecision: 1, transformPrecision: 1 },
          cleanupIds: { remove: true, minify: true },
        },
      },
    },
    "removeDimensions",
  ],
};

export interface OptimisedPart {
  svg: string;
  viewBox: string;
  /** class and path data per layer, bottom first, read back from the optimised file */
  paths: [cls: string, d: string][];
  bytes: number;
}

/** Stage f. Builds the part's SVG (viewBox is the part's own box) and runs SVGO over it. */
export function optimise(layers: Layer[], width: number, height: number): OptimisedPart {
  const viewBox = `0 0 ${width} ${height}`;
  const body = layers.map((layer) => `<path class="i-${layer.cls}" d="${layer.d}"/>`).join("");
  const raw = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${width}" height="${height}" fill-rule="evenodd">${body}</svg>`;
  const svg = optimize(raw, SVGO_CONFIG).data;
  const paths: [string, string][] = [];
  for (const match of svg.matchAll(/<path\b([^>]*)\/>/g)) {
    const attrs = match[1]!;
    const cls = /class="([^"]*)"/.exec(attrs)?.[1];
    const d = /\bd="([^"]*)"/.exec(attrs)?.[1];
    if (!cls || !d) throw new Error(`optimise: a path lost its class or data: ${match[0].slice(0, 80)}`);
    paths.push([cls, d]);
  }
  // SVGO drops layers that collapse to nothing at one decimal: fewer paths is fine, more is a bug
  if (paths.length === 0 || paths.length > layers.length) throw new Error(`optimise: ${layers.length} layers went in, ${paths.length} paths came out`);
  if (/\bid=/.test(svg)) throw new Error("optimise: an id survived");
  return { svg, viewBox, paths, bytes: Buffer.byteLength(svg) };
}
