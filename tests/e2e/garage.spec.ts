import { expect, test, type Page } from "@playwright/test";
import { buses, metrics, profile, ui } from "../../src/content";
import { stations } from "../../src/scene";

const order = stations.map((station) => station.id);
const links = stations.filter((station) => station.href);
const station = (page: Page, id: string) => page.locator(`[data-station="${id}"]`);

async function lights(page: Page, value: "light" | "dark") {
  await page.addInitScript((stored) => {
    try {
      localStorage.setItem("lights", stored);
    } catch {
      // ignore
    }
  }, value);
}

test.describe("garage layout", () => {
  for (const width of [360, 768, 1440]) {
    for (const theme of ["light", "dark"] as const) {
      test(`/ at ${width}px, lights ${theme === "light" ? "on" : "off"}: no sideways scroll, twelve stations`, async ({ browser }) => {
        const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
        const page = await context.newPage();
        await lights(page, theme);
        await page.goto("/");
        if (theme === "dark") await expect(page.locator("html")).toHaveAttribute("data-lights", "off");
        else await expect(page.locator("html")).not.toHaveAttribute("data-lights", "off");
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow).toBeLessThanOrEqual(0);
        await expect(page.locator("[data-garage] [data-station]")).toHaveCount(12);
        for (const id of order) await expect(station(page, id)).toBeVisible();

        // every label is readable against anything it can sit on: 4.5 to 1 or better
        const worst = await page.evaluate(() => {
          const parse = (value: string) => (value.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number) as [number, number, number];
          const luminance = ([r, g, b]: [number, number, number]) => {
            const channel = (v: number) => (v / 255 <= 0.03928 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4);
            return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
          };
          const ratio = (a: string, b: string) => {
            const [hi, lo] = [luminance(parse(a)), luminance(parse(b))].sort((x, y) => y - x) as [number, number];
            return (hi + 0.05) / (lo + 0.05);
          };
          const probe = document.createElement("i");
          document.body.append(probe);
          const resolve = (variable: string) => {
            probe.style.color = `var(${variable})`;
            return getComputedStyle(probe).color;
          };
          const room = ["--room-wall", "--room-band", "--room-platform", "--chalk"].map(resolve);
          probe.remove();
          let min = Infinity;
          for (const label of document.querySelectorAll<HTMLElement>(".station-label")) {
            const own = getComputedStyle(label).backgroundColor;
            const grounds = /rgba?\(0, 0, 0, 0\)|transparent/.test(own) ? room : [own];
            for (const ground of grounds) min = Math.min(min, ratio(getComputedStyle(label).color, ground));
          }
          return min;
        });
        expect(worst).toBeGreaterThanOrEqual(4.5);
        await context.close();
      });
    }
  }

  test("a scaled room from 1024px, one stacked column below it", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.goto("/");
    await expect(station(page, "rack")).toHaveCSS("position", "absolute");
    const room = (await page.locator("[data-garage]").boundingBox())!;
    expect(room.width / room.height).toBeCloseTo(16 / 9, 1);
    for (const id of order) {
      const box = (await station(page, id).boundingBox())!;
      expect(box.x, id).toBeGreaterThanOrEqual(room.x - 1);
      expect(box.x + box.width, id).toBeLessThanOrEqual(room.x + room.width + 1);
    }

    await page.setViewportSize({ width: 768, height: 900 });
    await expect(station(page, "rack")).toHaveCSS("position", "relative");
    await expect(page.locator(".garage-backdrop")).toBeHidden();
    let last = -1;
    for (const id of order) {
      const box = (await station(page, id).boundingBox())!;
      expect(box.y, id).toBeGreaterThan(last);
      last = box.y;
    }
    await context.close();
  });
});

