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
  plane?: { state: string; flights: number };
  place?: string | null;
  land?: {
    mode: string;
    offsets: number[];
    marks: { id: string; x: number }[];
    closing?: { id: string; x: number }[];
  };
  geom?: { apexY: number; horizonY: number; w: number; h: number };
};
declare global {
  interface Window {
    __sky?: Sky;
  }
}

const sky = (page: Page) => page.evaluate(() => window.__sky);
const dhaka = (d: Date) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dhaka",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(d);
const label = (page: Page) => page.getByTestId("sky-label");
const place = (page: Page) => page.locator("[data-testid=sky-place] .sky-place-name");
const preview = (page: Page) => page.getByTestId("sky-preview");
const strip = (page: Page) => page.getByRole("slider", { name: "Preview a day in Sylhet" });
/** Scroll to the bottom of the page (the airport). */
const bottom = (page: Page) =>
  page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
/** Scroll so a section's top sits at 40% of the viewport (its landmark centred). */
const walkTo = (page: Page, id: string) =>
  page.evaluate((id) => {
    const el = document.getElementById(id)!;
    window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 0.4 * window.innerHeight);
  }, id);

test.use({ viewport: { width: 1440, height: 900 } });

test("the label shows HH:mm in Asia/Dhaka, whatever the visitor's zone", async ({ browser }) => {
  const ctx = await browser.newContext({
    timezoneId: "America/New_York",
    viewport: { width: 1440, height: 900 },
  });
  const page = await ctx.newPage();
  const t = new Date("2026-12-15T20:00:10Z"); // 02:00 in Sylhet, 15:00 in New York
  await page.clock.install({ time: t });
  await page.goto("/");
  await expect(page.getByTestId("sylhet-clock")).toHaveText(dhaka(t));
  await expect(page.getByTestId("sylhet-clock")).toHaveText("02:00");
  await expect(place(page)).toHaveText("tea gardens, Sylhet");
  await ctx.close();
});

test("the label reads time · temperature · weather · place, with no gap, and one spoken label", async ({
  page,
}) => {
  await page.goto("/?sky=2026-12-15T16:45&wx=clear");
  await expect(page.getByTestId("sky-weather")).toBeVisible();
  await expect(place(page)).toHaveText("tea gardens, Sylhet");
  const text = (await label(page).innerText()).replace(/\s+/g, " ").trim();
  expect(text).toMatch(/^\d\d:\d\d · \d+°C · clear · tea gardens, Sylhet$/);
  // Separators are decoration; the button has one aria-label.
  for (const sep of await label(page).locator(".sky-sep").all())
    await expect(sep).toHaveAttribute("aria-hidden", "true");
  await expect(label(page)).toHaveAttribute(
    "aria-label",
    /^\d\d:\d\d in Sylhet, \d+ degrees, clear, by the tea gardens$/,
  );
  // No reserved width: the place follows the weather after one separator.
  const w = (await page.getByTestId("sky-weather").boundingBox())!;
  const p = (await place(page).boundingBox())!;
  expect(p.x - (w.x + w.width)).toBeLessThan(24);
  expect(Math.abs(p.y - w.y)).toBeLessThan(2);
});

test("on a phone the label is two designed lines: no leading separator on the second", async ({
  browser,
}) => {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const page = await ctx.newPage();
  await page.goto("/?sky=2026-12-15T16:45&wx=clear");
  await expect(page.getByTestId("sky-weather")).toBeVisible();
  await expect(place(page)).toBeVisible();
  const w = (await page.getByTestId("sky-weather").boundingBox())!;
  const p = (await place(page).boundingBox())!;
  expect(p.y).toBeGreaterThan(w.y + 10);
  const clock = (await page.getByTestId("sylhet-clock").boundingBox())!;
  expect(Math.abs(p.x - clock.x)).toBeLessThan(24);
  expect((await page.getByTestId("sky-place").innerText()).trim()).toMatch(/^[A-Za-z]/);
  await ctx.close();
});

