/**
 * GPU ms/frame of the sky atmosphere (EXT_disjoint_timer_query_webgl2, real GPU via ANGLE Metal).
 * Needs a dev or test build running (default :3101). Usage: STATE="sky=...&wx=..." DPR=2 SCALE=0.5 npx tsx scripts/probe/gpu-sky.mts
 */
import { chromium } from "@playwright/test";
const port = process.env.PORT ?? 3101;
const dpr = Number(process.env.DPR ?? 2);
const q = process.env.STATE ?? "sky=2026-12-15T14:30&wx=overcast&wind=15&from=45";
const scale = process.env.SCALE ? `&skyscale=${process.env.SCALE}` : "";
const b = await chromium.launch({ args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: dpr });
const samples: number[] = [];
let size = "";
p.on("console", (m) => {
  const hit = m.text().match(/\[sky\] GPU ([\d.]+) ms\/frame at (\S+)/);
  if (hit) { samples.push(Number(hit[1])); size = hit[2]!; }
});
await p.goto(`http://localhost:${port}/lifts?${q}${scale}`, { waitUntil: "networkidle" });
const t0 = Date.now();
while (samples.length < 6 && Date.now() - t0 < 40_000) await p.waitForTimeout(500);
console.log(`${q}${scale} DPR ${dpr} canvas ${size}: ${samples.map((s) => s.toFixed(3)).join(" ")} ms`);
await b.close();
