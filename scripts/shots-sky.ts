/**
 * Sylhet Sky review shots: 10 states × 1440×900 and 375×812, for / and /chat (empty), into .shots/sky/.
 * Needs the test build running with mocks (debug overrides are on in test builds):
 *   pnpm build:e2e && CHAT_MOCK=1 WEATHER_MOCK=1 NEXT_DIST_DIR=.next-e2e pnpm start -p 3101
 * Usage: pnpm shots:sky [state-number ...]
 */
import fs from "node:fs";
import { chromium } from "@playwright/test";

const BASE = process.env.SHOTS_URL ?? "http://localhost:3101";
const OUT = ".shots/sky";
const only = process.argv.slice(2).map(Number);

const STATES = [
  { n: 1, name: "0200-clear", q: "sky=2026-12-15T02:00&wx=clear" },
  { n: 2, name: "0545-clear", q: "sky=2026-12-15T05:45&wx=clear" },
  { n: 3, name: "0625-partly", q: "sky=2026-12-15T06:25&wx=partly" },
  { n: 4, name: "1100-clear", q: "sky=2026-12-15T11:00&wx=clear" },
  { n: 5, name: "1430-overcast-ne15", q: "sky=2026-12-15T14:30&wx=overcast&wind=15&from=45", drift: true },
  { n: 6, name: "1655-clear", q: "sky=2026-12-15T16:55&wx=clear" },
  { n: 7, name: "1735-clear", q: "sky=2026-12-15T17:35&wx=clear" },
  { n: 8, name: "2100-thunder", q: "sky=2026-12-15T21:00&wx=thunder&bolt=1" },
  { n: 9, name: "0700-fog", q: "sky=2026-12-15T07:00&wx=fog" },
  { n: 10, name: "0621-1200-rain", q: "sky=2026-06-21T12:00&wx=rain" },
];
const SIZES = [
  { w: 1440, h: 900 },
  { w: 375, h: 812 },
];

fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
for (const s of STATES.filter((x) => !only.length || only.includes(x.n))) {
  for (const { w, h } of SIZES) {
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: w < 640 ? 2 : 1 });
    for (const path of ["/", "/chat"]) {
      await page.goto(`${BASE}${path}?${s.q}`, { waitUntil: "networkidle" });
      // Colours and scrim transition over 4 s after the weather arrives.
      await page.waitForTimeout(5000);
      const file = `${OUT}/${String(s.n).padStart(2, "0")}-${s.name}-${path === "/" ? "home" : "chat"}-${w}.png`;
      await page.screenshot({ path: file });
      if (s.drift && path === "/" && w === 1440) {
        await page.waitForTimeout(1000);
        await page.screenshot({ path: file.replace(".png", "-t1s.png") });
      }
      console.log(file);
    }
    await page.close();
  }
}
await browser.close();
