/**
 * The hero's text on a phone is text over the sky, not stacked boxes (v5.1 T10). At 375×812, in the three states of
 * the brief, none of its four elements (the name, the status line, the one-liner, the label) wears a chip: not at
 * rest, and not while the sky is dragged (a scrub), when the backing module gives the hero the strongest halo instead.
 * How readable the result is stays with the pixel gate (tests/e2e/sky-backing.spec.ts).
 */
import { expect, test } from "@playwright/test";

const STATES = [
  "sky=2026-12-15T11:00&wx=partly",
  "sky=2026-12-15T16:45&wx=clear",
  "sky=2026-12-15T17:20&wx=clear",
];
const IDS = ["name", "status", "one-liner", "label"];

test("the hero's text wears no chip on a phone, at rest or while the sky is dragged", async ({ browser }) => {
  test.setTimeout(120_000);
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const backing = () =>
    page.evaluate(
      (ids) =>
        Object.fromEntries(
          ids.map((id) => {
            const el = [...document.querySelectorAll<HTMLElement>(`[data-on-sky="${id}"]`)].find(
              (e) => e.getClientRects().length > 0,
            );
            return [id, el?.dataset.backing ?? "unset"];
          }),
        ) as Record<string, string>,
      IDS,
    );
  for (const q of STATES) {
    await page.goto(`/?${q}`);
    await page.waitForFunction(
      () => (window.__sky?.backing?.length ?? 0) > 3 && (window.__sky?.frames ?? 0) > 0,
      null,
      { timeout: 15_000 },
    );
    // The weather lands and the gradient eases over 4 s.
    await page.waitForTimeout(4500);
    const rest = await backing();
    for (const id of IDS) expect(rest[id], `${q}: ${id} at rest`).not.toBe("chip");

    // Drag the open sky, 70px under the text block: a scrub.
    const sky = await page.evaluate(() => {
      const block = document.querySelector(".sky-stage h1")!.closest("div")!.getBoundingClientRect();
      return { x: 187, y: Math.round(block.bottom + 70) };
    });
    await page.mouse.move(sky.x, sky.y);
    await page.mouse.down();
    await page.mouse.move(sky.x + 90, sky.y, { steps: 8 });
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => "skyScrub" in document.documentElement.dataset), `${q}: dragging scrubs`).toBe(
      true,
    );
    const drag = await backing();
    for (const id of IDS) expect(drag[id], `${q}: ${id} while scrubbing`).not.toBe("chip");
    await page.mouse.up();
  }
  await ctx.close();
});
