/**
 * The gate for per-element backing: what the browser actually paints. For 8 sky states × 3 scroll positions at
 * 1440×900 (DPR 1) and 375×812 (DPR 2), every loose-text element ([data-on-sky]) fully in view is screenshotted
 * and measured (tests/e2e/pixels.ts measureBox: median glyph pixel vs the 90th-percentile pixel of the glyphs'
 * surround). The shot is the box grown by the chip's footprint (1px × 6px), so an icon's surround is in it too.
 * Every element must reach 4.5:1. The worst five are printed.
 * Reduced motion: a static frame, no status-line rotation or fades mid-shot; backing and sky are otherwise the same.
 */
import { expect, test } from "@playwright/test";
import { cssRgb, measureBox } from "./pixels";

const STATES = [
  "sky=2026-12-15T06:20&wx=partly",
  "sky=2026-12-15T11:00&wx=partly",
  "sky=2026-12-15T16:45&wx=clear",
  "sky=2026-12-15T17:20&wx=clear",
  "sky=2026-12-15T20:30&wx=clear",
  "sky=2026-12-15T23:30&wx=clear",
  "sky=2026-12-15T14:00&wx=heavy-rain",
  "sky=2026-12-15T21:00&wx=thunder",
];
const SIZES = [
  { width: 1440, height: 900, dpr: 1 },
  { width: 375, height: 812, dpr: 2 },
];
const SPOTS = ["top", "shipped", "closer"] as const;

type Row = { where: string; id: string; mode: string; contrast: number; text: string; bg: string };
const hex = (c: number[]) =>
  `#${c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;

test.describe.configure({ mode: "parallel" });

for (const size of SIZES) {
  test(`loose text reaches 4.5:1 in every state at ${size.width}`, async ({ browser }) => {
    test.setTimeout(300_000);
    const ctx = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      deviceScaleFactor: size.dpr,
      reducedMotion: "reduce",
    });
    const page = await ctx.newPage();
    const rows: Row[] = [];
    for (const q of STATES) {
      await page.goto(`/?${q}`);
      await page.waitForFunction(
        () => (window.__sky?.backing?.length ?? 0) > 3 && (window.__sky?.frames ?? 0) > 0,
        null,
        { timeout: 15_000 },
      );
      await page.addStyleTag({ content: "[data-sky-glyph]{visibility:hidden!important}" });
      // The weather lands and the gradient eases over 4 s.
      await page.waitForTimeout(4500);
      for (const spot of SPOTS) {
        if (spot === "top") await page.evaluate(() => window.scrollTo(0, 0));
        else
          await page.evaluate((id) => {
            const el = document.getElementById(id)!;
            window.scrollTo(
              0,
              el.getBoundingClientRect().top + window.scrollY - 0.4 * window.innerHeight,
            );
          }, spot);
        // Scroll throttle (8 Hz), the static redraw (150 ms) and a frame.
        await page.waitForTimeout(700);
        const els = await page.evaluate(() =>
          [...document.querySelectorAll<HTMLElement>("[data-on-sky]")]
            .map((el) => {
              const r = el.getBoundingClientRect();
              const cs = getComputedStyle(el);
              return {
                id: el.dataset.onSky!,
                mode: el.dataset.backing ?? "default",
                x: r.left,
                y: r.top,
                w: r.width,
                h: r.height,
                color: cs.color,
                vis: cs.visibility,
                op: Number(cs.opacity),
              };
            })
            .filter(
              (e) =>
                e.vis === "visible" &&
                e.op > 0.99 &&
                e.w > 4 &&
                e.h > 4 &&
                e.y >= 0 &&
                e.y + e.h <= innerHeight &&
                e.x >= 0 &&
                e.x + e.w <= innerWidth,
            ),
        );
        for (const e of els) {
          const x = Math.max(0, e.x - 6);
          const y = Math.max(0, e.y - 1);
          const clip = {
            x,
            y,
            width: Math.min(size.width, e.x + e.w + 6) - x,
            height: Math.min(size.height, e.y + e.h + 1) - y,
          };
          const png = await page.screenshot({ clip });
          const m = await measureBox(page, png, cssRgb(e.color), size.dpr);
          if (m.glyphs < 6) continue; // nothing drawn (an empty slot)
          rows.push({
            where: `${q} ${size.width} ${spot}`,
            id: e.id,
            mode: e.mode,
            contrast: Math.round(m.contrast * 100) / 100,
            text: hex(m.text),
            bg: hex(m.bg),
          });
        }
      }
    }
    await ctx.close();
    rows.sort((a, b) => a.contrast - b.contrast);
    console.info(
      `[backing ${size.width}] ${rows.length} measurements; worst 5:\n${rows
        .slice(0, 5)
        .map(
          (r) =>
            `  ${r.contrast.toFixed(2)}:1  ${r.id} (${r.mode}) text ${r.text} on ${r.bg} at ${r.where}`,
        )
        .join("\n")}`,
    );
    expect(rows.length).toBeGreaterThan(40);
    expect(rows.filter((r) => r.contrast < 4.5)).toEqual([]);
  });
}
