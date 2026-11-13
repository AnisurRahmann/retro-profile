import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const config = [
  { ignores: [".next/**", "out/**", "build/**", "design-system/**", "node_modules/**", "next-env.d.ts", ".shots/**"] },
  ...nextVitals,
  ...nextTs,
  {
    // Static export with plain anchors: every page is a full document load, so the boot script
    // in <head> (theme, today's weekday) always runs. No client router involved.
    rules: {
      "@next/next/no-html-link-for-pages": "off",
      "@next/next/no-location-assign-relative-destination": "off",
    },
  },
];

export default config;
