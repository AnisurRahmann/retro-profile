import { expect, test, type Page } from "@playwright/test";
import { brightestPixel, contrast, hex, luminance } from "./pixels";

const frames = (page: Page) => page.evaluate(() => window.__signalFrames ?? 0);
const ready = (page: Page) => page.waitForFunction(() => (window.__signalFrames ?? 0) > 0, null, { timeout: 5000 });

test.use({ viewport: { width: 1440, height: 900 } });

test("canvas is decorative, below content, and never intercepts clicks", async ({ page }) => {
  await page.goto("/");
  await ready(page);
  const canvas = page.locator("canvas[data-signal-field]");
  await expect(canvas).toHaveAttribute("aria-hidden", "true");
  const style = await canvas.evaluate((el) => {
    const s = getComputedStyle(el);
    return { pe: s.pointerEvents, z: s.zIndex, pos: s.position };
  });
  expect(style).toEqual({ pe: "none", z: "-1", pos: "fixed" });
  await page.getByRole("link", { name: /Support Agent/ }).first().click();
  await expect(page).toHaveURL(/\/work\/support-agent$/);
});

test("reduced motion draws exactly one static frame", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto("/");
  await ready(page);
  await page.mouse.move(100, 300);
  await page.mouse.click(100, 300);
  await page.waitForTimeout(2000);
  expect(await frames(page)).toBe(1);
  await context.close();
});

test("the loop stops while the document is hidden", async ({ page }) => {
  await page.goto("/");
  await ready(page);
  await page.mouse.move(100, 300); // keep it at full rate
  await page.waitForTimeout(200);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  const before = await frames(page);
  await page.waitForTimeout(1000);
  expect(await frames(page)).toBe(before);
});

test("text keeps 4.5:1 over the brightest background pixel, idle and at a ripple peak", async ({ page }) => {
  await page.goto("/");
  await ready(page);
  await page.waitForTimeout(700); // fade-in done
  const tokens = await page.evaluate(() => {
    const s = getComputedStyle(document.documentElement);
    return { text: s.getPropertyValue("--text"), graphite: s.getPropertyValue("--graphite") };
  });
  const para = page.getByText("Fullstack AI engineer. I build voice agents", { exact: false }).first();
  await para.evaluate((el) => ((el as HTMLElement).style.color = "transparent")); // sample only what's behind it
  const box = (await para.boundingBox())!;
  const clip = { x: box.x, y: box.y - 4, width: box.width, height: box.height + 8 };

  const idle = await brightestPixel(page, await page.screenshot({ clip }));
  await page.evaluate(({ x, y }) => {
    for (let i = 0; i < 8; i++) window.__emitSignal!({ x, y, amp: 1 });
  }, { x: box.x + box.width / 2, y: box.y + box.height / 2 });
  await page.waitForTimeout(40);
  const peak = await brightestPixel(page, await page.screenshot({ clip }));

  expect(luminance(peak)).toBeGreaterThan(luminance(idle)); // we really caught the ripple
  for (const bg of [idle, peak]) {
    expect(contrast(hex(tokens.text), bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(hex(tokens.graphite), bg)).toBeGreaterThanOrEqual(4.5);
  }
});
