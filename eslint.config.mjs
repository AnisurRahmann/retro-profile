import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const config = [
  ...nextVitals,
  ...nextTs,
  {
    ignores: [".next/**", ".next-e2e/**", ".next-dev/**", ".next-*/**", "out/**", "node_modules/**", "next-env.d.ts", ".shots/**", "test-results/**", "playwright-report/**", ".scratch/**"],
  },
];

export default config;
