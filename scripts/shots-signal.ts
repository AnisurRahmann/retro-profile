/**
 * Signal Field review shots (viewport-sized, motion allowed) into .shots/signal-field/.
 * Needs CHAT_MOCK=1 pnpm start -p 3100 (or SHOTS_URL).
 */
import fs from "node:fs";
import { chromium, type Page } from "@playwright/test";

const BASE = process.env.SHOTS_URL ?? "http://localhost:3100";
const OUT = ".shots/signal-field";
const SIZES = [
  { w: 1440, h: 900 },
  { w: 1920, h: 1080 },
];

type State = { name: string; path: string; act: (p: Page, w: number, h: number) => Promise<void>; dpr?: number };
const states: State[] = [
  { name: "idle", path: "/", act: async (p) => p.waitForTimeout(400) },
  { name: "idle-dpr2", path: "/", dpr: 2, act: async (p) => p.waitForTimeout(400) },
  { name: "cursor-left-gutter", path: "/", act: async (p, w, h) => { await p.mouse.move(w * 0.1, h * 0.45, { steps: 8 }); await p.waitForTimeout(450); } },
  { name: "cursor-column", path: "/", act: async (p, w, h) => { await p.mouse.move(w / 2, h * 0.45, { steps: 8 }); await p.waitForTimeout(450); } },
  { name: "click-right-gutter-300ms", path: "/", act: async (p, w, h) => { await p.mouse.click(w * 0.9, h * 0.5); await p.waitForTimeout(300); } },
  {
    name: "chat-mid-stream",
    path: "/chat",
    act: async (p) => {
      await p.getByRole("button", { name: "What's he building right now?" }).click();
      await p.waitForTimeout(260);
    },
  },
];

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  for (const { w, h } of SIZES) {
    for (const s of states) {
      const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: s.dpr ?? 1 });
      await page.goto(BASE + s.path, { waitUntil: "networkidle" });
      await page.waitForFunction(() => document.querySelector("canvas[data-signal-field]")?.getAttribute("style")?.includes("opacity: 1"), null, { timeout: 5000 });
      await page.waitForTimeout(700);
      await s.act(page, w, h);
      const file = `${OUT}/${s.name}-${w}.png`;
      await page.screenshot({ path: file });
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
