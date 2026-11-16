import sharp from "sharp";
import type { Raster } from "./types";

/** Decodes by content, not by extension: Gemini exports are often JPEG data in a .png file. */
export async function readRaster(path: string): Promise<Raster> {
  const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, data: new Uint8Array(data.buffer, data.byteOffset, data.byteLength) };
}

export function toSharp(raster: Raster) {
  return sharp(Buffer.from(raster.data.buffer, raster.data.byteOffset, raster.data.byteLength), {
    raw: { width: raster.width, height: raster.height, channels: 4 },
  });
}

/** Enlarges a keyed part before classification, so traced edges are fitted on more than a few pixels. */
export async function upscale(raster: Raster, factor: number): Promise<Raster> {
  const { data, info } = await toSharp(raster)
    .resize(raster.width * factor, raster.height * factor, { kernel: "cubic" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, data: new Uint8Array(data.buffer, data.byteOffset, data.byteLength) };
}

/** Binary mask (1 is ink) to a PNG, black ink on white: the input format both tracers accept. */
export async function maskToPng(mask: Uint8Array, width: number, height: number): Promise<Buffer> {
  const grey = Buffer.alloc(width * height);
  for (let i = 0; i < mask.length; i += 1) grey[i] = mask[i] ? 0 : 255;
  return sharp(grey, { raw: { width, height, channels: 1 } }).png().toBuffer();
}
