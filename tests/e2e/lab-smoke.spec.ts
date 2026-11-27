import { expect, test, type Page } from "@playwright/test";

/** The volumetric clouds lab draws (owner T0; docs/volumetric/BRIEF.md). window.__vol is typed in volumetric/types.ts. */
test.use({ viewport: { width: 1440, height: 900 } });

/** Mean sRGB of a horizontal band of a screenshot (rows y0..y1 as fractions of the height). */
async function band(page: Page, png: Buffer, y0: number, y1: number): Promise<[number, number, number]> {
  return page.evaluate(
    async ([b64, a, z]) => {
      const img = new Image();
      img.src = "data:image/png;base64," + b64;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      const top = Math.floor(img.height * a);
      const d = ctx.getImageData(0, top, img.width, Math.max(1, Math.floor(img.height * z) - top)).data;
      const s = [0, 0, 0];
      for (let i = 0; i < d.length; i += 4) for (let k = 0; k < 3; k++) s[k] = s[k]! + d[i + k]!;
      const n = d.length / 4;
      return [s[0]! / n, s[1]! / n, s[2]! / n] as [number, number, number];
    },
    [png.toString("base64"), y0, y1] as const,
  );
}

test("/lab/clouds draws the sky without site chrome", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/lab/clouds?t=11:00&cov=0.38&type=cumulus&wind=15&from=270&tier=low");
  await page.waitForFunction(() => (window.__vol?.frames ?? 0) > 5 || !!window.__vol?.error, null, { timeout: 30_000 });
  const vol = await page.evaluate(() => window.__vol!);
  expect(vol.error).toBeNull();
  expect(vol.state.type).toBe("cumulus");
  await expect(page.locator("header")).toBeHidden();
  await expect(page.locator("[data-vol-canvas]")).toBeVisible();

  const png = await page.locator("[data-vol-canvas]").screenshot();
  const sky = await band(page, png, 0.05, 0.6);
  const ground = await band(page, png, 0.9, 0.98);
  // Not blank: a lit sky above, the darker ground below the horizon (82% of the height).
  expect(Math.max(...sky)).toBeGreaterThan(30);
  expect(sky[2]).toBeGreaterThan(ground[2] + 15);
  expect(errors).toEqual([]);
});
