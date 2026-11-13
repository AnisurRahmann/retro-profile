import { defineConfig } from "@playwright/test";

const PORT = 4173;

export default defineConfig({
  testDir: "tests/shots",
  fullyParallel: true,
  reporter: "line",
  use: { baseURL: `http://localhost:${PORT}` },
  webServer: {
    command: `node scripts/serve-out.mjs ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
  },
});
