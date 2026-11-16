import { expect, test, type Page } from "@playwright/test";
import { buses, goals, metrics, profile, ui } from "../../src/content";
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
    // eleven objects are drawn. The desk sheet was rejected, so it is still a dashed box, and still a link.
    await expect(page.locator('[data-station][data-art="svg"]')).toHaveCount(11);
    await expect(page.locator('a[data-station][data-art="pending"]')).toHaveCount(1);
    await expect(station(page, "desk").locator(".station-obj")).toHaveCSS("border-top-style", "dashed");
  });

  test("live text on blank surfaces: six numbers, the first goal, a clock placeholder that becomes Dhaka time", async ({ page }) => {
    await page.goto("/");
    const numbers = station(page, "whiteboard").locator(".wb-n");
    await expect(numbers).toHaveCount(6);
    for (const [index, metric] of metrics.entries()) await expect(numbers.nth(index)).toHaveText(metric.value);
    // decorative copies: the same numbers are in the header list, with their labels
    await expect(station(page, "whiteboard").locator(".wb")).toHaveAttribute("aria-hidden", "true");

    const shown = station(page, "calendar").locator("[data-goal]:not([hidden])");
    await expect(station(page, "calendar").locator("[data-goal]")).toHaveCount(goals.length);
    await expect(shown).toHaveCount(1);
    await expect(shown).toContainText(goals[0]!.lift);
    await expect(shown).toContainText(goals[0]!.target);

    const clock = station(page, "kit").locator("[data-clock]");
    await expect(clock).toHaveText(/^\d{2}:\d{2}:\d{2}$/);
    const dhaka = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dhaka", hour: "2-digit", hour12: false }).format(new Date());
    expect([dhaka, String((Number(dhaka) + 23) % 24).padStart(2, "0")]).toContain((await clock.textContent())!.slice(0, 2));
    // no text is baked into a drawing
    expect(await page.locator("[data-garage] svg text").count()).toBe(0);
  });

  test("objects after the rack and the character are drawn from sprite files that exist", async ({ page, request }) => {
    await page.goto("/");
    await expect(page.locator("[data-garage] use[data-href]:not([href])")).toHaveCount(0);
    const hrefs = await page.locator("[data-garage] use").evaluateAll((uses) => [...new Set(uses.map((use) => use.getAttribute("href")!))]);
    expect(hrefs.length).toBeGreaterThan(40);
    const files = [...new Set(hrefs.map((href) => href.split("#")[0]!))];
    expect(files.map((file) => file.split("?")[0]).sort()).toEqual(["a03", "a05", "a06", "a07", "a08", "a09", "a10", "a11", "a12"].map((id) => `/illustrations/${id}.svg`));
    for (const file of files) {
      const body = await (await request.get(file)).text();
      for (const href of hrefs.filter((entry) => entry.startsWith(file))) expect(body, href).toContain(`<g id="${href.split("#")[1]}">`);
    }
    // drawn, not empty: the bike's frame has a size on screen
    const frame = await station(page, "bike").locator('[data-p="frame"]').boundingBox();
    expect(frame!.width).toBeGreaterThan(20);
  });

  test("the bot says the plain label of the station in focus, silently for assistive tech", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    const say = page.locator("[data-say]");
    await expect(say).toHaveAttribute("aria-live", "off");
    await expect(say).toBeHidden();
    for (const id of ["rack", "bin", "bot"]) {
      const entry = links.find((link) => link.id === id)!;
      await station(page, id).hover();
      await expect(say).toHaveText(entry.plain);
      await expect(say).toBeVisible();
    }
    await page.mouse.move(2, 2);
    await expect(say).toBeHidden();
    await station(page, "calendar").focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    await expect(say).toHaveText(links.find((link) => link.id === "calendar")!.plain);
    // the speech is not inside any link, so it never changes a link's name
    expect(await say.evaluate((node) => node.closest("a, button"))).toBeNull();
  });

  test("the calendar tears a page per interaction and wraps after the last goal", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.goto("/");
    const shown = station(page, "calendar").locator("[data-goal]:not([hidden])");
    for (let turn = 1; turn <= goals.length; turn += 1) {
      await page.mouse.move(2, 2);
      await station(page, "calendar").hover();
      await expect(shown).toHaveCount(1);
      await expect(shown.locator("b")).toHaveText(goals[turn % goals.length]!.lift);
      await expect(shown.locator("span")).toHaveText(goals[turn % goals.length]!.target);
    }
    await context.close();
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
    // all six numbers, the first goal and the clock placeholder are in the markup
    await expect(station(page, "whiteboard").locator(".wb-n").last()).toBeVisible();
    await expect(station(page, "whiteboard").locator(".wb-row").first()).toHaveCSS("opacity", "1");
    await expect(station(page, "calendar").locator("[data-goal]:not([hidden])")).toContainText(goals[0]!.lift);
    await expect(station(page, "kit").locator("[data-clock]")).toHaveText(ui.garage.clockPlaceholder);
    // parts that only show in motion stay out of the final pose
    // without JS the drawing is the copy inside <noscript>, with its sprite references already attached
    for (const [id, part] of [["chalk", "page"], ["calendar", "tear"], ["bot", "head-happy"], ["whiteboard", "line"], ["phone", "rings"]]) {
      await expect(station(page, id!).locator(`noscript [data-p="${part}"]`)).toHaveCSS("opacity", "0");
    }
    await expect(station(page, "bike").locator('noscript [data-p="frame"] use')).toHaveAttribute("href", /^\/illustrations\/a06\.svg\?v=\d+#frame$/);
    expect((await station(page, "bike").locator('noscript [data-p="frame"]').boundingBox())!.width).toBeGreaterThan(20);
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
        // the focused element is the station itself, or for the lamp the pull cord inside it
        const node = document.activeElement as HTMLElement;
        const style = getComputedStyle(node);
        const label = getComputedStyle(node.querySelector(".station-label b")!);
        return { id: node.closest<HTMLElement>("[data-station]")?.dataset.station ?? "", outline: style.outlineStyle, width: parseFloat(style.outlineWidth), underline: label.textDecorationLine };
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
    // the new objects: final poses, numbers on the board, kickstand up, nothing mid-sequence
    await expect(station(page, "whiteboard").locator(".wb-row").first()).toHaveCSS("opacity", "1");
    await expect(station(page, "whiteboard").locator(".wb-row").first()).toHaveCSS("clip-path", "none");
    await expect(station(page, "bike").locator('[data-p="stand"]')).toHaveCSS("transform", "none");
    await expect(station(page, "bot").locator('[data-p="head-open"]')).toHaveCSS("opacity", "1");
    await expect(station(page, "phone").locator('[data-p="handset"]')).toHaveCSS("transform", "none");
    await station(page, "phone").hover();
    await expect(station(page, "phone").locator('[data-p="handset"]')).not.toHaveCSS("transform", "none");
    await expect(station(page, "bot").locator('[data-p="head-happy"]')).toHaveCSS("opacity", "1");

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

  test("with motion: the whiteboard wipes in once and every number ends on its real value", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.goto("/");
    const board = station(page, "whiteboard");
    await board.scrollIntoViewIfNeeded();
    await expect(board).toHaveAttribute("data-entered", "");
    const running = () =>
      page.evaluate(() => document.querySelector('[data-station="whiteboard"]')!.getAnimations({ subtree: true }).filter((animation) => animation.playState === "running").length);
    await expect.poll(running).toBe(0);
    for (const [index, metric] of metrics.entries()) await expect(board.locator(".wb-n").nth(index)).toHaveText(metric.value);
    await expect(board.locator('[data-p="marker-at"]')).toHaveCSS("transform", "none");

    // hovering a number: the marker underlines that one, and lets go when the pointer leaves
    await board.locator(".wb-n").nth(4).hover();
    const line = board.locator('[data-p="line"]');
    await expect(line).toHaveCSS("opacity", "1");
    await expect.poll(running).toBe(0);
    const under = await board.locator(".wb-n").nth(4).boundingBox();
    const drawn = await line.boundingBox();
    expect(Math.abs(drawn!.x + drawn!.width / 2 - (under!.x + under!.width / 2))).toBeLessThan(12);
    expect(drawn!.y).toBeGreaterThan(under!.y);
    await page.mouse.move(2, 2);
    await expect(line).toHaveCSS("opacity", "0");
    await context.close();
  });

  test("with motion: only transform, opacity and the whiteboard's clip-path are animated", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.goto("/");
    await page.locator("[data-garage]").scrollIntoViewIfNeeded();
    const seen = new Set<string>();
    for (const id of ["-", ...order]) {
      if (id !== "-") await station(page, id).hover();
      const properties = await page.evaluate(() =>
        document
          .querySelector("[data-garage]")!
          .getAnimations({ subtree: true })
          .flatMap((animation) => (animation.effect as KeyframeEffect).getKeyframes().flatMap((frame) => Object.keys(frame)))
          .filter((key) => !["offset", "computedOffset", "easing", "composite"].includes(key)),
      );
      properties.forEach((property) => seen.add(property));
    }
    expect([...seen].sort()).toEqual(["clipPath", "opacity", "transform"]);
    await context.close();
  });

  test("idle loops: the bot, the phone and the lamp run on screen only", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 700 } });
    const page = await context.newPage();
    await page.goto("/");
    await station(page, "rack").scrollIntoViewIfNeeded();
    const loops = [
      station(page, "bot").locator('[data-p="antenna-bob"]'),
      station(page, "phone").locator('[data-p="handset"]'),
      station(page, "lamp").locator('[data-p="sway"]'),
      station(page, "lamp").locator('[data-p="cord-sway"]'),
    ];
    for (const loop of loops) await expect(loop).toHaveCSS("animation-play-state", "running");
    await page.locator("footer").scrollIntoViewIfNeeded();
    await page.mouse.wheel(0, 4000);
    for (const loop of loops) await expect(loop).toHaveCSS("animation-play-state", "paused");
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
  const cord = (page: Page) => station(page, "lamp").locator("button[data-lights-toggle]");

  test("the pull cord toggles the lights, the choice persists and applies before paint", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).not.toHaveAttribute("data-lights", "off");
    await expect(cord(page)).toHaveAttribute("aria-pressed", "false");
    await expect(cord(page)).toHaveAccessibleName(new RegExp(`${ui.topbar.lightsOut}.*${ui.topbar.lightsOutPlain}`));
    // the light cone is there while the lights are on
    const cone = station(page, "lamp").locator('[data-p="cone"]');
    expect(Number(await cone.evaluate((node) => getComputedStyle(node).opacity))).toBeGreaterThan(0);
    const wall = () => page.evaluate(() => getComputedStyle(document.querySelector(".room-wall")!).fill);
    const lit = await wall();
    await cord(page).click();
    await expect(page.locator("html")).toHaveAttribute("data-lights", "off");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(cord(page)).toHaveAttribute("aria-pressed", "true");
    await expect(cone).toHaveCSS("opacity", "0");
    expect(await wall()).not.toBe(lit);
    await page.goto("/", { waitUntil: "commit" });
    await expect(page.locator("html")).toHaveAttribute("data-lights", "off");
    await expect(cord(page)).toHaveAttribute("aria-pressed", "true");
    // keyboard: the cord is a real button
    await cord(page).focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("html")).not.toHaveAttribute("data-lights", "off");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(cord(page)).toHaveAttribute("aria-pressed", "false");
  });

  test("a first visit follows the system colour scheme, a stored choice wins", async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: "dark" });
    const page = await context.newPage();
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-lights", "off");
    await cord(page).click();
    await page.reload();
    await expect(page.locator("html")).not.toHaveAttribute("data-lights", "off");
    await context.close();
  });
});