test.describe("garage content", () => {
  test("header is the first thing in the page and nothing in it is invented", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toHaveText(profile.name);
    await expect(page.getByText(profile.line)).toBeVisible();
    const items = page.locator(".garage-metrics > li");
    await expect(items).toHaveCount(6);
    for (const [index, metric] of metrics.entries()) {
      await expect(items.nth(index)).toContainText(metric.value);
      await expect(items.nth(index)).toContainText(metric.short);
    }
    await expect(page.locator(".garage-actions a").first()).toHaveAttribute("href", profile.links.calendar.href);
    await expect(page.locator(".garage-email")).toHaveAttribute("href", profile.links.email.href);
    // DOM order: text block, room, plain list
    const sequence = await page.evaluate(() => [...document.querySelectorAll("main > *")].map((node) => node.className.split(" ").pop()));
    expect(sequence).toEqual(["garage-header", "garage", "garage-list"]);
  });

  test("every station is a real link with a label and its plain meaning", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("[data-garage]")).toHaveAttribute("role", "group");
    await expect(page.locator("[data-garage]")).toHaveAttribute("aria-label", ui.garage.sceneAria);
    for (const entry of links) {
      const node = station(page, entry.id);
      await expect(node).toHaveAttribute("href", entry.href!);
      await expect(node.locator(".station-label b")).toHaveText(entry.label);
      await expect(node.locator(".station-label .plain")).toHaveText(entry.plain);
      await expect(node.locator(".station-label")).toHaveCSS("font-family", /IBM Plex Mono/);
    }
    await expect(page.locator('[data-station][data-art="svg"]')).toHaveCount(2);
    await expect(page.locator('a[data-station][data-art="pending"]')).toHaveCount(9);
    await expect(station(page, "whiteboard").locator(".station-obj")).toHaveCSS("border-top-style", "dashed");
  });

  test("the rack carries six plates a side, each titled with its category", async ({ page }) => {
    await page.goto("/");
    for (const side of ["l", "r"]) {
      const plates = station(page, "rack").locator(`[data-rk="plate"][data-side="${side}"]`);
      await expect(plates).toHaveCount(6);
      for (const [index, bus] of buses.entries()) await expect(plates.nth(index).locator("title")).toHaveText(bus.name);
    }
    await expect(page.locator("#section-list")).toContainText(buses.map((bus) => bus.name).join(", "));
  });

  test("station links land on the preserved pages", async ({ page }) => {
    await page.goto("/");
    await page.locator('#section-list a[href="/log/#no-lift"]').click();
    await expect(page).toHaveURL(/\/log\/#no-lift$/);
    await expect(page.locator("#no-lift")).toBeInViewport();
    await page.goto("/");
    await station(page, "kit").click();
    await expect(page).toHaveURL(/\/gym\/$/);
  });
});

test.describe("garage without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("text block, room links and the plain list all work", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toHaveText(profile.name);
    await expect(page.locator(".garage-metrics > li")).toHaveCount(6);
    await expect(page.locator("[data-garage] a[data-station]")).toHaveCount(11);
    const list = page.locator("#section-list ol a");
    await expect(list).toHaveCount(11);
    for (const [index, entry] of links.entries()) await expect(list.nth(index)).toHaveAttribute("href", entry.href!);
    // the lamp needs JS, so it is not offered
    await expect(station(page, "lamp")).toBeHidden();
    // final state is in the markup: plates on the bar, idle pose showing
    await expect(station(page, "rack").locator('[data-rk="plate"]').first()).toBeVisible();
    await expect(station(page, "rack").locator('[data-rk="plate"]').first()).toHaveCSS("opacity", "1");
    await expect(station(page, "character").locator('[data-ch="idle"]')).toHaveCSS("opacity", "1");
    await expect(station(page, "character").locator('[data-ch="wave"]')).toHaveCSS("opacity", "0");
  });
});

test.describe("garage keyboard", () => {
  test("all twelve stations are reachable by Tab, in section order, with a visible focus ring", async ({ page }) => {
    await page.goto("/");
    await page.locator('.garage-head a[href="#section-list"]').focus();
    const seen: string[] = [];
    for (let index = 0; index < order.length; index += 1) {
      await page.keyboard.press("Tab");
      const focused = await page.evaluate(() => {
        const node = document.activeElement as HTMLElement;
        const style = getComputedStyle(node);
        const label = getComputedStyle(node.querySelector(".station-label b")!);
        return { id: node.dataset.station ?? "", outline: style.outlineStyle, width: parseFloat(style.outlineWidth), underline: label.textDecorationLine };
      });
      seen.push(focused.id);
      // a ring and an underline: focus never depends on colour alone
      expect(focused.outline, focused.id).toBe("solid");
      expect(focused.width, focused.id).toBeGreaterThanOrEqual(3);
      expect(focused.underline, focused.id).toContain("underline");
    }
    expect(seen).toEqual(order);
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => document.activeElement?.closest("#section-list") !== null)).toBe(true);
  });

  test("Enter on a focused station follows its link", async ({ page }) => {
    await page.goto("/");
    await station(page, "rack").focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/log\/#load-the-bar$/);
  });
});

