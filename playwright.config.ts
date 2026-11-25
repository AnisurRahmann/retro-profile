import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3101);
export const DISABLED_PORT = PORT + 1;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  reporter: "list",
  use: { baseURL: `http://localhost:${PORT}` },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: `next start -p ${PORT}`,
      url: `http://localhost:${PORT}`,
      reuseExistingServer: false,
      env: { CHAT_MOCK: "1", CHAT_ENABLED: "true", WEATHER_MOCK: "1", NEXT_DIST_DIR: ".next-e2e" },
      timeout: 60_000,
    },
    {
      // Same build, chat switched off: the kill-switch state (tests/e2e/chat-disabled.spec.ts).
      command: `next start -p ${DISABLED_PORT}`,
      url: `http://localhost:${DISABLED_PORT}`,
      reuseExistingServer: false,
      env: { CHAT_MOCK: "1", CHAT_ENABLED: "false", WEATHER_MOCK: "1", NEXT_DIST_DIR: ".next-e2e" },
      timeout: 60_000,
    },
  ],
});
