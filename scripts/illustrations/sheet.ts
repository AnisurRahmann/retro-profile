import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { readRaster, upscale } from "./io";
import { key } from "./key";
import { nameParts, partsMapSchema, type NamedPart, type PartsMap } from "./name";
import { snap, type SnapResult } from "./snap";
import { extract, split, type SplitResult } from "./split";
import type { Box, Raster } from "./types";

export const RAW_DIR = "assets/illustrations/raw";
export const MAP_DIR = "assets/illustrations/parts";
/** parts are enlarged this many times before classification and tracing */
export const UPSCALE = 3;

export interface Source {
  id: string;
  file: string;
}

/** Raw sheets, by id. a00 is the style anchor (it has a real background) and is never processed. */
export function listSources(): Source[] {
  return readdirSync(RAW_DIR)
    .map((file) => ({ file, id: /^(a\d{2}b?)-.+\.png$/.exec(file)?.[1] }))
    .filter((entry): entry is Source => Boolean(entry.id) && entry.id !== "a00")
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function readMap(id: string): PartsMap | null {
  const path = join(MAP_DIR, `${id}.json`);
  if (!existsSync(path)) return null;
  return partsMapSchema.parse(JSON.parse(readFileSync(path, "utf8")));
}

export interface KeyedSheet {
  source: Raster;
  keyed: Raster;
  background: number;
  split: SplitResult;
}

export async function keyAndSplit(file: string): Promise<KeyedSheet> {
  const source = await readRaster(join(RAW_DIR, file));
  const { image, background } = key(source);
  return { source, keyed: image, background, split: split(image) };
}

export interface PreparedPart {
  part: NamedPart;
  /** the part's box on the source sheet, padding included */
  box: Box;
  /** keyed cut-out at source resolution */
  raster: Raster;
  /** enlarged cut-out and its palette classes */
  large: Raster;
  snapped: SnapResult;
}

export async function preparePart(sheet: KeyedSheet, part: NamedPart): Promise<PreparedPart> {
  const { raster, box } = extract(sheet.keyed, sheet.split.labels, part.components);
  const large = await upscale(raster, UPSCALE);
  return { part, box, raster, large, snapped: snap(large) };
}

export function partsFor(sheet: KeyedSheet, map: PartsMap): NamedPart[] {
  return nameParts(sheet.split.components, map);
}
