/**
 * Flat clouds review shots: every state of the brief at 1440×900 and 375×812, the top of the home page, into
 * .shots/flat-clouds/ (with manifest.json: the coverage, the cloud count and each header and hero element's backing
 * as the page reported them) and a contact sheet per size. Also the drift: two frames 10 s apart at 11:00 partly
 * with the wind 15 km/h from 270°, and the near layer's drift between them read from the renderer.
 * Needs a dev or test build (the debug hooks): PORT=3101 npx tsx scripts/flat-clouds-shots.ts [--only <name>]
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Page } from "@playwright/test";

const port = process.env.PORT ?? 3101;
const OUT = ".shots/flat-clouds";
const SIZES = [
  { w: 1440, h: 900, dpr: 1 },
  { w: 375, h: 812, dpr: 2 },
];
const STATES: { name: string; q: string; bolt?: boolean }[] = [
  { name: "0620-partly", q: "sky=2026-12-15T06:20&wx=partly" },
  { name: "1100-clear", q: "sky=2026-12-15T11:00&wx=clear" },
  { name: "1100-partly", q: "sky=2026-12-15T11:00&wx=partly" },
  { name: "1400-cloud70", q: "sky=2026-12-15T14:00&wx=partly&cloud=70" },
  { name: "1300-overcast", q: "sky=2026-12-15T13:00&wx=overcast" },
  { name: "1645-partly", q: "sky=2026-12-15T16:45&wx=partly" },
  { name: "1720-partly", q: "sky=2026-12-15T17:20&wx=partly" },
  { name: "2030-partly-moon", q: "sky=2026-12-18T20:30&wx=partly" },
  { name: "1500-drizzle", q: "sky=2026-07-15T15:00&wx=drizzle" },
  { name: "1500-rain", q: "sky=2026-07-15T15:00&wx=rain" },
  { name: "1500-heavy-rain", q: "sky=2026-07-15T15:00&wx=heavy-rain" },
  { name: "1830-thunder-bolt", q: "sky=2026-04-20T18:30&wx=thunder", bolt: true },
  { name: "0700-fog", q: "sky=2026-12-15T07:00&wx=fog" },
];
const IDS = ["monogram", "nav-chat", "nav-work", "nav-lifts", "name", "status", "one-liner", "label", "h-shipped"];
const only = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1] : null;

const ready = (p: Page) => p.waitForFunction("(window.__sky?.frames ?? 0) > 3 && !!window.__sky?.clouds", null, { timeout: 30_000 });
const report = (p: Page) =>
  p.evaluate(`(() => {
    const c = window.__sky.clouds;
    const ids = ${JSON.stringify(IDS)};
    const backing = {};
    for (const id of ids) {
      const el = [...document.querySelectorAll('[data-on-sky="' + id + '"]')].find((e) => e.getClientRects().length > 0);
      backing[id] = el ? el.dataset.backing || "unset" : "absent";
    }
    return { coverage: Math.round(c.coverage() * 1000) / 10, clouds: c.n, off: c.off, backing, t: performance.now() };
  })()`);

mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
const manifest: Record<string, unknown> = {};
for (const s of SIZES) {
  const files: string[] = [];
  const ctx = await b.newContext({ viewport: { width: s.w, height: s.h }, deviceScaleFactor: s.dpr });
  const p = await ctx.newPage();
  for (const st of STATES) {
    if (only && st.name !== only) continue;
    await p.goto(`http://localhost:${port}/?${st.q}`, { waitUntil: "load" });
    await ready(p);
    // The weather eases in over 4 s.
    await p.waitForTimeout(4500);
    if (st.bolt) {
      await p.evaluate(`window.__sky.strike("cg")`);
      await p.waitForTimeout(60);
    }
    const file = join(OUT, `${st.name}-${s.w}x${s.h}.png`);
    await p.screenshot({ path: file });
    files.push(file);
    manifest[`${st.name}-${s.w}`] = await report(p);
  }
  if (!only) {
    // The drift: 10 s at 15 km/h from the west.
    await p.goto(`http://localhost:${port}/?sky=2026-12-15T11:00&wx=partly&wind=15&from=270`, { waitUntil: "load" });
    await ready(p);
    await p.waitForTimeout(4500);
    const a = (await report(p)) as { off: { near: number }; t: number };
    await p.screenshot({ path: join(OUT, `drift-0s-${s.w}x${s.h}.png`) });
    await p.waitForTimeout(10_000);
    const z = (await report(p)) as { off: { near: number }; t: number };
    await p.screenshot({ path: join(OUT, `drift-10s-${s.w}x${s.h}.png`) });
    const sec = (z.t - a.t) / 1000;
    const px = z.off.near - a.off.near;
    manifest[`drift-${s.w}`] = { nearPx: Math.round(px * 10) / 10, seconds: Math.round(sec * 100) / 100, per10s: Math.round((px / sec) * 100) / 10 };
    execFileSync("npx", ["tsx", "scripts/probe/sheet.mts", join(OUT, `sheet-${s.w}.png`), s.w > 600 ? "4" : "7", s.w > 600 ? "480" : "220", ...files]);
  }
  await ctx.close();
}
await b.close();
writeFileSync(join(OUT, only ? `manifest-${only}.json` : "manifest.json"), JSON.stringify(manifest, null, 2));
console.log(JSON.stringify(manifest, null, 1));
