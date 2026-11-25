import { expect, test, type Page } from "@playwright/test";

type Sky = {
  state: string;
  elevation: number;
  backing?: { id: string; mode: string; a: number; contrast: number; bg: string }[];
  fps: number;
  condition: string;
  frames?: number;
  webgl?: boolean;
  cap?: number;
  sun?: { x: number; y: number; up: boolean; cloud: number; dim: number };
  moon?: { x: number; y: number; up: boolean };
  takeoffs?: number;
  place?: string | null;
  land?: { offsets: number[]; marks: { id: string; x: number }[] };
  geom?: { apexY: number; horizonY: number; w: number; h: number };
};
declare global {
  interface Window {
    __sky?: Sky;
  }
}

const sky = (page: Page) => page.evaluate(() => window.__sky);
const dhaka = (d: Date) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dhaka", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
const label = (page: Page) => page.getByTestId("sky-label");
const place = (page: Page) => page.locator("[data-testid=sky-place] [data-active]");
const preview = (page: Page) => page.getByTestId("sky-preview");
const strip = (page: Page) => page.getByRole("slider", { name: "Preview a day in Sylhet" });
/** Scroll so a section's top sits at 40% of the viewport (its landmark centred). */
const walkTo = (page: Page, id: string) =>
  page.evaluate((id) => {
    const el = document.getElementById(id)!;
    window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 0.4 * window.innerHeight);
  }, id);

test.use({ viewport: { width: 1440, height: 900 } });

