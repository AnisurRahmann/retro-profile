import { expect, test, type Page } from "@playwright/test";
import { buses, metrics, profile, projects } from "../../src/content";
import { GYM_DAYS, GYM_RULES } from "../../src/gym";

const ids = projects.map((project) => project.id);
const shipped = projects.filter((project) => project.status === "shipped");

async function liveGame(page: Page) {
  await page.locator("#h-load-the-bar").scrollIntoViewIfNeeded();
  await expect(page.locator('[data-ltb="live"]')).toBeVisible();
}

const plate = (page: Page, id: string) => page.locator(`[data-rack] [data-plate-id="${id}"]`);

test.describe("layout", () => {
  for (const path of ["/", "/gym/", "/notes/", "/notes/plaid-costs/"]) {
    test(`no horizontal scroll at 360px on ${path}`, async ({ browser }) => {
      const context = await browser.newContext({ viewport: { width: 360, height: 740 }, reducedMotion: "reduce" });
      const page = await context.newPage();
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(0);
      await context.close();
    });
  }

  test("name, role, six PRs and book-a-call sit inside the first two screens at 360px", async ({ browser }) => {
    const height = 740;
    const context = await browser.newContext({ viewport: { width: 360, height }, reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.goto("/");
    await expect(page.locator("h1")).toHaveText(new RegExp(profile.name.replace(" ", "\\s*"), "i"));
    await expect(page.locator(".topbar-cta")).toBeInViewport();
    await expect(page.getByText(profile.line)).toBeVisible();
    const items = page.locator(".pr-strip > li");
    await expect(items).toHaveCount(6);
    const box = await items.last().boundingBox();
    expect(box && box.y + box.height).toBeLessThanOrEqual(height * 2);
    await context.close();
  });
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("home still has every project, metric, block, goal, outcome and gym day", async ({ page }) => {
    await page.goto("/");
    for (const id of ids) {
      await expect(page.locator(`[data-rack] a[data-plate-id="${id}"]`)).toHaveAttribute("href", `#reg-${id}`);
      await expect(page.locator(`#reg-${id}`)).toBeVisible();
    }
    for (const metric of metrics) await expect(page.locator(`#${metric.id}`)).toContainText(metric.value);
    await expect(page.locator("details.tblock")).toHaveCount(5);
    await expect(page.locator("[data-goal]")).toHaveCount(16);
    await expect(page.locator("[data-miss]")).toHaveCount(3);
    const outcomes = page.locator(".yc-outcome");
    await expect(outcomes).toHaveCount(5);
    for (let index = 0; index < 5; index += 1) await expect(outcomes.nth(index)).toBeVisible();
    await expect(page.locator("#actual-log .is-day")).toHaveCount(7);
    await expect(page.locator(".hero-week")).toBeVisible();
    await expect(page.locator("[data-contact]")).toHaveCount(4);
    // JS-only controls stay out of the way
    await expect(page.locator("[data-lights-toggle]")).toBeHidden();
  });

  test("/gym still has all seven days and the rules", async ({ page }) => {
    await page.goto("/gym/");
    await expect(page.locator("[data-gym-day]")).toHaveCount(7);
    for (const day of GYM_DAYS) for (const exercise of day.exercises) await expect(page.locator(`#${day.id}`)).toContainText(exercise.name);
    await expect(page.locator("[data-gym-rule]")).toHaveText(GYM_RULES);
  });
});

test.describe("projects", () => {
  test("every project is in the rack and the register with the right colour and lights", async ({ page }) => {
    await page.goto("/");
    await liveGame(page);
    for (const project of projects) {
      const bus = buses.find((entry) => entry.id === project.bus)!;
      const button = plate(page, project.id);
      await expect(button).toHaveCount(1);
      await expect(button).toHaveAttribute("data-bus", project.bus);
      await expect(button).toHaveAttribute("data-size", project.status);
      await expect(button).toContainText(bus.stamp);
      const row = page.locator(`#reg-${project.id}`);
      await expect(row).toContainText(project.name);
      await expect(row).toContainText(bus.name);
      await expect(row.locator(`[data-status="${project.status}"]`)).toHaveCount(1);
    }
    const colour = await plate(page, "P-01").evaluate((node) => getComputedStyle(node).backgroundColor);
    expect(colour).toBe("rgb(214, 40, 40)");
    await expect(page.locator("#h-load-the-bar").locator("..")).toContainText(`${ids.length} plates`, { ignoreCase: true });
  });

  test("register filters and sorts", async ({ page }) => {
    await page.goto("/");
    await page.locator('[data-filter="bus"]').selectOption("voice");
    await expect(page.locator("tr[data-row]")).toHaveCount(4);
    await expect(page.locator("[data-showing]")).toContainText("4 / 27");
    await page.locator('[data-filter="bus"]').selectOption("all");
    await page.locator('[data-sort="status"]').click();
    await expect(page.locator("tr[data-row]").first()).toHaveAttribute("data-row", shipped[0]!.id);
    await page.locator('[data-sort="id"]').click();
    await page.locator('[data-sort="id"]').click();
    await expect(page.locator("tr[data-row]").first()).toHaveAttribute("data-row", "P-27");
  });
});

test.describe("Load the Bar", () => {
  test("has a skip link to the register", async ({ page }) => {
    await page.goto("/");
    await page.locator("[data-skip-game]").click();
    await expect(page).toHaveURL(/#register$/);
  });

  test("works by keyboard, celebrates once, strips and persists", async ({ page }) => {
    await page.goto("/");
    await liveGame(page);
    await plate(page, "P-01").focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("[data-counter]")).toContainText("1 / 27");
    await expect(page.locator("[data-detail-name]")).toHaveText("Callback AI");
    await expect(page.locator("[data-ltb-live]")).toHaveText("Loaded Callback AI, 1 of 27");
    await expect(plate(page, "P-01")).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("[data-goodlift]")).toHaveCount(0);

    for (const project of shipped) {
      await plate(page, project.id).focus();
      await page.keyboard.press("Space");
    }
    await expect(page.locator("[data-counter]")).toContainText(`${shipped.length + 1} / 27`);
    await expect(page.locator("[data-goodlift]")).toBeVisible();
    await expect(page.locator(".ltb-bar .eplate")).toHaveCount(shipped.length + 1);

    await page.reload();
    await liveGame(page);
    await expect(page.locator("[data-counter]")).toContainText(`${shipped.length + 1} / 27`);

    await page.locator("[data-unload]").focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("[data-counter]")).toContainText(`${shipped.length} / 27`);

    await page.locator("[data-strip]").focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("[data-counter]")).toContainText("0 / 27");
    await expect(page.locator(".ltb-bar .eplate")).toHaveCount(0);
  });

  test("drag a plate onto the bar with the mouse", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/");
    await liveGame(page);
    await plate(page, "P-13").scrollIntoViewIfNeeded();
    const from = (await plate(page, "P-13").boundingBox())!;
    const to = (await page.locator("[data-dropzone]").boundingBox())!;
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(to.x + to.width / 2, to.y + 60, { steps: 12 });
    await expect(page.locator(".drag-ghost")).toHaveCount(1);
    await expect(page.locator("[data-dropzone]")).toHaveAttribute("data-over", "");
    await page.mouse.up();
    await expect(page.locator(".drag-ghost")).toHaveCount(0);
    await expect(page.locator("[data-counter]")).toContainText("1 / 27");
    await expect(page.locator("[data-detail-name]")).toHaveText("Lift");
    // a drag released off the bar loads nothing
    const other = (await plate(page, "P-11").boundingBox())!;
    await page.mouse.move(other.x + other.width / 2, other.y + other.height / 2);
    await page.mouse.down();
    await page.mouse.move(other.x + 40, other.y + other.height + 60, { steps: 6 });
    await page.mouse.up();
    await expect(page.locator("[data-counter]")).toContainText("1 / 27");
  });

  test("tap loads a plate on a touch screen", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 800 }, hasTouch: true, isMobile: true });
    const page = await context.newPage();
    await page.goto("/");
    await liveGame(page);
    await plate(page, "P-12").tap();
    await expect(page.locator("[data-counter]")).toContainText("1 / 27");
    await expect(page.locator("[data-detail-name]")).toHaveText("LLM Wiki Kit");
    await expect(page.locator("[data-detail]")).toBeInViewport();
    await context.close();
  });
});

