/**
 * cloudAtSun (owner T5): where the forced cumulus cell goes so it covers the sun (or the moon at night), or puts its
 * edge on it. See WeatherMapParams.forcedCell and WeatherMap.offset in src/components/sky/volumetric/types.ts.
 * renderer.ts calls this on every state change and once a second (the field drifts with the wind); setParams
 * regenerates the map only when the result changes. PLACEHOLDER (T0): no cell.
 */
import type { LabScene, LabState, Vec2, WeatherMapParams } from "@/components/sky/volumetric/types";

export function forcedCellFor(state: LabState, scene: LabScene, offset: Vec2): WeatherMapParams["forcedCell"] {
  void state;
  void scene;
  void offset;
  return undefined;
}
