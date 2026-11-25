/**
 * Hex mirrors of the CSS tokens, for contexts that can't read CSS variables
 * (next/og images, the favicon, theme-color). A test asserts they match globals.css.
 */
export const brand = {
  ink: "#0b1220",
  surface: "#111a2b",
  surface2: "#172236",
  hairline: "#22304a",
  text: "#e6eaf2",
  graphite: "#8a96ad",
  signal: "#f5a524",
} as const;
