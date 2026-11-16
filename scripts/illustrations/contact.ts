import { toSharp } from "./io";
import type { Component, Raster } from "./types";

/** SVG overlay for the contact sheet: one box and one index per component. Pure, so it can be tested. */
export function contactOverlay(width: number, height: number, components: Component[]): string {
  const size = Math.max(14, Math.round(height / 40));
  const marks = components
    .map(({ index, box }) => {
      const labelY = box.y > size + 4 ? box.y - 4 : box.y + box.h + size;
      return (
        `<rect x="${box.x - 1}" y="${box.y - 1}" width="${box.w + 2}" height="${box.h + 2}" fill="none" stroke="#00E5FF" stroke-width="2"/>` +
        `<rect x="${box.x - 1}" y="${labelY - size + 2}" width="${String(index).length * size * 0.62 + 6}" height="${size}" fill="#000"/>` +
        `<text x="${box.x + 2}" y="${labelY}" font-family="Menlo, monospace" font-size="${size}" font-weight="700" fill="#00E5FF">${index}</text>`
      );
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${marks}</svg>`;
}

/** Stage b output for humans: the source sheet with every component boxed and numbered. */
export async function writeContactSheet(source: Raster, components: Component[], path: string): Promise<void> {
  await toSharp(source)
    .composite([{ input: Buffer.from(contactOverlay(source.width, source.height, components)) }])
    .png()
    .toFile(path);
}
