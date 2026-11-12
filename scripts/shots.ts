/**
 * Screenshot matrix for visual review.
 *   pnpm build && pnpm shots
 * Captures the full page and each sheet at 360 / 768 / 1440 px, in PAPER and
 * BLUEPRINT, with redlines ON and OFF, into .shots/ (gitignored).
 * Starts `next start` on port 3100 if nothing is listening there.
 *
 * Optional args: widths, e.g. `pnpm shots 360 1440`.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import { chromium } from "@playwright/test";

const PORT = 3100;
const BASE = `http://localhost:${PORT}`;
const OUT = ".shots";
const args = process.argv.slice(2).map(Number).filter(Boolean);
const WIDTHS = args.length > 0 ? args : [360, 768, 1440];
const THEMES = ["paper", "blueprint"] as const;
const REDLINES = ["on", "off"] as const;

async function up(): Promise<boolean> {
  try {
    const res = await fetch(BASE);
    return res.ok;
  } catch {
    return false;
  }
}

async function ensureServer(): Promise<ChildProcess | null> {
  if (await up()) return null;
  const child = spawn("pnpm", ["exec", "next", "start", "-p", String(PORT)], { stdio: "ignore" });
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 500));
    if (await up()) return child;
  }
  child.kill();
  throw new Error("next start did not come up. Run `pnpm build` first.");
}

const server = await ensureServer();
await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();

try {
  for (const width of WIDTHS) {
    for (const theme of THEMES) {
      for (const redlines of REDLINES) {
        const context = await browser.newContext({
          viewport: { width, height: width < 700 ? 780 : 900 },
          deviceScaleFactor: 1,
        });
        await context.addInitScript(
          ([t, r]) => {
            window.localStorage.setItem("ds-theme", t as string);
            window.localStorage.setItem("ds-redlines", r as string);
          },
          [theme, redlines],
        );
        const page = await context.newPage();
        await page.goto(BASE, { waitUntil: "networkidle" });
        await page.evaluate(() => document.fonts.ready);
        // Walk the page so every sheet has been "in view" and its drawing animation has finished.
        const height = await page.evaluate(() => document.documentElement.scrollHeight);
        for (let y = 0; y < height; y += 500) {
          await page.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), y);
          await page.waitForTimeout(60);
        }
        await page.waitForTimeout(2200);
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
        await page.waitForTimeout(150);
        const name = `${width}-${theme}-rl${redlines}`;
        await page.screenshot({ path: `${OUT}/${name}-full.png`, fullPage: true });
        // Sheet crops: hide the fixed frame so it is not stitched into the middle of a tall sheet.
        // Also freeze every drafting animation in its finished state: Playwright resizes the
        // viewport for tall element shots, which would otherwise restart them mid-capture.
        await page.addStyleTag({
          content:
            ".bar,.frame,.sheet-tag,.skip{visibility:hidden!important}" +
            "*,*::before,*::after{animation:none!important}" +
            ".sheet-body{opacity:1!important}" +
            ".sheet-border rect,.redline .draw,.redline.draw,.dim-main{stroke-dashoffset:0!important}",
        });
        const sheets = page.locator("section.sheet");
        const count = await sheets.count();
        for (let i = 0; i < count; i++) {
          await sheets.nth(i).screenshot({ path: `${OUT}/${name}-sheet-0${i}.png` });
        }
        await context.close();
        console.log(`shot ${name}`);
      }
    }
  }
} finally {
  await browser.close();
  server?.kill();
}
