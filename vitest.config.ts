import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src"), "server-only": path.resolve(import.meta.dirname, "tests/unit/empty.ts") } },
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "tests/unit/**/*.test.ts", "tests/unit/**/*.test.tsx", "tests/build/**/*.test.ts", "evals/**/*.test.ts"],
    environment: "node",
  },
});
