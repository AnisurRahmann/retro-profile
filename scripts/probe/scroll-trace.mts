/**
 * Records a Chrome performance trace while scrolling the home page at 1440×900 (wheel, top to bottom and back)
 * and fails if any main-thread task over 50 ms ran sky code (the renderer, landscape, life, controller chunks).
 * Saves the trace to .shots/sky-v2/scroll-trace.json (open it in DevTools → Performance).
 * Needs a production-like build running: PORT=3101 npx tsx scripts/probe/scroll-trace.mts ["sky=…&wx=…"]
 */
import fs from "node:fs";
import { chromium } from "@playwright/test";

const port = process.env.PORT ?? 3101;
const q = process.argv[2] ?? "sky=2026-12-15T20:30&wx=clear";
const b = await chromium.launch({ args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto(`http://localhost:${port}/?${q}&life=1`, { waitUntil: "networkidle" });
await p.waitForTimeout(3000);
// Which script URLs are sky code? Every chunk that mentions the renderer's markers.
const chunks = await p.evaluate(() => performance.getEntriesByType("resource").map((e) => e.name).filter((n) => n.endsWith(".js")));
const sky: string[] = [];
for (const url of chunks) {
  const src = await (await fetch(url)).text();
  if (/data-sky-landscape|\[sky\] CPU|sky-scrim-ramp|createCloudField|data-sky-takeoff|sky-place/.test(src)) sky.push(url);
}
await b.startTracing(p, { categories: ["devtools.timeline", "disabled-by-default-devtools.timeline", "v8.execute"] });
await p.mouse.move(720, 450);
// Frame rate while scrolling: rAF callbacks and the longest gap between them.
await p.evaluate(`(() => { const w = window; w.__frames = []; const f = (t) => { w.__frames.push(t); if (w.__frames.length < 100000) requestAnimationFrame(f); }; requestAnimationFrame(f); })()`);
for (let pass = 0; pass < 2; pass++) {
  for (let i = 0; i < 40; i++) {
    await p.mouse.wheel(0, pass ? -120 : 120);
    await p.waitForTimeout(40);
  }
}
const fr = (await p.evaluate(`(() => { const a = window.__frames; const gaps = a.slice(1).map((t, i) => t - a[i]); gaps.sort((x, y) => x - y); return { fps: (a.length - 1) / ((a[a.length - 1] - a[0]) / 1000), p95: gaps[Math.floor(gaps.length * 0.95)], max: gaps[gaps.length - 1] }; })()`)) as { fps: number; p95: number; max: number };
await p.waitForTimeout(500);
const buf = await b.stopTracing();
fs.mkdirSync(".shots/sky-v2", { recursive: true });
fs.writeFileSync(".shots/sky-v2/scroll-trace.json", buf);
type Ev = { name: string; ph: string; ts: number; dur?: number; tid: number; pid: number; args?: { data?: { url?: string; frame?: string } } };
const events: Ev[] = (JSON.parse(buf.toString()).traceEvents ?? JSON.parse(buf.toString())) as Ev[];
const main = events.find((e) => e.name === "thread_name" && (e.args as { name?: string } | undefined)?.name === "CrRendererMain");
const onMain = events.filter((e) => !main || (e.pid === main.pid && e.tid === main.tid));
const tasks = onMain.filter((e) => e.name === "RunTask" && e.ph === "X" && (e.dur ?? 0) > 50_000);
const calls = onMain.filter((e) => (e.name === "FunctionCall" || e.name === "EvaluateScript") && e.args?.data?.url);
const bySky = tasks.filter((t) => calls.some((c) => c.ts >= t.ts && c.ts <= t.ts + t.dur! && sky.some((u) => c.args!.data!.url!.includes(new URL(u).pathname))));
const all = onMain.filter((e) => e.name === "RunTask" && e.ph === "X");
const longest = Math.max(0, ...all.map((t) => t.dur ?? 0)) / 1000;
console.log(`scrolling: ${fr.fps.toFixed(1)} fps, frame gap p95 ${fr.p95.toFixed(1)} ms, max ${fr.max.toFixed(1)} ms`);
console.log(`sky chunks: ${sky.map((u) => new URL(u).pathname.split("/").pop()).join(", ")}`);
console.log(`tasks while scrolling: ${all.length}; longest ${longest.toFixed(1)} ms; over 50 ms: ${tasks.length}; over 50 ms running sky code: ${bySky.length}`);
await b.close();
if (bySky.length) process.exit(1);
