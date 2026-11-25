import { expect, test } from "@playwright/test";

const PAGES = ["/", "/chat", "/work/support-agent", "/lifts", "/privacy"];

test.describe("layout at 375px", () => {
  test.use({ viewport: { width: 375, height: 800 } });
  for (const path of PAGES) {
    test(`no horizontal scroll on ${path}`, async ({ page }) => {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
});

test("Show N more expands and collapses, keyboard operable", async ({ page }) => {
  await page.goto("/");
  const button = page.locator("#shipped button[aria-controls]");
  await expect(button).toHaveText("Show 5 more");
  await expect(button).toHaveAttribute("aria-expanded", "false");
  const hiddenCard = page.getByRole("link", { name: /Amazon Marketplace via Zinc/ });
  await expect(hiddenCard).toBeHidden();

  await button.focus();
  await page.keyboard.press("Enter");
  await expect(button).toHaveAttribute("aria-expanded", "true");
  await expect(button).toHaveText("Show less");
  await expect(hiddenCard).toBeVisible();

  await page.keyboard.press("Space");
  await expect(button).toHaveAttribute("aria-expanded", "false");
  await expect(hiddenCard).toBeHidden();
});

test("collapsed cards are not tabbable", async ({ page }) => {
  await page.goto("/");
  const inertPanels = page.locator(".reveal[inert]");
  await expect(inertPanels.first()).toHaveCount(1);
});

test.describe("status line", () => {
  test("cycles with motion allowed", async ({ page }) => {
    await page.goto("/");
    const line = page.getByTestId("status-line");
    const first = await line.textContent();
    await expect.poll(async () => line.textContent(), { timeout: 6000 }).not.toBe(first);
  });

  test("is static under reduced motion", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.goto("/");
    const line = page.getByTestId("status-line");
    await page.waitForTimeout(300);
    const before = await line.textContent();
    await page.waitForTimeout(4000);
    expect(await line.textContent()).toBe(before);
    const animation = await page.locator(".wave > span").first().evaluate((el) => getComputedStyle(el).animationName);
    expect(animation).toBe("none");
    await context.close();
  });
});

test("case study links into the chat with a prefilled question", async ({ page }) => {
  await page.goto("/work/support-agent");
  const link = page.getByRole("link", { name: /Ask my agent/ });
  await expect(link).toHaveAttribute("href", /\/chat\?q=Tell%20me%20how%20the%20Customer%20Support%20Agent%20worked/);
});

test("/gym redirects to /lifts", async ({ page }) => {
  await page.goto("/gym");
  await expect(page).toHaveURL(/\/lifts$/);
  await expect(page.getByRole("heading", { level: 1, name: "Lifts" })).toBeVisible();
});

test.describe("card alignment", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test("titles in each row share a baseline and tiles meet the title cap", async ({ page }) => {
    await page.goto("/");
    for (const b of await page.locator("button[aria-controls]").all()) await b.click();
    await page.waitForTimeout(300);
    const rows = await page.evaluate(() =>
      ["#shipped", "#bench"].map((sel) =>
        [...document.querySelectorAll(`${sel} .card`)].map((c) => {
          const title = c.querySelector("span.font-medium")!.getBoundingClientRect();
          const tile = c.querySelector(".tile")!.getBoundingClientRect();
          return { card: c.getBoundingClientRect().top, title: title.top - c.getBoundingClientRect().top, tile: tile.top - title.top };
        }),
      ),
    );
    for (const cards of rows) {
      for (const c of cards) {
        expect(c.title).toBeCloseTo(cards[0]!.title, 0); // same offset in every card
        expect(c.tile).toBeCloseTo(5, 0);
      }
    }
  });
});
