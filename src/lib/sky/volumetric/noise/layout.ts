/**
 * Where the ?debug=noise view draws its eight tiles (owner T1): pure, so the test can check it. noise-gpu.ts hands the
 * rects to the shader (as uv, y up) and lays the captions out on them (CSS px).
 */
import { BLUE_SIZE } from "./recipes";

/** The tiles, in the shader's order: SHAPE's R, G, B, A, DETAIL's R, G, B, then BLUE. */
export const SLICE_TILES = [
  "SHAPE R",
  "SHAPE G",
  "SHAPE B",
  "SHAPE A",
  "DETAIL R",
  "DETAIL G",
  "DETAIL B",
  `BLUE ${BLUE_SIZE}²`,
] as const;
export const TILE_COUNT = SLICE_TILES.length;

/** A square tile: the top-left corner of its texture in buffer px (y down) and its side (0 when there is no room). */
export type Tile = { x: number; y: number; size: number };

export type SliceLayout = {
  tiles: Tile[];
  /** (x0, y0, x1, y1) per tile in uv, y up: the shader's uNzTiles. */
  uv: Float32Array;
  /** Height of the caption line above each tile, buffer px. */
  caption: number;
};

/** Metrics in CSS px. */
const MARGIN = 16;
const GAP = 12;
const CAPTION = 20;
/** Room under the grid for the z slider. */
const FOOTER = 72;
const MIN_TILE = 24;

/**
 * The grid for a drawing buffer of `width` × `height` buffer px at `scale` buffer px per CSS px: four columns when
 * there is room for a 160 px tile that way, else two. Tiles are square and as large as the margins, captions, gaps
 * and footer allow; with no room at all they are empty.
 */
export function sliceLayout(width: number, height: number, scale: number): SliceLayout {
  const s = Math.max(scale, 1e-3);
  const columns = width / s >= 4 * 160 + 3 * GAP + 2 * MARGIN ? 4 : 2;
  const rows = TILE_COUNT / columns;
  const margin = Math.round(MARGIN * s);
  const gap = Math.round(GAP * s);
  const caption = Math.round(CAPTION * s);
  const footer = Math.round(FOOTER * s);
  const across = width - 2 * margin - (columns - 1) * gap;
  const down = height - 2 * margin - footer - rows * caption - (rows - 1) * gap;
  const room = Math.floor(Math.min(across / columns, down / rows));
  const size = room >= MIN_TILE * s ? room : 0;
  const tiles: Tile[] = [];
  for (let i = 0; i < TILE_COUNT; i++) {
    const c = i % columns;
    const r = Math.floor(i / columns);
    tiles.push({
      x: margin + c * (size + gap),
      y: margin + r * (size + caption + gap) + caption,
      size,
    });
  }
  const uv = new Float32Array(TILE_COUNT * 4);
  tiles.forEach((t, i) =>
    uv.set(
      [t.x / width, 1 - (t.y + t.size) / height, (t.x + t.size) / width, 1 - t.y / height],
      i * 4,
    ),
  );
  return { tiles, uv, caption };
}
