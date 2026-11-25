/**
 * Quick review shots against a running build: npx tsx scripts/probe/before.mts <out-prefix> [query] [sizes]
 * Shoots top, mid-cards (#bench at 40%), the closer, and the very bottom of the home page.
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const BASE = process.env.SHOTS_URL ?? "http://localhost:3101";
const prefix = process.argv[2] ?? ".shots/sky-v4/before";
const q = process.argv[3] ?? "sky=2026-12-15T16:45&wx=clear";
const sizes = (process.argv[4] ?? "375x812,1440x900")
  .split(",")
  .map((s) => s.split("x").map(Number) as [number, number]);
fs.mkdirSync(path.dirname(prefix), { recursive: true });
const b = await chromium.launch({
  args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"],
});
for (const [w, h] of sizes) {
  const p = await b.newPage({
    viewport: { width: w, height: h },
    deviceScaleFactor: w < 640 ? 2 : 1,
  });
  p.on("pageerror", (e) => console.log("pageerror", e.message));
  await p.goto(`${BASE}/?${q}`, { waitUntil: "networkidle" });
  await p.waitForTimeout(5000);
  for (const spot of ["top", "bench", "closer", "bottom"]) {
    await p.evaluate((id) => {
      if (id === "top") window.scrollTo(0, 0);
      else if (id === "bottom") window.scrollTo(0, document.documentElement.scrollHeight);
      else {
        const el = document.getElementById(id)!;
        window.scrollTo(
          0,
          el.getBoundingClientRect().top + window.scrollY - 0.4 * window.innerHeight,
        );
      }
    }, spot);
    await p.waitForTimeout(1500);
    const file = `${prefix}-${w}-${spot}.png`;
    await p.screenshot({ path: file });
    console.log(file);
  }
  await p.close();
}
await b.close();
