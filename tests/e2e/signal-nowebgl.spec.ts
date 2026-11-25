import { expect, test } from "@playwright/test";

test.use({ launchOptions: { args: ["--disable-webgl", "--disable-webgl2"] } });

test("without WebGL the CSS fallback renders and no canvas remains", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("[data-signal-fallback]")).toHaveCount(1, { timeout: 5000 });
  await expect(page.locator("canvas")).toHaveCount(0);
  const pe = await page.locator("[data-signal-fallback]").evaluate((el) => getComputedStyle(el).pointerEvents);
  expect(pe).toBe("none");
});
