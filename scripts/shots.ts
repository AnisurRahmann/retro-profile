/**
 * Full-page screenshots at 360 / 768 / 1440 into .shots/.
 * Expects the app running (pnpm build && CHAT_MOCK=1 pnpm start -p 3100) or set SHOTS_URL.
 * The chat mid-conversation shot uses the mocked model (CHAT_MOCK=1).
 */
import fs from "node:fs";
import { chromium, type Page } from "@playwright/test";

const BASE = process.env.SHOTS_URL ?? "http://localhost:3100";
const WIDTHS = [360, 768, 1440];
const OUT = ".shots";
const only = process.argv.slice(2);

type Shot = { name: string; path: string; prepare?: (page: Page) => Promise<void> };

const shots: Shot[] = [
  { name: "home", path: "/" },
  {
    name: "home-expanded",
    path: "/",
    prepare: async (page) => {
      for (const b of await page.locator("button[aria-controls]").all()) await b.click();
      await page.waitForTimeout(300);
    },
  },
  { name: "chat-empty", path: "/chat" },
  {
    name: "chat-mid",
    path: "/chat",
    prepare: async (page) => {
      await page.getByRole("button", { name: "I'm hiring an AI engineer" }).click();
      await page.getByTestId("agent-done").last().waitFor({ timeout: 15_000 });
      await page.getByRole("textbox").fill("Tell me how the Support Agent worked");
      await page.keyboard.press("Enter");
      await page.waitForFunction(() => document.querySelectorAll('[data-testid="agent-done"]').length >= 2, null, {
        timeout: 15_000,
      });
      await page.waitForTimeout(200);
    },
  },
  { name: "work", path: "/work/support-agent" },
  { name: "lifts", path: "/lifts" },
  { name: "privacy", path: "/privacy" },
];

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  for (const shot of shots) {
    if (only.length && !only.includes(shot.name)) continue;
    for (const width of WIDTHS) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
      await page.goto(BASE + shot.path, { waitUntil: "networkidle" });
      if (shot.prepare) await shot.prepare(page);
      const file = `${OUT}/${shot.name}-${width}.png`;
      await page.screenshot({ path: file, fullPage: true });
      console.log(file);
      await page.close();
    }
  }
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