test.describe("garage motion", () => {
  test("reduced motion: final poses, no animations, instant swaps", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.goto("/");
    const rack = station(page, "rack");
    const character = station(page, "character");
    await expect(rack).toHaveAttribute("data-entered", "");
    expect(await page.evaluate(() => document.querySelector("[data-garage]")!.getAnimations({ subtree: true }).length)).toBe(0);
    for (const plate of await rack.locator('[data-rk="plate"]').all()) {
      await expect(plate).toHaveCSS("opacity", "1");
      await expect(plate).toHaveCSS("transform", "none");
    }
    await expect(rack.locator('[data-rk="straight"]')).toHaveCSS("opacity", "1");
    await expect(rack.locator('[data-rk="bowed"]')).toHaveCSS("opacity", "0");
    await expect(character.locator('[data-ch="idle"]')).toHaveCSS("opacity", "1");
    await expect(character.locator("[data-ch-body]").first()).toHaveCSS("animation-name", "none");

    // hover and focus swap the state with no tween
    await character.hover();
    await expect(character.locator('[data-ch="wave"]')).toHaveCSS("opacity", "1");
    await expect(character.locator('[data-ch="idle"]')).toHaveCSS("opacity", "0");
    await rack.focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    await expect(rack.locator('[data-rk="bowed"]')).toHaveCSS("opacity", "1");
    expect(await page.evaluate(() => document.querySelector("[data-garage]")!.getAnimations({ subtree: true }).length)).toBe(0);
    await context.close();
  });

  test("with motion: the entry plays once, plates seat, and nothing replays on scroll", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.goto("/");
    const rack = station(page, "rack");
    await rack.scrollIntoViewIfNeeded();
    await expect(rack).toHaveAttribute("data-entered", "");
    const running = () =>
      page.evaluate(() => document.querySelector('[data-station="rack"]')!.getAnimations({ subtree: true }).filter((animation) => animation.playState === "running").length);
    await expect.poll(running).toBe(0);
    for (const plate of await rack.locator('[data-rk="plate"]').all()) {
      await expect(plate).toHaveCSS("opacity", "1");
      await expect(plate).toHaveCSS("transform", "none");
    }
    // away and back: the entry does not run again
    await page.locator("footer").scrollIntoViewIfNeeded();
    await rack.scrollIntoViewIfNeeded();
    await page.waitForTimeout(150);
    expect(await running()).toBe(0);

    // hover plays the interaction: plates rattle and the bowed bar shows for a moment
    await page.mouse.move(5, 5);
    await rack.hover();
    await expect.poll(running).toBeGreaterThan(0);
    await expect.poll(running).toBe(0);
    await expect(rack.locator('[data-rk="bowed"]')).toHaveCSS("opacity", "0");
    await context.close();
  });

  test("idle loop runs on screen only", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 700 } });
    const page = await context.newPage();
    await page.goto("/");
    const body = station(page, "character").locator('[data-ch="idle"] [data-ch-body]');
    await station(page, "character").scrollIntoViewIfNeeded();
    await expect(body).toHaveCSS("animation-play-state", "running");
    await page.locator("footer").scrollIntoViewIfNeeded();
    await page.mouse.wheel(0, 4000);
    await expect(body).toHaveCSS("animation-play-state", "paused");
    await context.close();
  });

  test("touch: a long interaction takes the first tap, a short one navigates at once", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 800 }, hasTouch: true, isMobile: true });
    const page = await context.newPage();
    await page.goto("/");
    const character = station(page, "character");
    await character.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1800); // let the entry finish
    await character.tap();
    await expect(page).toHaveURL(/\/$/);
    await expect(character).toHaveAttribute("data-active", "");
    await character.tap();
    await expect(page).toHaveURL(/\/log\/#platform$/);

    await page.goto("/");
    await station(page, "rack").tap();
    await expect(page).toHaveURL(/\/log\/#load-the-bar$/);
    await context.close();
  });
});

test.describe("garage lights", () => {
  test("the lamp toggles the lights, the choice persists and applies before paint", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).not.toHaveAttribute("data-lights", "off");
    const wall = () => page.evaluate(() => getComputedStyle(document.querySelector(".room-wall")!).fill);
    const lit = await wall();
    await station(page, "lamp").click();
    await expect(page.locator("html")).toHaveAttribute("data-lights", "off");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    expect(await wall()).not.toBe(lit);
    await expect(station(page, "lamp").locator("b.when-dark")).toBeVisible();
    await page.goto("/", { waitUntil: "commit" });
    await expect(page.locator("html")).toHaveAttribute("data-lights", "off");
    await station(page, "lamp").click();
    await expect(page.locator("html")).not.toHaveAttribute("data-lights", "off");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  });

  test("a first visit follows the system colour scheme, a stored choice wins", async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: "dark" });
    const page = await context.newPage();
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-lights", "off");
    await station(page, "lamp").click();
    await page.reload();
    await expect(page.locator("html")).not.toHaveAttribute("data-lights", "off");
    await context.close();
  });
});
