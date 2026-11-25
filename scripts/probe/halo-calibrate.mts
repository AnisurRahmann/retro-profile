/**
 * Halo calibration for src/lib/sky/backing.ts (HALO_CURVE): what a text-shadow halo at alpha a is "worth" as an
 * --ink alpha k, measured exactly as the pixel gate measures it (tests/e2e/pixels.ts measureBox: the
 * 90th-percentile pixel of the glyphs' surround, 1.5–6 CSS px from a glyph).
 * The sky is replaced by flat colours (the canvases hidden), the backing frozen, and every loose-text element on
 * the home page set to halo a ∈ {0, .25, .5, .75, 1}. k = the ink alpha over the flat colour that gives the measured
 * background luminance. Per size bucket, the minimum k over colours and elements (conservative).
 * Needs the test build on :3101. Usage: node --experimental-strip-types scripts/probe/halo-calibrate.mts
 */
import { chromium, type Page } from "@playwright/test";
import { cssRgb, luminance, measureBox } from "../../tests/e2e/pixels.ts";

const BASE = process.env.SHOTS_URL ?? "http://localhost:3101";
const FLATS = ["#2a548a", "#a3682e", "#5b7fb0", "#c88a3c"];
const AS = [0, 0.25, 0.5, 0.75, 1];
const INK: [number, number, number] = [11, 18, 32];
const hex = (h: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
const bucket = (px: number) => (px <= 13 ? 1 : px <= 20 ? 2 : 3);

/** k such that luminance(flat + (ink − flat)·k) = L (sRGB compositing, like the browser). */
function inkFor(flat: [number, number, number], L: number): number {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 30; i++) {
    const k = (lo + hi) / 2;
    const c = flat.map((v, j) => v + (INK[j]! - v) * k) as [number, number, number];
    if (luminance(c) > L) lo = k;
    else hi = k;
  }
  return (lo + hi) / 2;
}

const out: Record<number, Record<number, number[]>> = { 1: {}, 2: {}, 3: {} };
const browser = await chromium.launch({ args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
for (const { w, h, dpr } of [
  { w: 1440, h: 900, dpr: 1 },
  { w: 375, h: 812, dpr: 2 },
]) {
  const page: Page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: dpr });
  // tsx (esbuild keepNames) wraps functions passed to evaluate() in __name().
  await page.addInitScript("globalThis.__name = (f) => f");
  await page.goto(`${BASE}/?sky=2026-12-15T11:00&wx=clear`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => ((window as { __sky?: { backing?: unknown[] } }).__sky?.backing?.length ?? 0) > 3, null, { timeout: 15000 });
  await page.evaluate(() => (document.documentElement.dataset.backingFreeze = ""));
  for (const flat of FLATS) {
    await page.addStyleTag({
      content: `.sky-gradient{background:${flat}!important;transition:none!important}[data-sky-atmosphere],[data-sky-particles],[data-sky-landscape],.grain{display:none!important}[data-sky-glyph]{visibility:hidden!important}`,
    });
    for (const a of AS) {
      await page.evaluate((a) => {
        document.querySelectorAll<HTMLElement>("[data-on-sky]").forEach((el) => {
          el.dataset.backing = a ? "halo" : "none";
          el.style.setProperty("--halo-a", String(a));
          el.style.transition = "none";
        });
      }, a);
      await page.waitForTimeout(150);
      const els = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>("[data-on-sky]")]
          .map((el) => {
            const r = el.getBoundingClientRect();
            const cs = getComputedStyle(el);
            return { id: el.dataset.onSky!, x: r.left, y: r.top, w: r.width, h: r.height, color: cs.color, px: parseFloat(cs.fontSize) };
          })
          .filter((e) => e.w > 4 && e.h > 4 && e.y >= 0 && e.y + e.h <= innerHeight && e.x >= 0 && e.x + e.w <= innerWidth),
      );
      for (const e of els) {
        if (e.id === "status") continue; // typing animation: its glyphs change between shots
        const png = await page.screenshot({ clip: { x: e.x, y: e.y, width: e.w, height: e.h } });
        const m = await measureBox(page, png, cssRgb(e.color), dpr);
        if (m.glyphs < 10) continue;
        const k = inkFor(hex(flat), luminance(m.bg));
        ((out[bucket(e.px)]![a] ??= []) as number[]).push(k);
        if (process.env.VERBOSE) console.log(w, flat, a, e.id, e.px, k.toFixed(3), m.contrast.toFixed(2));
      }
    }
  }
  await page.close();
}
await browser.close();
for (const b of [1, 2, 3]) {
  const row = AS.map((a) => {
    const ks = out[b]![a] ?? [];
    return `${a}: min ${Math.min(...ks).toFixed(3)} med ${ks.sort((p, q) => p - q)[ks.length >> 1]?.toFixed(3)} (n ${ks.length})`;
  });
  console.log(`bucket ${b}: ${row.join(" | ")}`);
}