test("the label shows HH:mm in Asia/Dhaka, whatever the visitor's zone", async ({ browser }) => {
  const ctx = await browser.newContext({ timezoneId: "America/New_York", viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const t = new Date("2026-12-15T20:00:10Z"); // 02:00 in Sylhet, 15:00 in New York
  await page.clock.install({ time: t });
  await page.goto("/");
  await expect(page.getByTestId("sylhet-clock")).toHaveText(dhaka(t));
  await expect(page.getByTestId("sylhet-clock")).toHaveText("02:00");
  await expect(place(page)).toHaveText("· tea gardens, Sylhet");
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

test("the popover keeps the details (no scrubber) and closes on Escape", async ({ page }) => {
  await page.goto("/?sky=2026-12-15T11:00&wx=clear");
  await label(page).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Sunrise");
  await expect(dialog.getByRole("link", { name: "Weather data by Open-Meteo.com" })).toBeFocused();
  await expect(dialog.getByRole("slider")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(label(page)).toBeFocused();
});

test("the sun-path strip is a keyboard slider; leaving it returns the sky to now", async ({ page }) => {
  await page.goto("/?sky=2026-12-15T11:00&wx=clear");
  await page.waitForFunction(() => window.__sky?.state === "day");
  const s = strip(page);
  await s.focus();
  await page.keyboard.press("End"); // 23:55: night
  await expect(preview(page)).toHaveText("preview 23:55");
  await expect(s).toHaveAttribute("aria-valuetext", "23:55 in Sylhet, night");
  await page.waitForFunction(() => window.__sky?.state === "night");
  await page.keyboard.press("Home");
  await expect(preview(page)).toHaveText("preview 00:00");
  await page.keyboard.press("PageUp");
  await page.keyboard.press("ArrowRight");
  await expect(preview(page)).toHaveText("preview 01:05");
  await expect(s).toHaveAttribute("aria-valuenow", "65");
  // 16:30 is golden hour on 15 December (the sun at 6.4°).
  for (let i = 0; i < 15; i++) await page.keyboard.press("PageUp");
  for (let i = 0; i < 5; i++) await page.keyboard.press("ArrowRight");
  await expect(s).toHaveAttribute("aria-valuetext", "16:30 in Sylhet, golden hour");
  await page.keyboard.press("Escape");
  await expect(preview(page)).toHaveCount(0, { timeout: 3000 });
  await expect(page.getByTestId("sylhet-clock")).toHaveText("11:00");
  await page.waitForFunction(() => window.__sky?.state === "day");
});

test("dragging the strip scrubs the whole sky; letting go eases back to now", async ({ page }) => {
  await page.goto("/?sky=2026-12-15T11:00&wx=clear");
  await page.waitForFunction(() => (window.__sky?.frames ?? 0) >= 1);
  const box = (await strip(page).boundingBox())!;
  const at = (frac: number) => box.x + 6 + (box.width - 12) * frac;
  await page.mouse.move(at(0.5), box.y + box.height / 2);
  await page.mouse.down();
  await expect(preview(page)).toHaveText("preview 12:00");
  await page.mouse.move(at(23 / 24), box.y + box.height / 2, { steps: 4 });
  await expect(preview(page)).toHaveText("preview 23:00");
  await page.waitForFunction(() => window.__sky?.state === "night");
  await page.mouse.up();
  await expect(preview(page)).toHaveCount(0, { timeout: 3000 });
  await page.waitForFunction(() => window.__sky?.state === "day");
});

test("a horizontal drag on the open sky scrubs time (a viewport width = 12 h), then eases back", async ({ page }) => {
  await page.goto("/?sky=2026-12-15T11:00&wx=clear");
  await page.waitForFunction(() => (window.__sky?.frames ?? 0) >= 1);
  await page.mouse.move(300, 160);
  await page.mouse.down();
  await page.mouse.move(420, 162, { steps: 3 });
  await page.mouse.move(660, 162, { steps: 6 }); // +360 px of 1440 = +3 h
  await expect(preview(page)).toHaveText("preview 14:00");
  await page.mouse.up();
  await expect(preview(page)).toHaveCount(0, { timeout: 3000 });
  // Text is not a handle: a drag that starts on the name doesn't scrub.
  const h1 = (await page.locator("h1").boundingBox())!;
  await page.mouse.move(h1.x + 20, h1.y + 20);
  await page.mouse.down();
  await page.mouse.move(h1.x + 300, h1.y + 22, { steps: 6 });
  await expect(preview(page)).toHaveCount(0);
  await page.mouse.up();
});

test("on a phone a vertical swipe on the sky scrolls the page and doesn't scrub; a sideways one does", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto("/?sky=2026-12-15T11:00&wx=clear");
  await page.waitForFunction(() => (window.__sky?.frames ?? 0) >= 1);
  expect(await page.locator("[data-sky-stage]").evaluate((el) => getComputedStyle(el).touchAction)).toBe("pan-y");
  // Record whether a preview ever appears.
  await page.evaluate(() => {
    const w = window as Window & { __scrubbed?: boolean };
    w.__scrubbed = false;
    new MutationObserver(() => {
      if (document.querySelector("[data-testid=sky-preview]")) w.__scrubbed = true;
    }).observe(document.body, { childList: true, subtree: true });
  });
  const cdp = await page.context().newCDPSession(page);
  // Headless Chromium sometimes drops the first synthetic gesture of a session: retry until the page moves.
  for (let i = 0; i < 3 && (await page.evaluate(() => window.scrollY)) < 100; i++) {
    await cdp.send("Input.synthesizeScrollGesture", { x: 180, y: 160, yDistance: -300, gestureSourceType: "touch", speed: 600 });
    await page.waitForTimeout(300);
  }
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(100);
  expect(await page.evaluate(() => (window as Window & { __scrubbed?: boolean }).__scrubbed)).toBe(false);
  // A sideways swipe on the sky scrubs.
  await page.evaluate(() => window.scrollTo(0, 0));
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 100, y: 160 }] });
  for (let i = 1; i <= 10; i++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 100 + 18 * i, y: 161 }] });
  await expect(preview(page)).toBeVisible();
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect(preview(page)).toHaveCount(0, { timeout: 3000 });
  await ctx.close();
});

