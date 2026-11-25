/** Quick sky look against a running server: npx tsx scripts/probe/quick.mts "sky=2026-12-15T02:00&wx=clear,..." [path] */
import { chromium } from "@playwright/test";
const port = process.env.PORT ?? 3000;
const b = await chromium.launch({ args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
const p = await b.newPage({ viewport: { width: Number(process.env.W ?? 1440), height: Number(process.env.H ?? 900) } });
p.on("console", (m) => { if (m.type() === "error" || m.text().includes("[sky]")) console.log(m.type(), m.text()); });
p.on("pageerror", (e) => console.log("pageerror", e.message));
for (const q of (process.argv[2] ?? "sky=2026-12-15T16:55&wx=clear").split(",")) {
  await p.goto(`http://localhost:${port}${process.argv[3] ?? "/"}?${q}`, { waitUntil: "load" });
  await p.waitForTimeout(Number(process.env.WAIT ?? 5000));
  await p.screenshot({ path: `.shots/sky/quick-${q.replace(/[^a-z0-9]+/gi, "_")}.png` });
}
await b.close();
