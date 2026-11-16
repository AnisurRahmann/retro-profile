// The illustration pipeline. Usage: pnpm illustrations [asset id ...]
// raw sheet -> key -> split (+ contact sheet) -> name -> snap -> trace -> optimise -> manifest
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { writeContactSheet } from "./contact";
import { toSharp } from "./io";
import { assetMeta, manifestModule, pathsModule, spriteFile, type AssetMeta, type PartMeta } from "./manifest";
import { optimise } from "./optimise";
import { keyAndSplit, listSources, MAP_DIR, partsFor, preparePart, readMap, UPSCALE, type Source } from "./sheet";
import { trace, transformPath } from "./trace";
import { potraceTracer } from "./tracers";

const OUT_DIR = "src/illustrations/generated";
const PUBLIC_DIR = "public/illustrations";
const WORK_DIR = ".illustrations";
/** heavier than this, gzipped, and an object is shipped as keyed WebP cut-outs instead of SVG */
const MAX_OBJECT_GZIP = 40 * 1024;

async function processSheet(source: Source): Promise<"done" | "skipped" | "pending"> {
  const sheet = await keyAndSplit(source.file);
  const contact = join(WORK_DIR, "contact", `${source.id}.png`);
  await writeContactSheet(sheet.source, sheet.split.components, contact);
  console.log(`${source.id}: ${(sheet.background * 100).toFixed(1)}% background, ${sheet.split.components.length} components (${sheet.split.dropped} specks dropped), contact sheet ${contact}`);

  const map = readMap(source.id);
  if (!map) {
    for (const component of sheet.split.components) console.log(`   ${component.index}: ${JSON.stringify(component.box)} area ${component.area}`);
    // keyed and split fine, but nobody has named the parts yet: not an error, the object simply stays a placeholder
    console.warn(`${source.id}: PENDING, no parts map. Look at ${contact} and write ${join(MAP_DIR, `${source.id}.json`)}.`);
    return "pending";
  }
  if (map.rejected) {
    console.warn(`${source.id}: REJECTED, nothing emitted. ${map.rejected}`);
    return "skipped";
  }

  const dir = join(OUT_DIR, source.id);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const metas: PartMeta[] = [];
  const svgs: string[] = [];
  const modules: { name: string; paths: [string, string][] }[] = [];
  const cutouts: { name: string; webp: Buffer }[] = [];
  const report: Record<string, unknown> = {};
  for (const part of partsFor(sheet, map)) {
    const prepared = await preparePart(sheet, part);
    const layers = (await trace(prepared.snapped.classes, prepared.large.width, prepared.large.height, potraceTracer)).map((layer) => ({
      ...layer,
      d: transformPath(layer.d, 1 / UPSCALE),
    }));
    const { width, height } = prepared.raster;
    const optimised = optimise(layers, width, height);
    if (prepared.snapped.far.length > 0) {
      report[part.name] = prepared.snapped.far;
      for (const region of prepared.snapped.far) {
        console.warn(`   off palette: ${part.name} has ${(region.share * 100).toFixed(1)}% ${region.colour}, ${region.distance} from ${region.cls} (snapped to it)`);
      }
    }
    metas.push({ name: part.name, viewBox: optimised.viewBox, width, height, origin: [prepared.box.x, prepared.box.y], pivot: part.pivot, z: part.z, bytes: optimised.bytes });
    svgs.push(optimised.svg);
    modules.push({ name: part.name, paths: optimised.paths });
    cutouts.push({ name: part.name, webp: await toSharp(prepared.large).webp({ quality: 82, alphaQuality: 90 }).toBuffer() });
  }

  const gzip = gzipSync(Buffer.from(svgs.join(""))).byteLength;
  let meta: AssetMeta;
  rmSync(join(PUBLIC_DIR, source.id), { recursive: true, force: true });
  if (gzip > MAX_OBJECT_GZIP) {
    // fallback: the trace is too heavy, ship keyed cut-outs. Theme swap for this object is then a CSS filter.
    mkdirSync(join(PUBLIC_DIR, source.id), { recursive: true });
    for (const cutout of cutouts) writeFileSync(join(PUBLIC_DIR, source.id, `${cutout.name}.webp`), cutout.webp);
    meta = assetMeta(source.id, source.file, "webp", metas.map((part, index) => ({ ...part, bytes: cutouts[index]!.webp.byteLength })), cutouts.map((cutout) => cutout.webp));
    rmSync(join(OUT_DIR, `${source.id}.ts`), { force: true });
    console.warn(`${source.id}: traced SVG is ${(gzip / 1024).toFixed(1)} kB gzipped, over ${MAX_OBJECT_GZIP / 1024} kB. Emitted WebP cut-outs instead.`);
  } else {
    metas.forEach((part, index) => writeFileSync(join(dir, `${part.name}.svg`), svgs[index]!));
    writeFileSync(join(OUT_DIR, `${source.id}.ts`), pathsModule(source.id, modules));
    // the same parts as a sprite, for objects the page loads with <use> instead of inlining
    mkdirSync(PUBLIC_DIR, { recursive: true });
    writeFileSync(join(PUBLIC_DIR, `${source.id}.svg`), spriteFile(modules));
    meta = assetMeta(source.id, source.file, "svg", metas, svgs);
  }
  writeFileSync(join(dir, "meta.json"), `${JSON.stringify(meta, null, 2)}\n`);
  mkdirSync(join(WORK_DIR, "report"), { recursive: true });
  writeFileSync(join(WORK_DIR, "report", `${source.id}.json`), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`${source.id}: ${meta.parts.length} parts as ${meta.format}, ${(meta.bytes / 1024).toFixed(1)} kB, ${(meta.gzipBytes / 1024).toFixed(1)} kB gzipped`);
  return "done";
}

const wanted = process.argv.slice(2);
const sources = listSources().filter((source) => wanted.length === 0 || wanted.includes(source.id));
const missing = wanted.filter((id) => !sources.some((source) => source.id === id));
if (missing.length > 0) throw new Error(`no raw sheet for: ${missing.join(", ")}`);
mkdirSync(join(WORK_DIR, "contact"), { recursive: true });
mkdirSync(OUT_DIR, { recursive: true });

const failures: string[] = [];
for (const source of sources) {
  try {
    await processSheet(source);
  } catch (error) {
    failures.push(error instanceof Error ? error.message : String(error));
    console.error(`FAILED ${failures[failures.length - 1]}`);
  }
}

// the manifest always lists every emitted object, also when one id was processed
const assets = readdirSync(OUT_DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && existsSync(join(OUT_DIR, entry.name, "meta.json")))
  .map((entry) => JSON.parse(readFileSync(join(OUT_DIR, entry.name, "meta.json"), "utf8")) as AssetMeta);
writeFileSync(join(OUT_DIR, "manifest.ts"), manifestModule(assets));
console.log(`manifest: ${assets.map((asset) => asset.id).join(", ")}`);
if (failures.length > 0) process.exit(1);