test.describe("Your Call", () => {
  test("is operable by keyboard and never scores", async ({ page }) => {
    await page.goto("/");
    const first = page.locator("[data-yc]").first();
    await first.scrollIntoViewIfNeeded();
    await expect(first.locator(".yc-outcome")).toBeHidden();
    await first.locator('input[type="radio"]').first().focus();
    await page.keyboard.press("Space");
    await expect(first.locator(".yc-outcome")).toBeVisible();
    await expect(first.locator(".yc-outcome")).toContainText("$100K → $25K a month.");
    await expect(first.locator('.yc-outcome [data-status="shipped"]')).toBeVisible();
    await page.keyboard.press("ArrowDown");
    await expect(first.locator(".yc-outcome")).toBeVisible();
    await expect(page.locator("[data-yc-live]")).not.toBeEmpty();
    await expect(page.locator("[data-yc]").nth(1).locator(".yc-outcome")).toBeHidden();
    await page.locator("#yc-all").focus();
    await page.keyboard.press("Space");
    for (let index = 0; index < 5; index += 1) await expect(page.locator(".yc-outcome").nth(index)).toBeVisible();
  });
});

test.describe("reduced motion", () => {
  test("renders final states with no animation", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    await page.goto("/");
    await expect(page.locator("[data-armed]")).toHaveCount(0);
    const animation = await page.locator(".hero-bar .eplate").first().evaluate((node) => getComputedStyle(node).animationName);
    expect(animation).toBe("none");
    const heroBar = await page.locator(".hero-bar").evaluate((node) => getComputedStyle(node).animationName);
    expect(heroBar).toBe("none");
    await page.locator("#pr-01").scrollIntoViewIfNeeded();
    await expect(page.locator("#pr-01 [data-countup]")).toHaveText(metrics[0]!.value);
    await liveGame(page);
    await plate(page, "P-01").click();
    const slide = await page.locator(".ltb-bar .eplate").first().evaluate((node) => getComputedStyle(node).animationName);
    expect(slide).toBe("none");
    await context.close();
  });

  test("with motion allowed, lights arm below the fold and switch on when seen", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#pr-06 [data-reveal]")).toHaveAttribute("data-armed", "");
    await page.locator("#pr-06").scrollIntoViewIfNeeded();
    await expect(page.locator("#pr-06 [data-reveal]")).toHaveAttribute("data-lit", "");
    await expect(page.locator("#pr-06 [data-countup]")).toHaveText(metrics[5]!.value);
  });
});