test("the strip is 260×40 with 11px graphite tick labels; the now dot stays while the handle is dragged away", async ({
  page,
}) => {
  await page.goto("/?sky=2026-12-15T11:00&wx=clear");
  await expect(page.getByTestId("sky-strip-now")).toBeAttached();
  const box = (await strip(page).boundingBox())!;
  expect(Math.round(box.width)).toBe(260);
  expect(Math.round(box.height)).toBe(40);
  const tick = page.locator("[data-on-sky=strip-rise]");
  await expect(tick).toHaveText(/^\d\d:\d\d$/);
  expect(await tick.evaluate((el) => getComputedStyle(el).fontSize)).toBe("11px");
  const handle = (await page.getByTestId("sky-strip-handle").boundingBox())!;
  expect(Math.round(handle.width)).toBe(12);
  const dot0 = (await page.getByTestId("sky-strip-now").boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.9, box.y + 20);
  await page.mouse.down();
  await expect(preview(page)).toBeVisible();
  const dot1 = (await page.getByTestId("sky-strip-now").boundingBox())!;
  expect(dot1.x).toBeCloseTo(dot0.x, 0);
  const h = (await page.getByTestId("sky-strip-handle").boundingBox())!;
  expect(h.x - dot1.x).toBeGreaterThan(40);
  await page.mouse.up();
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

test("weather shows when /api/sylhet answers; only the time when it fails, and nothing throws", async ({
  page,
}) => {
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

test("the sun-path strip is a keyboard slider; leaving it returns the sky to now", async ({
  page,
}) => {
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

test("a horizontal drag on the open sky scrubs time (a viewport width = 12 h), then eases back", async ({
  page,
}) => {
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

test("on a phone a vertical swipe on the sky scrolls the page and doesn't scrub; a sideways one does", async ({
  browser,
}) => {
  const ctx = await browser.newContext({
    viewport: { width: 375, height: 812 },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();
  await page.goto("/?sky=2026-12-15T11:00&wx=clear");
  await page.waitForFunction(() => (window.__sky?.frames ?? 0) >= 1);
  expect(
    await page.locator("[data-sky-stage]").evaluate((el) => getComputedStyle(el).touchAction),
  ).toBe("pan-y");
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
    await cdp.send("Input.synthesizeScrollGesture", {
      x: 180,
      y: 160,
      yDistance: -300,
      gestureSourceType: "touch",
      speed: 600,
    });
    await page.waitForTimeout(300);
  }
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(100);
  expect(await page.evaluate(() => (window as Window & { __scrubbed?: boolean }).__scrubbed)).toBe(
    false,
  );
  // A sideways swipe on the sky scrubs.
  await page.evaluate(() => window.scrollTo(0, 0));
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: 100, y: 160 }],
  });
  for (let i = 1; i <= 10; i++)
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: 100 + 18 * i, y: 161 }],
    });
  await expect(preview(page)).toBeVisible();
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect(preview(page)).toHaveCount(0, { timeout: 3000 });
  await ctx.close();
});

test.describe("the first-visit time-lapse", () => {
  test("plays once per session after 2.5 s of quiet, then shows the hint", async ({ page }) => {
    await page.goto("/?teaser");
    await page.waitForFunction(
      () => document.documentElement.dataset.skyTeaser === "playing",
      null,
      { timeout: 6000 },
    );
    await expect(preview(page)).toBeVisible();
    await page.waitForFunction(() => document.documentElement.dataset.skyTeaser === "done", null, {
      timeout: 12000,
    });
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
    await page.waitForFunction(
      () => document.documentElement.dataset.skyTeaser === "playing",
      null,
      { timeout: 6000 },
    );
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

test("the place name follows the landmarks as you walk down the page, without moving the line", async ({
  page,
}) => {
  await page.goto("/?sky=2026-12-15T20:30&wx=clear");
  await page.waitForFunction(() => (window.__sky?.frames ?? 0) >= 1);
  const weatherX = async () => (await page.getByTestId("sky-weather").boundingBox())?.x;
  await expect(place(page)).toHaveText("tea gardens, Sylhet");
  const x0 = await weatherX();
  await walkTo(page, "shipped");
  await expect(place(page)).toHaveText("near Keane Bridge, Sylhet");
  await walkTo(page, "bench");
  await expect(place(page)).toHaveText("city rooftops, Sylhet");
  await walkTo(page, "closer");
  await expect(place(page)).toHaveText("near Osmani Airport, Sylhet");
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(place(page)).toHaveText("tea gardens, Sylhet");
  expect(await weatherX()).toBe(x0);
  // Desktop: each landmark reaches its gutter, never the middle of the column.
  await walkTo(page, "shipped");
  await page.waitForTimeout(300);
  const land = (await sky(page))!.land!;
  expect(land.mode).toBe("gutter");
  const clock = land.marks.find((m) => m.id === "clock")!;
  expect(Math.abs(clock.x - (1440 - 336 / 2))).toBeLessThan(30);
  // B1: the airport is the end of the walk, reached at the bottom of the page on its gutter centre; every landmark
  // is in the world once.
  await bottom(page);
  await page.waitForTimeout(300);
  const marks = (await sky(page))!.land!.marks;
  expect(marks.map((m) => m.id).sort()).toEqual(["airport", "bridge", "city", "city2", "clock"]);
  const airport = marks.find((m) => m.id === "airport")!;
  expect(Math.abs(airport.x - (1440 - 336 / 2))).toBeLessThan(30);
});

test("scene mode (375): the landscape is the stage's horizon and a closing band; tapping Book 30 min flies the plane", async ({
  browser,
}) => {
  const ctx = await browser.newContext({
    viewport: { width: 375, height: 812 },
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();
  await page.goto("/?sky=2026-12-15T16:45&wx=clear");
  await page.waitForFunction(
    () => (window.__sky?.frames ?? 0) >= 1 && window.__sky?.land?.mode === "scene",
    null,
    { timeout: 8000 },
  );
  expect(await page.locator("[data-sky-landscape]").isVisible()).toBe(false);
  await expect(page.locator("[data-sky-scene=stage] canvas")).toHaveAttribute("data-ready", "");
  const stage = await page.locator("[data-sky-stage]").boundingBox();
  const scene = await page.locator("[data-sky-scene=stage]").boundingBox();
  expect(Math.abs(scene!.y + scene!.height - (stage!.y + stage!.height))).toBeLessThan(1);
  // The bridge is on the stage's horizon; the closing band is the airport.
  expect((await sky(page))!.land!.marks.map((m) => m.id)).toContain("bridge");
  await bottom(page);
  await page.waitForTimeout(400);
  expect(((await sky(page))!.land!.closing ?? []).map((m) => m.id)).toEqual(["airport"]);
  await expect(place(page)).toHaveText("near Osmani Airport, Sylhet");
  await ctx.close();
});

for (const size of [
  { width: 375, height: 812 },
  { width: 1440, height: 900 },
]) {
  test(`B2 at ${size.width}: the plane takes off on every arrival at the airport (3 visits, 3 flights)`, async ({
    browser,
  }) => {
    test.setTimeout(90_000);
    const ctx = await browser.newContext({
      viewport: size,
      deviceScaleFactor: size.width < 640 ? 2 : 1,
    });
    const page = await ctx.newPage();
    await page.goto("/?sky=2026-12-15T16:45&wx=clear");
    await page.waitForFunction(
      () => (window.__sky?.frames ?? 0) >= 1 && !!window.__sky?.plane,
      null,
      { timeout: 8000 },
    );
    expect((await sky(page))!.plane!.flights).toBe(0);
    for (let visit = 1; visit <= 3; visit++) {
      await bottom(page);
      await expect
        .poll(async () => (await sky(page))!.plane!.flights, { timeout: 4000 })
        .toBe(visit);
      // Staying put doesn't fly another.
      await page.waitForTimeout(500);
      expect((await sky(page))!.plane!.flights).toBe(visit);
      await page.evaluate(() => window.scrollTo(0, 0));
      // The next plane is at the gate 4.6 + 2.5 + 0.6 s later.
      await expect
        .poll(async () => (await sky(page))!.plane!.state, { timeout: 12_000 })
        .toBe("parked");
    }
    expect((await sky(page))!.plane!.flights).toBe(3);
    await ctx.close();
  });
}

for (const size of [
  { width: 375, height: 812 },
  { width: 1440, height: 900 },
]) {
  // v5.1 T5: the arrival at the bottom flies the plane at both sizes, and coming back flies it once more.
  test(`T5 at ${size.width}: the bottom of the page flies the plane, and so does coming back to it`, async ({
    browser,
  }) => {
    test.setTimeout(60_000);
    const ctx = await browser.newContext({
      viewport: size,
      deviceScaleFactor: size.width < 640 ? 2 : 1,
    });
    const page = await ctx.newPage();
    await page.goto("/?sky=2026-11-26T03:30&wx=clear");
    await page.waitForFunction(
      () => (window.__sky?.frames ?? 0) >= 1 && !!window.__sky?.plane,
      null,
      { timeout: 8000 },
    );
    expect((await sky(page))!.plane!.flights).toBe(0);
    await bottom(page);
    await page.waitForTimeout(5000);
    const first = (await sky(page))!.plane!.flights;
    expect(first).toBeGreaterThanOrEqual(1);
    await page.evaluate(() => window.scrollTo(0, 0));
    await bottom(page);
    await page.waitForTimeout(5000);
    expect((await sky(page))!.plane!.flights).toBe(first + 1);
    await ctx.close();
  });
}

test("Book 30 min (hover or tap) flies a parked plane once, only with the airport on screen", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.goto("/?sky=2026-12-15T15:00&wx=clear");
  await page.waitForFunction(() => (window.__sky?.frames ?? 0) >= 1 && !!window.__sky?.plane);
  // Not from the top of the page: the airport isn't on screen (dispatch, so nothing scrolls).
  await page.locator("[data-sky-takeoff]").dispatchEvent("pointerover");
  await page.waitForTimeout(200);
  expect((await sky(page))!.plane!.flights).toBe(0);
  // Arriving flies one; wait for the next plane at the gate.
  await bottom(page);
  await expect.poll(async () => (await sky(page))!.plane!.flights).toBe(1);
  await expect
    .poll(async () => (await sky(page))!.plane!.state, { timeout: 12_000 })
    .toBe("parked");
  await page.locator("[data-sky-takeoff]").hover();
  await expect.poll(async () => (await sky(page))!.plane!.flights).toBe(2);
  expect((await sky(page))!.cap).toBe(60);
  // While it's flying, another hover or tap is ignored (no double planes).
  await page.mouse.move(0, 0);
  await page.locator("[data-sky-takeoff]").hover();
  await page.locator("[data-sky-takeoff]").dispatchEvent("pointerdown");
  await page.waitForTimeout(500);
  expect((await sky(page))!.plane!.flights).toBe(2);
});

test("reduced motion: the plane stays parked (no take-off on arrival or on Book 30 min)", async ({
  browser,
}) => {
  for (const size of [
    { width: 375, height: 812 },
    { width: 1440, height: 900 },
  ]) {
    const ctx = await browser.newContext({ reducedMotion: "reduce", viewport: size });
    const page = await ctx.newPage();
    await page.goto("/?sky=2026-12-15T16:45&wx=clear");
    await page.waitForFunction(
      () => (window.__sky?.frames ?? 0) >= 1 && !!window.__sky?.plane,
      null,
      { timeout: 8000 },
    );
    await bottom(page);
    await page.waitForTimeout(800);
    await page.locator("[data-sky-takeoff]").hover();
    await page.waitForTimeout(800);
    expect((await sky(page))!.plane).toEqual({ state: "parked", flights: 0 });
    await ctx.close();
  }
});

test("phones: no strip; the sun on the big arc is the slider (keys and drag), off while over text", async ({
  browser,
}) => {
  const ctx = await browser.newContext({
    viewport: { width: 375, height: 812 },
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();
  await page.goto("/?sky=2026-12-15T11:00&wx=clear");
  await page.waitForFunction(() => (window.__sky?.frames ?? 0) >= 1);
  await expect(page.getByTestId("sky-strip")).toHaveCount(0);
  const handle = page.getByTestId("sky-arc-handle");
  await expect(handle).toHaveAttribute("role", "slider");
  await expect(handle).toHaveAttribute("aria-label", "Preview a day in Sylhet");
  // 44×44, centred on the sun's disc.
  const box = (await handle.boundingBox())!;
  expect(Math.round(box.width)).toBe(44);
  const sun = (await sky(page))!.sun!;
  expect(Math.abs(box.x + 22 - sun.x)).toBeLessThan(3);
  expect(Math.abs(box.y + 22 - sun.y)).toBeLessThan(3);
  // Keys, like the strip.
  await handle.focus();
  await page.keyboard.press("PageUp");
  await expect(preview(page)).toHaveText("preview 12:00");
  await page.keyboard.press("Escape");
  await expect(preview(page)).toHaveCount(0, { timeout: 3000 });
  // Drag the sun toward the west: the time moves on and the disc follows the finger.
  if ((await handle.getAttribute("data-off")) === null) {
    await page.mouse.move(box.x + 22, box.y + 22);
    await page.mouse.down();
    await page.mouse.move(box.x + 22 + 80, box.y + 22, { steps: 6 });
    await expect(preview(page)).toBeVisible();
    await page.mouse.up();
    await expect(preview(page)).toHaveCount(0, { timeout: 3000 });
  }
  // Scrolled away from the stage, it takes no pointer.
  await page.evaluate(() => window.scrollTo(0, 1500));
  await page.waitForTimeout(300);
  await expect(handle).toHaveAttribute("data-off", "");
  await ctx.close();
});

test("reduced motion: a static frame (fps 0) and no parallax on scroll; the place name still updates", async ({
  browser,
}) => {
  const ctx = await browser.newContext({
    reducedMotion: "reduce",
    viewport: { width: 1440, height: 900 },
  });
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
  await expect(place(page)).toHaveText("near Osmani Airport, Sylhet");
  await page.waitForTimeout(600);
  expect((await sky(page))!.land!.offsets).toEqual([0, 0, 0, 0]);
  expect((await sky(page))!.fps).toBe(0);
  await ctx.close();
});

test("the loop runs at 24fps when nothing moves, 60 while it rains or you scroll", async ({
  page,
}) => {
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

test("sky layers are decorative, fixed, behind content and never intercept clicks", async ({
  page,
}) => {
  await page.goto("/?sky=2026-12-15T16:55&wx=partly");
  await page.waitForFunction(() => (window.__sky?.frames ?? 0) >= 1, null, { timeout: 8000 });
  const layers = await page.evaluate(() =>
    [
      "[data-sky-gradient]",
      "[data-sky-atmosphere]",
      "[data-sky-particles]",
      "[data-sky-landscape]",
      ".grain",
    ].map((sel) => {
      const el = document.querySelector(sel)!;
      const s = getComputedStyle(el);
      return {
        sel,
        hidden: el.getAttribute("aria-hidden"),
        pe: s.pointerEvents,
        pos: s.position,
        z: s.zIndex,
      };
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
  await page.waitForFunction(() => (window.__sky?.backing?.length ?? 0) > 3, null, {
    timeout: 8000,
  });
  expect(await page.locator("[data-sky-scrim], .text-scrim").count()).toBe(0);
  await page
    .getByRole("link", { name: /Support Agent/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/work\/support-agent$/);
});

test("the sun sits on the arc: on the horizon at sunrise, under the apex at noon, never clipped", async ({
  page,
}) => {
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

test("the first paint already has the right sky (no flash): night colours at 02:00", async ({
  page,
}) => {
  await page.goto("/?sky=2026-12-15T02:00&wx=clear", { waitUntil: "commit" });
  await page.waitForSelector("[data-sky-gradient]", { state: "attached" });
  const v = await page.evaluate(() => ({
    zenith: document.documentElement.style.getPropertyValue("--sky-zenith"),
    state: document.documentElement.dataset.sky,
  }));
  expect(v.zenith).toBe("#060b16");
  expect(v.state).toBe("night");
});
