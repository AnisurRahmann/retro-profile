/**
 * Sylhet Sky v4 review shots into .shots/sky-v4/ (OUT= to change), against the test build with mocks:
 *   pnpm build:e2e && CHAT_MOCK=1 WEATHER_MOCK=1 NEXT_DIST_DIR=.next-e2e pnpm start -p 3101
 * Usage: pnpm shots:sky [state-number ...]
 *
 * For 5 states × 375×812 (DPR 2) and 1440×900: the top, mid-cards (On the bench at 40%), the closing scene (the
 * bottom of the page), and three frames of a take-off there (roll 1.4 s, rotation 2.2 s, climb 2.75 s, held with
 * window.__sky.pinPlane). Plus a 6-frame scroll strip on the phone at 16:45 from the stage down to the first card
 * (the horizon hand-over), as frames and a contact sheet (strip-375.png).
 */
import fs from "node:fs";
import { chromium, type Page } from "@playwright/test";

const BASE = process.env.SHOTS_URL ?? "http://localhost:3101";
const OUT = process.env.OUT ?? ".shots/sky-v4";
const only = process.argv.slice(2).map(Number);

const STATES = [
  { n: 1, name: "0620-partly", q: "sky=2026-12-15T06:20&wx=partly" },
  { n: 2, name: "1100-partly", q: "sky=2026-12-15T11:00&wx=partly" },
  { n: 3, name: "1645-clear", q: "sky=2026-12-15T16:45&wx=clear" },
  { n: 4, name: "2030-clear", q: "sky=2026-12-15T20:30&wx=clear" },
  { n: 5, name: "2100-thunder", q: "sky=2026-12-15T21:00&wx=thunder" },
];
const SIZES = [
  { w: 375, h: 812 },
  { w: 1440, h: 900 },
];
const FRAMES = [
  ["roll", 1.4],
  ["rotate", 2.2],
  ["climb", 2.75],
] as const;

type W = Window & { __sky?: { pinPlane?: (s: number | null) => void } };
const to = (page: Page, where: "top" | "mid" | "bottom" | number) =>
  page.evaluate((w) => {
    if (w === "top") window.scrollTo(0, 0);
    else if (w === "bottom") window.scrollTo(0, document.documentElement.scrollHeight);
    else if (w === "mid") {
      const el = document.getElementById("bench")!;
      window.scrollTo(
        0,
        el.getBoundingClientRect().top + window.scrollY - 0.4 * window.innerHeight,
      );
    } else window.scrollTo(0, w);
  }, where);

fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({
  args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"],
});
for (const s of STATES.filter((x) => !only.length || only.includes(x.n))) {
  for (const { w, h } of SIZES) {
    const page = await browser.newPage({
      viewport: { width: w, height: h },
      deviceScaleFactor: w < 640 ? 2 : 1,
    });
    await page.goto(`${BASE}/?${s.q}`, { waitUntil: "networkidle" });
    // Colours transition over 4 s after the weather arrives; backings over 600 ms.
    await page.waitForTimeout(5000);
    const shot = async (spot: string) => {
      const file = `${OUT}/${String(s.n).padStart(2, "0")}-${s.name}-${w}-${spot}.png`;
      await page.screenshot({ path: file });
      console.log(file);
    };
    for (const spot of ["top", "mid", "bottom"] as const) {
      await to(page, spot);
      await page.waitForTimeout(1200);
      await shot(spot === "bottom" ? "closing" : spot);
    }
    // Take-off frames, held at the airport (the arrival has already flown one; this one is pinned).
    await page.waitForTimeout(8000);
    for (const [name, sec] of FRAMES) {
      await page.evaluate((x) => (window as W).__sky?.pinPlane?.(x), sec);
      await page.waitForTimeout(400);
      await shot(`takeoff-${name}`);
    }
    await page.evaluate(() => (window as W).__sky?.pinPlane?.(null));
    await page.close();
  }
}

// The horizon hand-over on a phone: six frames from the stage to the first card, 16:45.
if (!only.length || only.includes(3)) {
  const page = await browser.newPage({
    viewport: { width: 375, height: 812 },
    deviceScaleFactor: 2,
  });
  await page.goto(`${BASE}/?sky=2026-12-15T16:45&wx=clear`, { waitUntil: "networkidle" });
  await page.waitForTimeout(5000);
  const end = await page.evaluate(
    () => document.getElementById("shipped")!.getBoundingClientRect().top + window.scrollY + 120,
  );
  const files: string[] = [];
  for (let i = 0; i < 6; i++) {
    await to(page, Math.round((end * i) / 5));
    await page.waitForTimeout(900);
    const file = `${OUT}/strip-375-${i}.png`;
    await page.screenshot({ path: file });
    files.push(file);
    console.log(file);
  }
  await page.setViewportSize({ width: 6 * 190 + 42, height: 500 });
  const imgs = files
    .map((f) => `<img src="data:image/png;base64,${fs.readFileSync(f).toString("base64")}">`)
    .join("");
  await page.setContent(
    `<style>body{margin:0;background:#222;display:flex;gap:6px;padding:6px}img{width:190px}</style>${imgs}`,
  );
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/strip-375.png`, fullPage: true });
  console.log(`${OUT}/strip-375.png`);
  await page.close();
}
await browser.close();
