/**
 * Evaluate an expression on the home page: npx tsx scripts/probe/eval.mts "<query>" "<js expression>" [WxH] [scrollY]
 */
import { chromium } from "@playwright/test";

const BASE = process.env.SHOTS_URL ?? "http://localhost:3101";
const [q = "", expr = "1", size = "375x812", scroll = "0"] = process.argv.slice(2);
const [w, h] = size.split("x").map(Number) as [number, number];
const b = await chromium.launch({
  args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"],
});
const p = await b.newPage({
  viewport: { width: w, height: h },
  deviceScaleFactor: w < 640 ? 2 : 1,
});
p.on("pageerror", (e) => console.log("pageerror", e.message));
p.on(
  "console",
  (m) => (m.type() === "error" || m.type() === "warning") && console.log("console", m.text()),
);
await p.goto(`${BASE}/?${q}`, { waitUntil: "networkidle" });
await p.waitForTimeout(4000);
await p.evaluate((y) => window.scrollTo(0, y), Number(scroll));
await p.waitForTimeout(1200);
console.log(JSON.stringify(await p.evaluate(expr), null, 1));
await b.close();
