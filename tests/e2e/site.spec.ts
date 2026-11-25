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

  test("from 640px up it keeps the full lines, on one fixed line", async ({ page }) => {
    await page.goto("/");
    const wide = page.getByTestId("status-line");
    await expect(wide).toBeVisible();
    await expect(page.getByTestId("status-line-short")).toBeHidden();
    const m = await wide.evaluate((el) => {
      const t = el.querySelector(".status-line-text")!;
      const cs = getComputedStyle(t);
      return {
        h: el.getBoundingClientRect().height,
        css: [cs.whiteSpace, cs.overflow, cs.textOverflow],
      };
    });
    expect(m.h).toBe(28);
    expect(m.css).toEqual(["nowrap", "hidden", "ellipsis"]);
  });

  test("on a phone every line is the short one, on one line, with at most 12px before the one-liner", async ({
    browser,
  }) => {
    test.setTimeout(60_000);
    const context = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2 });
    const page = await context.newPage();
    await page.goto("/?sky=2026-12-15T11:00&wx=clear");
    const short = page.getByTestId("status-line-short");
    await expect(short).toBeVisible();
    await expect(page.getByTestId("status-line")).toBeHidden();
    // Wait through the rotation: each line is measured once its typing has finished (no hidden remainder left).
    const measured = new Map<string, { h: number; gap: number; clipped: boolean; css: string[] }>();
    const until = Date.now() + 45_000;
    while (Date.now() < until && measured.size < 7) {
      const m = await page.evaluate(() => {
        const el = document.querySelector('[data-testid="status-line-short"]')!;
        const t = el.querySelector(".status-line-text")!;
        const cs = getComputedStyle(t);
        return {
          text: t.firstChild?.textContent ?? "",
          typed: !t.querySelector(".invisible"),
          h: el.getBoundingClientRect().height,
          gap:
            document.querySelector('[data-on-sky="one-liner"]')!.getBoundingClientRect().top -
            el.getBoundingClientRect().bottom,
          clipped: t.scrollWidth > t.clientWidth,
          css: [cs.whiteSpace, cs.overflow, cs.textOverflow],
        };
      });
      if (m.typed && m.text && !measured.has(m.text))
        measured.set(m.text, { h: m.h, gap: m.gap, clipped: m.clipped, css: m.css });
      await page.waitForTimeout(100);
    }
    await context.close();
    expect([...measured.keys()]).toEqual([
      "Building voice agents.",
      "Shipping Callback AI.",
      "Logging sets by voice.",
      "Reviewing every agent diff.",
      "Routing to Tier 1 models.",
      "Deterministic checks first.",
      "Between sets.",
    ]);
    for (const [text, m] of measured) {
      expect(m.h, text).toBe(24);
      expect(m.gap, text).toBeGreaterThanOrEqual(0);
      expect(m.gap, text).toBeLessThanOrEqual(12);
      expect(m.clipped, text).toBe(false);
      expect(m.css, text).toEqual(["nowrap", "hidden", "ellipsis"]);
    }
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
