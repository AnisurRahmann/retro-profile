/**
 * Sky keyframes, indexed by sun elevation (degrees). The only hex colours outside globals.css (see CLAUDE.md).
 * Retune only with tests/unit/sky-contrast.test.ts green: every value must keep the column text readable.
 * Dawn and dusk share zenith and mid; only the horizon differs.
 */
export type SkyKeyframe = { elev: number; zenith: string; mid: string; dawn: string; dusk: string };

export const SKY_KEYFRAMES: SkyKeyframe[] = [
  { elev: -18, zenith: "#060B16", mid: "#0A1120", dawn: "#0F1A2E", dusk: "#0F1A2E" }, // night
  { elev: -12, zenith: "#070D1A", mid: "#0D162A", dawn: "#16223C", dusk: "#16223C" }, // astronomical
  { elev: -6, zenith: "#0A1426", mid: "#13223F", dawn: "#2A3766", dusk: "#352B52" }, // nautical
  { elev: 0, zenith: "#0F2042", mid: "#22396A", dawn: "#A96253", dusk: "#C86800" }, // sunrise / sunset (tuned, see DECISIONS)
  { elev: 8, zenith: "#132B55", mid: "#284C82", dawn: "#B68253", dusk: "#C6812D" }, // golden (tuned)
  { elev: 25, zenith: "#10264A", mid: "#1C3D70", dawn: "#2E5A92", dusk: "#2E5A92" }, // day, deep blue
];

/** Warm star tint (8% of stars). */
export const STAR_WARM = "#FFE2B8";
/** Cool star white. */
export const STAR_COOL = "#E4ECFF";

/** Sun disc by altitude (interpolated in OKLab): ≥ 30°, 10°, 0°. */
export const SUN_HIGH = "#FFF6E0";
export const SUN_MID = "#FFD58A";
export const SUN_LOW = "#FF9B4A";
/** Lit windows in the city at night. */
export const WINDOW_LIT = "#FFD9A0";
/** Night light pollution over the city: warm sodium, at the horizon behind the landscape (sunset → sunrise). */
export const CITY_GLOW = "#E8A15A";
/** Cool white TV light in a few windows, flickering gently. */
export const TV_LIT = "#CFDDFF";
/**
 * Landscape layers before lighting (src/lib/sky/landscape/colors.ts): far hills slate-blue, tea gardens deep tea-green
 * (and the bush rows on them), the town, the near ground. Each keeps its own hue; the horizon only hazes it.
 */
export const LAND_L1 = "#2B3550";
export const LAND_L2 = "#1E2E28";
export const LAND_TEA_ROWS = "#24372F";
export const LAND_L3 = "#171D2A";
export const LAND_L4 = "#0C1018";
/** Runway lights: the threshold (green) and the far end (red); the plane's red beacon uses the same red. */
export const RWY_GREEN = "#62E08E";
export const RWY_RED = "#FF5A4E";
