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
