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
  { elev: 0, zenith: "#0F2042", mid: "#22396A", dawn: "#B9786A", dusk: "#D9813A" }, // sunrise / sunset
  { elev: 8, zenith: "#132B55", mid: "#284C82", dawn: "#C99A70", dusk: "#D99A55" }, // golden
  { elev: 25, zenith: "#10264A", mid: "#1C3D70", dawn: "#2E5A92", dusk: "#2E5A92" }, // day, deep blue
];

/** Warm star tint (8% of stars). */
export const STAR_WARM = "#FFE2B8";
/** Cool star white. */
export const STAR_COOL = "#E4ECFF";
