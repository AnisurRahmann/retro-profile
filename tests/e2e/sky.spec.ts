import { expect, test, type Page } from "@playwright/test";

type Sky = { state: string; elevation: number; scrimA: number; fps: number; condition: string; frames?: number; webgl?: boolean; cap?: number };
declare global {
  interface Window {
    __sky?: Sky;
  }
}

const sky = (page: Page) => page.evaluate(() => window.__sky);
const dhaka = (d: Date) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dhaka", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
const label = (page: Page) => page.getByTestId("sky-label");

test.use({ viewport: { width: 1440, height: 900 } });

test("the label shows HH:mm in Asia/Dhaka, whatever the visitor's zone", async ({ browser }) => {
  const ctx = await browser.newContext({ timezoneId: "America/New_York", viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const t = new Date("2026-12-15T20:00:10Z"); // 02:00 in Sylhet, 15:00 in New York
  await page.clock.install({ time: t });
  await page.goto("/");
  await expect(page.getByTestId("sylhet-clock")).toHaveText(dhaka(t));
  await expect(page.getByTestId("sylhet-clock")).toHaveText("02:00");
  await expect(label(page)).toContainText("02:00 in Sylhet");
  await ctx.close();
});

test("the label ticks over on the minute boundary", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-12-15T20:00:50Z") });
  await page.goto("/");
  await expect(page.getByTestId("sylhet-clock")).toHaveText("02:00");
  await page.clock.runFor(11_000);
  await expect(page.getByTestId("sylhet-clock")).toHaveText("02:01");
});

test("/api/sylhet is fetched once on load and not again within 15 minutes", async ({ browser }) => {
  // Reduced motion: no rAF loop for the fake clock to fast-forward through (the timers are what's under test).
  const ctx = await browser.newContext({ reducedMotion: "reduce" });
  const page = await ctx.newPage();
  let calls = 0;
  page.on("request", (r) => {
    if (new URL(r.url()).pathname === "/api/sylhet") calls++;
  });
  await page.clock.install({ time: new Date("2026-12-15T06:00:00Z") });
  const first = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/sylhet");
  await page.goto("/");
  await first;
  expect(calls).toBe(1);
  await page.clock.runFor(14 * 60_000);
  expect(calls).toBe(1);
  await page.clock.runFor(2 * 60_000);
  await expect.poll(() => calls).toBe(2);
  await page.waitForTimeout(500);
  expect(calls).toBe(2);
  await ctx.close();
});

test("weather shows when /api/sylhet answers; only the time when it fails, and nothing throws", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("sky-weather")).toContainText("°C");

  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/api/sylhet", (r) => r.fulfill({ status: 500, body: "nope" }));
  await page.goto("/");
  await expect(page.getByTestId("sylhet-clock")).toHaveText(/^\d\d:\d\d$/);
  await page.waitForTimeout(500);
  await expect(page.getByTestId("sky-weather")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("the scrubber works by keyboard and 'Back to now' restores the real sky", async ({ page }) => {
  // 11:00 clear in Sylhet: day.
  await page.goto("/?sky=2026-12-15T11:00&wx=clear");
  await page.waitForFunction(() => window.__sky?.state === "day");
  await label(page).focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const slider = page.getByRole("slider", { name: "Preview a day in Sylhet" });
  await expect(slider).toBeFocused();

  await page.keyboard.press("End"); // 23:55: night
  await expect(page.getByTestId("sky-preview")).toHaveText("preview 23:55");
  await page.waitForFunction(() => window.__sky?.state === "night");
  await page.keyboard.press("Home");
  await expect(page.getByTestId("sky-preview")).toHaveText("preview 00:00");
  await page.keyboard.press("PageUp");
  await page.keyboard.press("ArrowRight");
  await expect(page.getByTestId("sky-preview")).toHaveText("preview 01:05");
  await expect(slider).toHaveAttribute("aria-valuetext", "01:05");

  // Focus stays inside the dialog.
  for (let i = 0; i < 6; i++) await page.keyboard.press("Tab");
  expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true);

  await page.getByRole("button", { name: "Back to now" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(label(page)).toBeFocused();
  await expect(page.getByTestId("sky-preview")).toHaveCount(0, { timeout: 3000 });
  await expect(label(page)).toContainText("11:00 in Sylhet");
  await page.waitForFunction(() => window.__sky?.state === "day");

  // Escape closes too.
  await label(page).press("Enter");
  await page.keyboard.press("PageDown");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByTestId("sky-preview")).toHaveCount(0, { timeout: 3000 });
});

test("reduced motion draws a static frame: fps 0 after the first frame", async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto("/?sky=2026-12-15T21:00&wx=rain");
  await page.waitForFunction(() => (window.__sky?.frames ?? 0) >= 1, null, { timeout: 8000 });
  // The weather response repaints the static frame once; measure after it.
  await expect(page.getByTestId("sky-weather")).toBeVisible();
  await page.waitForTimeout(1500);
  const s = (await sky(page))!;
  expect(s.fps).toBe(0);
  const frames = s.frames!;
  await page.waitForTimeout(1000);
  expect((await sky(page))!.frames).toBe(frames);
  await ctx.close();
});

test("the loop runs at 24fps when nothing moves and asks for 60 while it rains", async ({ page }) => {
  await page.goto("/?sky=2026-12-15T11:00&wx=partly");
  await page.waitForFunction(() => (window.__sky?.fps ?? 0) > 0, null, { timeout: 8000 });
  await page.waitForTimeout(1500);
  expect((await sky(page))!.fps).toBeLessThanOrEqual(26);
  expect((await sky(page))!.cap).toBe(24);
  // Rain asks for the display rate. (Measured fps under headless SwiftShader depends on the machine.)
  await page.goto("/?sky=2026-12-15T11:00&wx=rain");
  await page.waitForFunction(() => window.__sky?.cap === 60, null, { timeout: 8000 });
});

test("sky layers are decorative, fixed, behind content and never intercept clicks", async ({ page }) => {
  await page.goto("/?sky=2026-12-15T16:55&wx=partly");
  await page.waitForFunction(() => (window.__sky?.frames ?? 0) >= 1, null, { timeout: 8000 });
  const layers = await page.evaluate(() =>
    ["[data-sky-gradient]", "[data-sky-atmosphere]", "[data-sky-particles]", "[data-sky-scrim]", ".grain"].map((sel) => {
      const el = document.querySelector(sel)!;
      const s = getComputedStyle(el);
      return { sel, hidden: el.getAttribute("aria-hidden"), pe: s.pointerEvents, pos: s.position, z: s.zIndex };
    }),
  );
  expect(layers).toEqual([
    { sel: "[data-sky-gradient]", hidden: "true", pe: "none", pos: "fixed", z: "-4" },
    { sel: "[data-sky-atmosphere]", hidden: "true", pe: "none", pos: "fixed", z: "-3" },
    { sel: "[data-sky-particles]", hidden: "true", pe: "none", pos: "fixed", z: "-2" },
    { sel: "[data-sky-scrim]", hidden: "true", pe: "none", pos: "fixed", z: "-1" },
    { sel: ".grain", hidden: "true", pe: "none", pos: "fixed", z: "-1" },
  ]);
  expect((await sky(page))!.scrimA).toBeGreaterThan(0.5); // dusk: the column needs the scrim
  await page.getByRole("link", { name: /Support Agent/ }).first().click();
  await expect(page).toHaveURL(/\/work\/support-agent$/);
});

test("the first paint already has the right sky (no flash): night colours at 02:00", async ({ page }) => {
  await page.goto("/?sky=2026-12-15T02:00&wx=clear", { waitUntil: "commit" });
  await page.waitForSelector("[data-sky-gradient]", { state: "attached" });
  const v = await page.evaluate(() => ({
    zenith: document.documentElement.style.getPropertyValue("--sky-zenith"),
    state: document.documentElement.dataset.sky,
  }));
  expect(v.zenith).toBe("#060b16");
  expect(v.state).toBe("night");
});