test.describe("the first-visit time-lapse", () => {
  test("plays once per session after 2.5 s of quiet, then shows the hint", async ({ page }) => {
    await page.goto("/?teaser");
    await page.waitForFunction(() => document.documentElement.dataset.skyTeaser === "playing", null, { timeout: 6000 });
    await expect(preview(page)).toBeVisible();
    await page.waitForFunction(() => document.documentElement.dataset.skyTeaser === "done", null, { timeout: 12000 });
    await expect(page.getByTestId("sky-hint")).toHaveAttribute("data-show", "");
    await expect(page.getByTestId("sky-hint")).toHaveText("drag the sky ← →");
    await expect(preview(page)).toHaveCount(0, { timeout: 2000 });
    // Same session: not again.
    await page.reload();
    await page.waitForTimeout(4500);
    expect(await page.evaluate(() => document.documentElement.dataset.skyTeaser)).toBeUndefined();
    await expect(preview(page)).toHaveCount(0);
  });

  test("any input cancels it and the sky returns to now", async ({ page }) => {
    await page.goto("/?teaser");
    await page.waitForFunction(() => document.documentElement.dataset.skyTeaser === "playing", null, { timeout: 6000 });
    await page.waitForTimeout(800);
    await page.keyboard.press("Shift");
    await page.waitForFunction(() => document.documentElement.dataset.skyTeaser === "cancelled");
    await expect(preview(page)).toHaveCount(0, { timeout: 1500 });
  });

  test("is skipped under reduced motion and with ?sky set", async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await page.goto("/?teaser");
    await page.waitForTimeout(4500);
    expect(await page.evaluate(() => document.documentElement.dataset.skyTeaser)).toBeUndefined();
    await ctx.close();
    const page2 = await browser.newPage();
    await page2.goto("/?teaser&sky=2026-12-15T11:00&wx=clear");
    await page2.waitForTimeout(4500);
    expect(await page2.evaluate(() => document.documentElement.dataset.skyTeaser)).toBeUndefined();
    await page2.close();
  });
});

test("the place name follows the landmarks as you walk down the page, without moving the line", async ({ page }) => {
  await page.goto("/?sky=2026-12-15T20:30&wx=clear");
  await page.waitForFunction(() => (window.__sky?.frames ?? 0) >= 1);
  const weatherX = async () => (await page.getByTestId("sky-weather").boundingBox())?.x;
  await expect(place(page)).toHaveText("· tea gardens, Sylhet");
  const x0 = await weatherX();
  await walkTo(page, "shipped");
  await expect(place(page)).toHaveText("near Keane Bridge, Sylhet");
  await walkTo(page, "bench");
  await expect(place(page)).toHaveText("· city rooftops, Sylhet");
  await walkTo(page, "closer");
  await expect(place(page)).toHaveText("· Osmani Airport, Sylhet");
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(place(page)).toHaveText("· tea gardens, Sylhet");
  expect(await weatherX()).toBe(x0);
  // The landmarks really are centred on their sections.
  await walkTo(page, "shipped");
  await page.waitForTimeout(300);
  const bridge = (await sky(page))!.land!.marks.find((m) => m.id === "bridge")!;
  expect(Math.abs(bridge.x - 720)).toBeLessThan(40);
});

test("the plane takes off when Book 30 min is hovered with the airport on screen", async ({ page }) => {
  await page.goto("/?sky=2026-12-15T15:00&wx=clear");
  await page.waitForFunction(() => (window.__sky?.frames ?? 0) >= 1);
  // Not from the top of the page: the airport isn't on screen (dispatch, so nothing scrolls).
  await page.locator("[data-sky-takeoff]").dispatchEvent("pointerover");
  await page.waitForTimeout(200);
  expect((await sky(page))!.takeoffs ?? 0).toBe(0);
  await walkTo(page, "closer");
  await page.waitForTimeout(400);
  await page.locator("[data-sky-takeoff]").hover();
  await expect.poll(async () => (await sky(page))!.takeoffs ?? 0).toBe(1);
  expect((await sky(page))!.cap).toBe(60);
});

test("reduced motion: a static frame (fps 0) and no parallax on scroll; the place name still updates", async ({ browser }) => {
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
  await walkTo(page, "closer");
  await expect(place(page)).toHaveText("· Osmani Airport, Sylhet");
  await page.waitForTimeout(600);
  expect((await sky(page))!.land!.offsets).toEqual([0, 0, 0, 0]);
  expect((await sky(page))!.fps).toBe(0);
  await ctx.close();
});

