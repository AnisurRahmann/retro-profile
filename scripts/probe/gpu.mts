import { chromium } from "@playwright/test";
const args = process.argv.slice(2);
const b = await chromium.launch({ headless: true, args });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: Number(process.env.DPR ?? 2) });
const logs: string[] = [];
p.on("console", (m) => { if (m.text().includes("[signal-field]")) logs.push(m.text()); });
await p.goto("http://localhost:3000/", { waitUntil: "networkidle" });
const info = await p.evaluate(() => {
  const gl = document.createElement("canvas").getContext("webgl2");
  const dbg = gl?.getExtension("WEBGL_debug_renderer_info");
  return { renderer: dbg ? gl!.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : "?", timer: !!gl?.getExtension("EXT_disjoint_timer_query_webgl2") };
});
console.log(args.join(" ") || "(default)", info);
for (let i = 0; i < 40; i++) { await p.mouse.move(100 + i * 40, 400 + (i % 5) * 20); await p.mouse.click(1800, 500); await p.waitForTimeout(120); }
console.log(logs.slice(-4).join("\n") || "no [signal-field] logs");
await b.close();
