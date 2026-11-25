/**
 * Dev-only GPU timing for the Signal Field (needs `pnpm dev` on :3000).
 * Usage: DPR=2 SCALE=1.5 LOAD=busy|rest npx tsx scripts/probe/gpu.mts
 * Uses the real GPU via ANGLE Metal; the default headless SwiftShader has no timer query.
 */
import { chromium } from "@playwright/test";
const dpr = Number(process.env.DPR ?? 2);
const scale = process.env.SCALE;
const load = process.env.LOAD ?? "busy";
const b = await chromium.launch({ args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: dpr });
const samples: number[] = [];
let size = "";
p.on("console", (m) => {
  const hit = m.text().match(/\[signal-field\] GPU ([\d.]+) ms\/frame at (\S+)/);
  if (hit) { samples.push(Number(hit[1])); size = hit[2]!; }
});
await p.goto(`http://localhost:3000/lifts${scale ? `?sfscale=${scale}` : ""}`, { waitUntil: "networkidle" });
await p.waitForTimeout(1500);
for (let i = 0; i < 60; i++) {
  if (load === "busy") { await p.mouse.move(100 + (i % 40) * 40, 400 + (i % 5) * 20); await p.mouse.click(1800, 500); }
  await p.waitForTimeout(load === "busy" ? 120 : 250);
}
const s = samples.slice(1);
console.log(`DPR ${dpr} scale ${scale ?? "default"} ${load}: ${s.map((x) => x.toFixed(2)).join(", ")} ms/frame @ ${size}`);
await b.close();
