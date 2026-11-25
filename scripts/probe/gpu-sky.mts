/**
 * GPU and CPU ms/frame of the sky (atmosphere GPU time via EXT_disjoint_timer_query_webgl2 on the real GPU through
 * ANGLE Metal; CPU = the renderer's main-thread time per frame: atmosphere uniforms, particles, sun, landscape,
 * life). Needs a dev or test build running (default :3101).
 * Usage: STATE="sky=...&wx=..." W=1920 H=1080 DPR=2 [SCROLL=1] npx tsx scripts/probe/gpu-sky.mts
 * SCROLL=1 scrolls the page continuously while measuring (the 60fps path with parallax).
 */
import { chromium } from "@playwright/test";
const port = process.env.PORT ?? 3101;
const dpr = Number(process.env.DPR ?? 2);
const w = Number(process.env.W ?? 1920);
const h = Number(process.env.H ?? 1080);
const q = process.env.STATE ?? "sky=2026-12-15T16:45&wx=clear";
const scale = process.env.SCALE ? `&skyscale=${process.env.SCALE}` : "";
const b = await chromium.launch({ args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, isMobile: w < 640, hasTouch: w < 640 });
const gpu: number[] = [];
const cpu: string[] = [];
let size = "";
p.on("console", (m) => {
  const g = m.text().match(/\[sky\] GPU ([\d.]+) ms\/frame at (\S+)/);
  if (g) {
    gpu.push(Number(g[1]));
    size = g[2]!;
  }
  const c = m.text().match(/\[sky\] CPU ([\d.]+) ms\/frame \(max ([\d.]+)\)/);
  if (c) cpu.push(`${c[1]} (max ${c[2]})`);
});
await p.goto(`http://localhost:${port}/?${q}${scale}`, { waitUntil: "networkidle" });
if (process.env.SCROLL)
  void p.evaluate(`(() => { let d = 6; const f = () => { scrollBy(0, d); if (scrollY + innerHeight >= document.documentElement.scrollHeight - 2 || scrollY <= 0) d = -d; requestAnimationFrame(f); }; requestAnimationFrame(f); })()`);
const t0 = Date.now();
while ((gpu.length < 6 || cpu.length < 4) && Date.now() - t0 < 60_000) await p.waitForTimeout(500);
console.log(`${q}${scale} ${w}×${h} DPR ${dpr}${process.env.SCROLL ? " scrolling" : ""} atmosphere ${size}`);
console.log(`  GPU ${gpu.map((s) => s.toFixed(3)).join(" ")} ms`);
console.log(`  CPU ${cpu.join(" · ")} ms`);
await b.close();
