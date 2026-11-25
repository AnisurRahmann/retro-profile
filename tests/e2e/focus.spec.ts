import { expect, test, type Locator } from "@playwright/test";

const AMBER = "rgb(245, 165, 36)";
const ring = (l: Locator) =>
  l.evaluate((el) => {
    const s = getComputedStyle(el);
    return { style: s.outlineStyle, color: s.outlineColor, width: s.outlineWidth, border: s.borderTopColor };
  });

test("chat composer: mouse focus is a quiet border, keyboard focus is the amber ring", async ({ page }) => {
  await page.goto("/chat");
  const box = page.locator("form.composer");
  const input = page.getByRole("textbox", { name: "Message Shakil's agent" });

  await input.click();
  await expect(input).toBeFocused();
  const mouse = await ring(box);
  expect(mouse.style).toBe("none");
  expect(mouse.border).not.toBe(AMBER);
  expect((await ring(input)).style).toBe("none");

  // Keyboard: leave the field, then Tab back into it.
  await page.getByRole("button", { name: "I'm hiring an AI engineer" }).focus();
  await page.keyboard.press("Shift+Tab");
  await expect(input).toBeFocused();
  const kb = await ring(box);
  expect(kb).toMatchObject({ style: "solid", color: AMBER, width: "2px" });
});

test("site-wide: clicking a button shows no ring, tabbing to it does", async ({ page }) => {
  await page.goto("/");
  const toggle = page.locator("#shipped button[aria-controls]");
  await toggle.click();
  expect((await ring(toggle)).style).toBe("none");
  await toggle.click(); // collapse again
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await expect(toggle).toBeFocused();
  // transition-colors also fades outline-color (150 ms), so wait for it to settle.
  await expect.poll(() => ring(toggle)).toMatchObject({ style: "solid", color: AMBER });
});

test("intro form fields: no amber on click", async ({ page }) => {
  await page.goto("/chat");
  const input = page.getByRole("textbox");
  await input.fill("Can he follow up with me?");
  await input.press("Enter");
  const name = page.getByLabel("Name");
  await name.click();
  expect((await ring(name)).style).toBe("none");
  await page.keyboard.press("Tab");
  expect((await ring(page.getByLabel("Email"))).color).toBe(AMBER);
});

test("theme-color stays #0B1220", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", /#0b1220/i);
});
