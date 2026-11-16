/** Shared types for the illustration pipeline. Every stage is a pure function over these. */

/** RGBA raster, 4 bytes per pixel, row-major. */
export interface Raster {
  width: number;
  height: number;
  data: Uint8Array;
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Component {
  /** position in reading order, the number drawn on the contact sheet */
  index: number;
  /** label value in the label map */
  label: number;
  box: Box;
  area: number;
  cx: number;
  cy: number;
}

export const PALETTE = {
  chalk: "#F4F1EA",
  iron: "#17181A",
  grey: "#B9B4A8",
  tan: "#C89B6D",
  red: "#D62828",
  blue: "#1D4E89",
  yellow: "#F2B705",
  green: "#2A9D5C",
  skin: "#B9794F",
} as const;

export type PaletteName = keyof typeof PALETTE;
export const PALETTE_NAMES = Object.keys(PALETTE) as PaletteName[];
export const KEY_COLOUR = "#FF00FF";
export const OUTLINE: PaletteName = "iron";

/** One traced layer: a palette class and SVG path data in part pixel units. */
export interface Layer {
  cls: PaletteName;
  d: string;
}
