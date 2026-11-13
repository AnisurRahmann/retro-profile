import { test } from "@playwright/test";

// Full-page screenshots for design review: 3 widths x 2 themes x 3 pages, written to .shots/.
const widths = [360, 768, 1440];
const themes = ["light", "dark"] as const;
const pages = [
  { name: "home", path: "/" },
  { name: "gym", path: "/gym/" },
  { name: "notes", path: "/notes/" },
  { name: "note", path: "/notes/plaid-costs/" },
];

for (const width of widths) {
  for (const theme of themes) {
    for (const target of pages) {
      test(`${target.name} ${width} ${theme}`, async ({ browser }) => {
        const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
        await context.addInitScript((value) => {
          try {
            localStorage.setItem("lights", value);
          } catch {
            // ignore
          }
        }, theme);
        const page = await context.newPage();
        await page.goto(target.path);
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(300);
        await page.screenshot({ path: `.shots/${target.name}-${width}-${theme}.png`, fullPage: true });
        await context.close();
      });
    }
  }
}

// Game states: Load the Bar with plates on, Your Call answered.
for (const width of [360, 1440]) {
  for (const theme of themes) {
    test(`games ${width} ${theme}`, async ({ browser }) => {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: "reduce" });
      await context.addInitScript((value) => {
        try {
          localStorage.setItem("lights", value);
        } catch {
          // ignore
        }
      }, theme);
      const page = await context.newPage();
      await page.goto("/");
      await page.evaluate(() => document.fonts.ready);
      await page.locator("#h-load-the-bar").scrollIntoViewIfNeeded();
      await page.locator('[data-ltb="live"]').waitFor();
      for (const id of ["P-11", "P-12", "P-13", "P-14", "P-23", "P-01", "P-09", "P-26", "P-05"]) {
        await page.locator(`[data-rack] [data-plate-id="${id}"]`).click();
      }
      await page.locator("#h-load-the-bar").scrollIntoViewIfNeeded();
      await page.screenshot({ path: `.shots/game-bar-${width}-${theme}.png` });
      if (width === 360) {
        await page.locator('[data-peg="tooling"]').scrollIntoViewIfNeeded();
        await page.screenshot({ path: `.shots/game-bar-rack-${width}-${theme}.png` });
      }
      const first = page.locator("[data-yc]").first();
      await first.locator('input[type="radio"]').nth(1).check();
      await first.scrollIntoViewIfNeeded();
      await first.screenshot({ path: `.shots/game-call-${width}-${theme}.png` });
      await context.close();
    });
  }
}
