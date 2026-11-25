/**
 * The airport close up: npx tsx scripts/probe/airport.mts <out-prefix> [query] [WxH,…] [pin seconds,…]
 * Scrolls to the bottom of the home page, holds the plane (window.__sky.pinPlane; −1 = parked) and shoots the
 * bottom 300px.
 */
import { chromium } from "@playwright/test";

const BASE = process.env.SHOTS_URL ?? "http://localhost:3101";
const [
  prefix = ".shots/sky-v4/wip/airport",
  q = "sky=2026-12-15T16:45&wx=clear",
  sizes = "375x812,1440x900",
  pins = "-1",
] = process.argv.slice(2);
const b = await chromium.launch({
  args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"],
});
for (const size of sizes.split(",")) {
  const [w, h] = size.split("x").map(Number) as [number, number];
  const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  p.on("pageerror", (e) => console.log("pageerror", e.message));
  await p.goto(`${BASE}/?${q}`, { waitUntil: "networkidle" });
  await p.waitForTimeout(4000);
  await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await p.waitForTimeout(1000);
  for (const s of pins.split(",").map(Number)) {
    await p.evaluate(
      (x) => (window as unknown as { __sky: { pinPlane: (n: number) => void } }).__sky.pinPlane(x),
      s,
    );
    await p.waitForTimeout(400);
    const file = `${prefix}-${w}-${s}.png`;
    await p.screenshot({
      path: file,
      clip: { x: 0, y: h - (w < 640 ? 560 : 300), width: w, height: w < 640 ? 400 : 300 },
    });
    console.log(file);
  }
  await p.close();
}
await b.close();
