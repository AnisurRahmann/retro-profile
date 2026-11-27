/**
 * Volumetric lab review shots (T6): states A–C (BRIEF §7, from LAB_PRESETS) × tiers high/medium/low ×
 * 1440×900 DPR 2 and 375×812 DPR 3, plus two frames of A 10 s apart (wind drift), into
 * .shots/volumetric-lab/run-<ts>/ with a sheet.png contact sheet (an HTML grid screenshotted by Playwright).
 * Needs a dev or test build running (LAB_URL, default http://localhost:$VOL_PORT, else 3005).
 * Usage: pnpm lab:shots [A B C ...]   (states to capture; default all)
 */
import fs from "node:fs";
import { chromium, type Page } from "@playwright/test";
import { LAB_PRESETS, QUALITY_TIERS, type VolDebug } from "../../src/components/sky/volumetric/types";

const BASE = process.env.LAB_URL ?? `http://localhost:${process.env.VOL_PORT ?? 3005}`;
const ids = (process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(LAB_PRESETS)) as (keyof typeof LAB_PRESETS)[];
const now = new Date();
const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
const OUT = process.env.RUN_DIR ?? `.shots/volumetric-lab/run-${stamp}`;

const SIZES = [
  { name: "1440x900", w: 1440, h: 900, dpr: 2 },
  { name: "375x812", w: 375, h: 812, dpr: 3 },
];

const stateQuery = (id: keyof typeof LAB_PRESETS, tier?: string) => {
  const q = new URLSearchParams(Object.entries(LAB_PRESETS[id]).map(([k, v]) => [k, String(v)]));
  if (tier) q.set("tier", tier);
  return q.toString();
};

// The renderer sets window.__vol once it has drawn (frames climbs only while it lives, so a disposed
// StrictMode first instance never satisfies this); error short-circuits the wait.
const waitReady = async (page: Page) => {
  await page.waitForFunction(
    () => {
      const v = (window as { __vol?: VolDebug }).__vol;
      return !!v && (v.error !== null || (v.ready && v.frames > 40));
    },
    { timeout: 120_000, polling: 250 },
  );
  const v = await page.evaluate(() => (window as { __vol?: VolDebug }).__vol);
  if (!v || v.error) throw new Error(`[vol] ${v?.error ?? "renderer did not start"}`);
  return v;
};

fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
type Shot = { file: string; label: string; group: string };
const shots: Shot[] = [];

for (const id of ids) {
  for (const tier of QUALITY_TIERS) {
    for (const size of SIZES) {
      const page = await browser.newPage({
        viewport: { width: size.w, height: size.h },
        deviceScaleFactor: size.dpr,
        isMobile: size.w < 640,
        hasTouch: size.w < 640,
      });
      await page.goto(`${BASE}/lab/clouds?${stateQuery(id, tier)}`, { waitUntil: "load" });
      const v = await waitReady(page);
      // A tier the renderer didn't honour would mislabel the shot.
      if (v.tier !== tier) console.warn(`[vol] ${id}: asked for ${tier}, the renderer runs ${v.tier}`);
      await page.waitForTimeout(300);
      const file = `${OUT}/${id}-${tier}-${size.name}.png`;
      await page.screenshot({ path: file });
      console.log(file);
      shots.push({ file, label: `${id} · ${tier}`, group: size.name });
      await page.close();
    }
  }
}

// Drift: the same live state A ten seconds apart (wind scroll, detail evolution).
if (ids.includes("A")) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  await page.goto(`${BASE}/lab/clouds?${stateQuery("A")}`, { waitUntil: "load" });
  await waitReady(page);
  for (const [name, label, wait] of [
    ["A-drift-0s", "A · 0 s", 0],
    ["A-drift-10s", "A · +10 s", 10_000],
  ] as const) {
    await page.waitForTimeout(wait);
    const file = `${OUT}/${name}.png`;
    await page.screenshot({ path: file });
    console.log(file);
    shots.push({ file, label, group: "A drift (10 s apart)" });
  }
  await page.close();
}

// Contact sheet: every group as a labelled grid of the PNGs above, inlined as data URLs.
const section = (title: string, cells: Shot[], cols: number, width: number) =>
  cells.length
    ? `<h2>${title}</h2><div style="grid-template-columns:repeat(${cols},${width}px)" class="grid">${cells
        .map((s) => `<figure><img src="data:image/png;base64,${fs.readFileSync(s.file).toString("base64")}"><figcaption>${s.label}</figcaption></figure>`)
        .join("")}</div>`
    : "";
const desktop = shots.filter((s) => s.group === "1440x900");
const mobile = shots.filter((s) => s.group === "375x812");
const drift = shots.filter((s) => s.group.startsWith("A drift"));
const sheet = await browser.newPage({ viewport: { width: 3 * 460 + 12 * 6 + 24, height: 800 } });
await sheet.setContent(
  `<style>body{margin:0;background:#222;padding:12px;font:11px monospace;color:#ccc}h2{margin:14px 0 6px;font-size:12px;font-weight:400;color:#fff}.grid{display:grid;gap:6px}figure{margin:0}img{display:block;width:100%}figcaption{padding:3px 0 6px;color:#999}</style>` +
    section("1440×900 DPR 2 — rows A B C, columns high medium low", desktop, 3, 460) +
    section("375×812 DPR 3 — rows A B C, columns high medium low", mobile, 3, 150) +
    section("A drift (10 s apart)", drift, 2, 560),
);
await sheet.waitForTimeout(300);
await sheet.screenshot({ path: `${OUT}/sheet.png`, fullPage: true });
console.log(`${OUT}/sheet.png`);
console.log(`${OUT} — ${shots.length} shots`);
await browser.close();
