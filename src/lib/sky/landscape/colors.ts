/**
 * Landscape colours (shared by the renderer and the backing model).
 *
 * Each layer is anchored to its own hue (palette LAND_*: slate-blue far hills, tea-green gardens, the town, the
 * near ground) and only hazed toward the current horizon colour, by HAZE (atmospheric perspective: far things
 * more; under the brief's caps 0.35 / 0.22 / 0.12 / 0.04, tuned down in review so dusk hills stay blue-green). Then the light: lightness × sunLight (night 0.55, golden hour 0.9, day 1.1). Golden hour adds a
 * warm wash on the far hills only (0.12, under the brief's 0.18 cap); the rest of its light is the 1px rim (landscape.ts). So at 16:45 the
 * hills stay hills with tea gardens, not ochre dunes.
 */
import { hexToLab, mixLab, type Lab } from "../color";
import { LAND_L1, LAND_L2, LAND_L3, LAND_L4, LAND_TEA_ROWS } from "../palette";
import type { LayerId } from "./anchors";

export const LAYER_BASE: Record<LayerId, string> = {
  L1: LAND_L1,
  L2: LAND_L2,
  L3: LAND_L3,
  L4: LAND_L4,
};
/** The most of the horizon colour each layer takes (far → near). */
export const HAZE: Record<LayerId, number> = { L1: 0.26, L2: 0.18, L3: 0.12, L4: 0.04 };
/** The golden-hour warm wash on the far hills, at most. */
export const WASH_MAX = 0.12;

const lerp = (a: number, b: number, t: number) => a + (b - a) * Math.min(1, Math.max(0, t));
/** Lightness multiplier from the sun's elevation: 0.55 at night (≤ −6°), 0.9 at golden hour (0–8°), 1.1 by day (≥ 20°). */
export function sunLight(elevationDeg: number): number {
  if (elevationDeg <= -6) return 0.55;
  if (elevationDeg < 0) return lerp(0.55, 0.9, (elevationDeg + 6) / 6);
  if (elevationDeg <= 8) return 0.9;
  return lerp(0.9, 1.1, (elevationDeg - 8) / 12);
}

/** How a layer is lit: the horizon colour, the lightness multiplier (sunLight) and the far hills' warm wash. */
export type LandLight = { horizon: Lab; k?: number; wash?: number };

const scale = ([L, a, b]: Lab, k: number): Lab => [Math.min(1, L * k), a, b];
const lift = ([L, a, b]: Lab, d: number): Lab => [Math.min(1, L + d), a, b];
const baseLab = (hex: string, horizon: Lab, haze: number, k: number) =>
  scale(mixLab(hexToLab(hex), horizon, haze), k);

/** A layer's colour: its base hazed toward the horizon, lit, and (L1) washed warm at golden hour. */
export function layerColor(horizon: Lab, layer: LayerId, k = 1, wash = 0): Lab {
  const c = baseLab(LAYER_BASE[layer], horizon, HAZE[layer], k);
  return layer === "L1" && wash > 0 ? mixLab(c, horizon, Math.min(WASH_MAX, wash)) : c;
}
export const layerColorLit = (l: LandLight, layer: LayerId) =>
  layerColor(l.horizon, layer, l.k ?? 1, l.wash ?? 0);

/** The tea bush rows on L2: their own green, hazed like the hills, then +0.06 OKLab L over the hill so they read. */
export function teaRowColor(l: LandLight): Lab {
  const hill = layerColorLit(l, "L2");
  const row = baseLab(LAND_TEA_ROWS, l.horizon, HAZE.L2, l.k ?? 1);
  return [hill[0] + 0.06, row[1], row[2]];
}

/** The near ground under L4's things: L4 a touch lighter (+0.03 OKLab L). */
export const groundColor = (l: LandLight): Lab => lift(layerColorLit(l, "L4"), 0.03);

/** The river reflects the sky: lighter than the hills behind it (the horizon, 30% of the way to the near ground). */
export const riverColor = (horizon: Lab): Lab => mixLab(horizon, hexToLab(LAND_L4), 0.3);