test.describe("today's session", () => {
  const cases = [
    { utc: "2026-11-15T20:00:00Z", day: "monday", text: /Monday.*Pull-Up \(Heavy\).*~70 min/i }, // 02:00 Monday in Dhaka
    { utc: "2026-11-15T17:30:00Z", day: "sunday", text: /Sunday.*Rest/i }, // 23:30 Sunday in Dhaka
    { utc: "2026-11-12T18:30:00Z", day: "friday", text: /Friday.*Squat \(Heavy\).*~85-90 min/i }, // 00:30 Friday in Dhaka
  ];
  for (const entry of cases) {
    test(`shows ${entry.day} for ${entry.utc}`, async ({ page }) => {
      await page.clock.setFixedTime(new Date(entry.utc));
      await page.goto("/");
      await expect(page.locator("html")).toHaveAttribute("data-today", entry.day);
      const chip = page.locator("[data-today-chip]:visible");
      await expect(chip).toHaveCount(1);
      await expect(chip).toHaveText(entry.text);
      await expect(chip).toHaveAttribute("href", `/gym/#${entry.day}`);
      await expect(page.locator(".hero-week")).toBeHidden();
    });
  }
});

test.describe("theme and keyboard", () => {
  test("lights toggle persists and applies before paint", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await page.locator("[data-lights-toggle]").click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.goto("/gym/", { waitUntil: "commit" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    const background = await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);
    expect(background).toBe("rgb(14, 15, 17)");
  });

  test("0 to 8 jump to flights, L toggles lights, G opens the gym log", async ({ page }) => {
    await page.goto("/");
    await page.locator("body").click({ position: { x: 5, y: 400 } });
    await page.keyboard.press("3");
    await expect(page).toHaveURL(/#load-the-bar$/);
    await page.keyboard.press("8");
    await expect(page).toHaveURL(/#spot-me$/);
    await page.keyboard.press("l");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.keyboard.press("g");
    await expect(page).toHaveURL(/\/gym\/$/);
    await page.keyboard.press("5");
    await expect(page).toHaveURL(/\/#next-block$/);
  });
});

test.describe("pages", () => {
  test("/gym deep links, old URL shape and metadata", async ({ page }) => {
    await page.goto("/gym#wednesday");
    await expect(page.locator("#wednesday")).toBeInViewport();
    await expect(page).toHaveTitle("The Actual Log: Shakil's Weekly Training Split");
    await expect(page.locator("#wednesday")).toContainText("Romanian Deadlift");
  });

  test("home metadata, JSON-LD and assets", async ({ page, request }) => {
    await page.goto("/");
    await expect(page).toHaveTitle("Anisur Rahman (Shakil): Fullstack AI Engineer, Voice Agents and Agentic Systems");
    const person = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent()) ?? "{}");
    expect(person["@type"]).toBe("Person");
    expect(person.sameAs).toEqual(["https://github.com/AnisurRahmann", "https://linkedin.com/in/shakil22"]);
    for (const path of ["/og.png", "/resume.pdf", "/robots.txt", "/sitemap.xml", "/icon.svg"]) {
      expect((await request.get(path)).status(), path).toBe(200);
    }
  });

  test("notes index lists seven posts and a post renders", async ({ page }) => {
    await page.goto("/notes/");
    await expect(page.locator("[data-note]")).toHaveCount(7);
    await page.locator("[data-note]").first().click();
    await expect(page.locator("h1")).toHaveText(/How I cut \$900K\/year from Plaid costs/i);
  });

  test("Meta app review pages survive the rebuild, readable without JS", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto("/fb-privacy");
    await expect(page.locator("h1")).toHaveText(/Privacy Policy/i);
    await expect(page.locator("main")).toContainText("Build Box");
    await page.goto("/fb-data-deletion");
    await expect(page.locator("h1")).toHaveText(/Data Deletion/i);
    await expect(page.locator('main a[href="/fb-privacy"]')).toHaveCount(1);
    await context.close();
  });

  test("no emoji and no unfilled placeholders in the rendered pages", async ({ page }) => {
    for (const path of ["/", "/gym/", "/notes/"]) {
      await page.goto(path);
      const text = await page.locator("body").innerText();
      expect(text).not.toMatch(/\[\[|\]\]/);
      expect(text).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });
});
