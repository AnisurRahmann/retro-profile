import { expect, test } from "@playwright/test";

test.use({ launchOptions: { args: ["--disable-webgl", "--disable-webgl2"] }, viewport: { width: 1440, height: 900 } });
// window.__sky is declared in sky.spec.ts.
const sky = (page: import("@playwright/test").Page) => page.evaluate(() => window.__sky);

test("the CSS gradient and the stars still render", async ({ page }) => {
  await page.goto("/?sky=2026-12-15T02:00&wx=clear");
  await page.waitForFunction(() => (window.__sky?.frames ?? 0) >= 1, null, { timeout: 8000 });
  expect((await sky(page))!.webgl).toBe(false);
  await expect(page.locator("[data-sky-atmosphere]")).toHaveCount(0);
  await expect(page.locator("[data-sky-particles][data-ready]")).toHaveCount(1);
  const bg = await page.locator("[data-sky-gradient]").evaluate((el) => getComputedStyle(el).backgroundImage);
  expect(bg).toContain("linear-gradient");
  // Stars: the particle canvas has lit pixels (poll: the first resize clears the canvas once).
  const lit = () =>
    page.locator("[data-sky-particles]").evaluate((c: HTMLCanvasElement) => {
      const d = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
      let n = 0;
      for (let i = 3; i < d.length; i += 4) if (d[i]! > 40) n++;
      return n;
    });
  await expect.poll(lit, { timeout: 8000 }).toBeGreaterThan(50);
});
