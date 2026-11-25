/**
 * Sylhet Sky v2 review shots: 8 states × 1440×900 and 375×812 × three scroll positions (top, "Shipped" with
 * Keane Bridge centred, the closer with the airport) of the home page, into .shots/sky-v2/.
 * Needs the test build running with mocks (debug overrides are on in test builds):
 *   pnpm build:e2e && CHAT_MOCK=1 WEATHER_MOCK=1 NEXT_DIST_DIR=.next-e2e pnpm start -p 3101
 * Usage: pnpm shots:sky [state-number ...]
 * `life=1` brings the birds, the night plane and the rickshaw in at once so the review sees them.
 */
import fs from "node:fs";
import { chromium } from "@playwright/test";

const BASE = process.env.SHOTS_URL ?? "http://localhost:3101";
const OUT = ".shots/sky-v2";
const only = process.argv.slice(2).map(Number);

const STATES = [
  { n: 1, name: "0620-sunrise-partly", q: "sky=2026-12-15T06:20&wx=partly" },
  { n: 2, name: "1100-partly", q: "sky=2026-12-15T11:00&wx=partly" },
  { n: 3, name: "1645-clear", q: "sky=2026-12-15T16:45&wx=clear" },
  { n: 4, name: "1720-civil-dusk", q: "sky=2026-12-15T17:20&wx=clear" },
  { n: 5, name: "2030-clear", q: "sky=2026-12-15T20:30&wx=clear" },
  { n: 6, name: "2330-clear", q: "sky=2026-12-15T23:30&wx=clear" },
  { n: 7, name: "1400-heavy-rain", q: "sky=2026-12-15T14:00&wx=heavy-rain" },
  { n: 8, name: "2100-thunder", q: "sky=2026-12-15T21:00&wx=thunder" },
];
const SIZES = [
  { w: 1440, h: 900 },
  { w: 375, h: 812 },
];
const SPOTS = ["top", "shipped", "closer"] as const;

fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
for (const s of STATES.filter((x) => !only.length || only.includes(x.n))) {
  for (const { w, h } of SIZES) {
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: w < 640 ? 2 : 1 });
    await page.goto(`${BASE}/?${s.q}&life=1`, { waitUntil: "networkidle" });
    // Colours and scrims transition over 4 s after the weather arrives.
    await page.waitForTimeout(5000);
    for (const spot of SPOTS) {
      if (spot !== "top")
        await page.evaluate((id) => {
          const el = document.getElementById(id)!;
          window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 0.4 * window.innerHeight);
        }, spot);
      await page.waitForTimeout(1200);
      const file = `${OUT}/${String(s.n).padStart(2, "0")}-${s.name}-${w}-${spot}.png`;
      await page.screenshot({ path: file });
      console.log(file);
    }
    await page.close();
  }
}
await browser.close();