test("the loop runs at 24fps when nothing moves, 60 while it rains or you scroll", async ({ page }) => {
  await page.goto("/?sky=2026-12-15T11:00&wx=partly");
  await page.waitForFunction(() => (window.__sky?.fps ?? 0) > 0, null, { timeout: 8000 });
  await page.waitForTimeout(1500);
  expect((await sky(page))!.fps).toBeLessThanOrEqual(26);
  expect((await sky(page))!.cap).toBe(24);
  // While scrolling: sample the cap on every frame of a 600 ms scroll.
  const caps = await page.evaluate(
    () =>
      new Promise<number[]>((done) => {
        const seen: number[] = [];
        const t0 = performance.now();
        const step = () => {
          window.scrollBy(0, 8);
          seen.push(window.__sky?.cap ?? 0);
          if (performance.now() - t0 < 600) requestAnimationFrame(step);
          else done(seen);
        };
        requestAnimationFrame(step);
      }),
  );
  expect(caps).toContain(60);
  // Rain asks for the display rate. (Measured fps under headless SwiftShader depends on the machine.)
  await page.goto("/?sky=2026-12-15T11:00&wx=rain");
  await page.waitForFunction(() => window.__sky?.cap === 60, null, { timeout: 8000 });
});

test("sky layers are decorative, fixed, behind content and never intercept clicks", async ({ page }) => {
  await page.goto("/?sky=2026-12-15T16:55&wx=partly");
  await page.waitForFunction(() => (window.__sky?.frames ?? 0) >= 1, null, { timeout: 8000 });
  const layers = await page.evaluate(() =>
    ["[data-sky-gradient]", "[data-sky-atmosphere]", "[data-sky-particles]", "[data-sky-landscape]", ".grain"].map((sel) => {
      const el = document.querySelector(sel)!;
      const s = getComputedStyle(el);
      return { sel, hidden: el.getAttribute("aria-hidden"), pe: s.pointerEvents, pos: s.position, z: s.zIndex };
    }),
  );
  expect(layers).toEqual([
    { sel: "[data-sky-gradient]", hidden: "true", pe: "none", pos: "fixed", z: "-4" },
    { sel: "[data-sky-atmosphere]", hidden: "true", pe: "none", pos: "fixed", z: "-3" },
    { sel: "[data-sky-particles]", hidden: "true", pe: "none", pos: "fixed", z: "-2" },
    { sel: "[data-sky-landscape]", hidden: "true", pe: "none", pos: "fixed", z: "-2" },
    { sel: ".grain", hidden: "true", pe: "none", pos: "fixed", z: "-1" },
  ]);
  // No column scrim: loose text gets its own backing, solved per element.
  await page.waitForFunction(() => (window.__sky?.backing?.length ?? 0) > 3, null, { timeout: 8000 });
  expect(await page.locator("[data-sky-scrim], .text-scrim").count()).toBe(0);
  await page.getByRole("link", { name: /Support Agent/ }).first().click();
  await expect(page).toHaveURL(/\/work\/support-agent$/);
});

test("the sun sits on the arc: on the horizon at sunrise, under the apex at noon, never clipped", async ({ page }) => {
  await page.goto("/?sky=2026-12-15T11:50&wx=clear");
  await page.waitForFunction(() => window.__sky?.sun?.up === true);
  await page.waitForTimeout(1500);
  const noon = (await sky(page))!;
  expect(Math.abs(noon.sun!.x - 720)).toBeLessThan(40);
  expect(noon.sun!.y).toBeGreaterThan(noon.geom!.apexY); // December: lower than the June apex
  await page.goto("/?sky=2026-12-15T17:04&wx=clear");
  await page.waitForTimeout(1500);
  const dusk = (await sky(page))!;
  expect(dusk.sun!.x).toBeLessThanOrEqual(0.92 * 1440 + 0.5);
  expect(dusk.sun!.y).toBeGreaterThan(dusk.geom!.horizonY - 20);
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
