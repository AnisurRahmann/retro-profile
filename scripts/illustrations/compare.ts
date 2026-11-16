// Tracer comparison. Usage: pnpm exec tsx scripts/illustrations/compare.ts [asset id]
// Traces every part of one sheet with both tracers, then reports nodes, bytes and fidelity
// (intersection over union between the traced layers, rendered back to pixels, and the masks they came from).
import { mkdirSync, writeFileSync } from "node:fs";
import sharp from "sharp";
import { optimise } from "./optimise";
import { keyAndSplit, listSources, partsFor, preparePart, readMap, UPSCALE } from "./sheet";
import { countNodes, planLayers, transformPath, type Tracer } from "./trace";
import { potraceTracer, vtracerTracer } from "./tracers";
import { PALETTE, type Layer } from "./types";

const id = process.argv[2] ?? "a02";
const source = listSources().find((entry) => entry.id === id);
const map = readMap(id);
if (!source || !map) throw new Error(`compare: no sheet or no parts map for ${id}`);

async function overlap(d: string, mask: Uint8Array, width: number, height: number): Promise<[both: number, either: number]> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" shape-rendering="crispEdges"><path fill-rule="evenodd" d="${d}"/></svg>`;
  const rendered = await sharp(Buffer.from(svg)).ensureAlpha().extractChannel("alpha").raw().toBuffer();
  let both = 0;
  let either = 0;
  for (let i = 0; i < mask.length; i += 1) {
    const a = rendered[i]! > 127;
    const b = mask[i] === 1;
    if (a && b) both += 1;
    if (a || b) either += 1;
  }
  return [both, either];
}

const sheet = await keyAndSplit(source.file);
const parts = partsFor(sheet, map);
const tracers: [string, Tracer][] = [
  ["potrace", potraceTracer],
  ["vtracer", vtracerTracer],
];
mkdirSync(".illustrations/compare", { recursive: true });
for (const [name, tracer] of tracers) {
  let nodes = 0;
  let bytes = 0;
  let worst = 1;
  let bothTotal = 0;
  let eitherTotal = 0;
  let layersTotal = 0;
  const preview: string[] = [];
  for (const part of parts) {
    const prepared = await preparePart(sheet, part);
    const { width, height } = prepared.large;
    const layers: Layer[] = [];
    for (const { cls, mask } of planLayers(prepared.snapped.classes, width, height)) {
      const d = await tracer(mask, width, height);
      if (!d) continue;
      const [both, either] = await overlap(d, mask, width, height);
      // tiny accent layers swing wildly on a few pixels: the worst case is only tracked for real shapes
      if (either > 2000) worst = Math.min(worst, both / either);
      bothTotal += both;
      eitherTotal += either;
      layersTotal += 1;
      layers.push({ cls, d: transformPath(d, 1 / UPSCALE) });
    }
    const optimised = optimise(layers, prepared.raster.width, prepared.raster.height);
    nodes += optimised.paths.reduce((total, [, d]) => total + countNodes(d), 0);
    bytes += optimised.bytes;
    const fills = optimised.paths.map(([cls, d]) => `<path fill="${PALETTE[cls.slice(2) as keyof typeof PALETTE]}" d="${d}"/>`).join("");
    preview.push(`<g transform="translate(${prepared.box.x},${prepared.box.y})" fill-rule="evenodd">${fills}</g>`);
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${sheet.source.width} ${sheet.source.height}"><rect width="100%" height="100%" fill="#8a8f98"/>${preview.join("")}</svg>`;
  writeFileSync(`.illustrations/compare/${id}-${name}.svg`, svg);
  await sharp(Buffer.from(svg), { density: 144 }).png().toFile(`.illustrations/compare/${id}-${name}.png`);
  console.log(`${name}: ${nodes} nodes, ${bytes} bytes, area-weighted IoU ${(bothTotal / eitherTotal).toFixed(4)}, worst layer IoU ${worst.toFixed(4)}, ${layersTotal} layers`);
}
