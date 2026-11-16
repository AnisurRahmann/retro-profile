// Renders composed objects to PNG for a quick look, without building the site.
// Usage: pnpm exec tsx scripts/illustrations/preview.ts [layout name ...]   (output in .illustrations/preview/)
// "rest" shows the final pose, "all" also shows the parts that only appear in motion.
import { mkdirSync } from "node:fs";
import sharp from "sharp";
import * as compose from "../../src/illustrations/compose";
import type { ObjectLayout, PartNode } from "../../src/illustrations/compose";
import type { IllustrationPaths } from "../../src/schema";
import { PALETTE } from "./types";

const LAYOUTS: Record<string, () => ObjectLayout> = {
  whiteboard: compose.whiteboardLayout,
  bot: compose.botLayout,
  bike: compose.bikeLayout,
  chalk: compose.chalkLayout,
  calendar: compose.calendarLayout,
  bin: compose.binLayout,
  phone: compose.phoneLayout,
  kit: compose.kitLayout,
  lamp: compose.lampLayout,
  pegboard: compose.pegboardLayout,
  window: compose.windowLayout,
};

const style = Object.entries(PALETTE)
  .map(([name, hex]) => `.i-${name}{fill:${hex}}`)
  .join("");

function draw(node: PartNode, paths: IllustrationPaths, all: boolean): string {
  if (node.hidden && !all) return "";
  const own = node.name ? `<g transform="${node.transform ?? ""}">${paths[node.name]!.map(([cls, d]) => `<path class="${cls}" d="${d}"/>`).join("")}</g>` : "";
  const pivot = node.origin && all ? `<circle cx="${node.origin[0]}" cy="${node.origin[1]}" r="4" fill="#FF00FF"/>` : "";
  return `<g>${own}${(node.children ?? []).map((child) => draw(child, paths, all)).join("")}${pivot}</g>`;
}

const wanted = process.argv.slice(2);
mkdirSync(".illustrations/preview", { recursive: true });
for (const [name, build] of Object.entries(LAYOUTS)) {
  if (wanted.length > 0 && !wanted.includes(name)) continue;
  const layout = build();
  const paths = ((await import(`../../src/illustrations/generated/${layout.asset}`)) as Record<string, IllustrationPaths>)[layout.asset]!;
  const pad = 120;
  for (const mode of ["rest", "all"] as const) {
    const body = layout.nodes.map((node) => draw(node, paths, mode === "all")).join("");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-pad} ${-pad} ${layout.width + pad * 2} ${layout.height + pad * 2}" width="${layout.width + pad * 2}" height="${layout.height + pad * 2}" fill-rule="evenodd"><style>${style}</style><rect x="${-pad}" y="${-pad}" width="100%" height="100%" fill="#ddd"/><rect width="${layout.width}" height="${layout.height}" fill="#fff"/>${body}</svg>`;
    await sharp(Buffer.from(svg)).png().toFile(`.illustrations/preview/${name}-${mode}.png`);
  }
  console.log(`${name}: ${layout.width} x ${layout.height}`);
}
