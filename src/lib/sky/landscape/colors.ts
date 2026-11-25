/**
 * Landscape colours (shared by the renderer and the backing model). Each layer = mix(horizon, near, depth) in
 * OKLab with depths 0.25 / 0.45 / 0.7 / 0.95, near = --ink darkened 15%.
 */
import { brand } from "../../brand";
import { hexToLab, mixLab, scaleL, type Lab } from "../color";
import type { LayerId } from "./anchors";

export const DEPTH: Record<LayerId, number> = { L1: 0.25, L2: 0.45, L3: 0.7, L4: 0.95 };
/** Near colour: --ink darkened 15% (OKLab L × 0.85). */
export const NEAR: Lab = scaleL(hexToLab(brand.ink), -0.15);

export const layerColor = (horizon: Lab, layer: LayerId): Lab => mixLab(horizon, NEAR, DEPTH[layer]);
/** The river reflects the sky: lighter than the hills behind it (horizon mixed 30% toward near). */
export const riverColor = (horizon: Lab): Lab => mixLab(horizon, NEAR, 0.3);
