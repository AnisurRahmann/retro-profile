/**
 * Walk the landscape: npx tsx scripts/probe/walk.mts "sky=…&wx=…" [shipped,bench,closer] against a running server.
 * Scrolls so each section's top sits at 40% of the viewport (its landmark centred) and screenshots.
 */
import { chromium } from "@playwright/test";
const port = process.env.PORT ?? 3000;
const b = await chromium.launch({ args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
const w = Number(process.env.W ?? 1440);
const h = Number(process.env.H ?? 900);
const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: w < 640 ? 2 : 1 });
p.on("pageerror", (e) => console.log("pageerror", e.message));
const q = process.argv[2] ?? "sky=2026-12-15T16:45&wx=clear";
await p.goto(`http://localhost:${port}/?${q}`, { waitUntil: "load" });
await p.waitForTimeout(4000);
// HIDE=1: hide the content and the scrim to look at the landscape alone.
if (process.env.HIDE) await p.addStyleTag({ content: "main, footer, header, .sky-scrim { visibility: hidden !important }" });
for (const id of (process.argv[3] ?? "shipped,closer").split(",")) {
  await p.evaluate((id) => {
    const el = document.getElementById(id) ?? document.querySelector(id);
    if (el) window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 0.4 * window.innerHeight);
  }, id);
  await p.waitForTimeout(1200);
  const file = `.shots/sky/walk${process.env.HIDE ? "-bare" : ""}-${q.replace(/[^a-z0-9]+/gi, "_")}-${id.replace(/\W/g, "")}-${w}.png`;
  // BAND=1: only the bottom 240px (the landscape band).
  await p.screenshot({ path: file, clip: process.env.BAND ? { x: 0, y: h - 240, width: w, height: 240 } : undefined });
  console.log(file, await p.locator("[data-testid=sky-place] [data-active]").innerText().catch(() => ""));
}
await b.close();
