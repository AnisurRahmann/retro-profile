import { gzipSync } from "node:zlib";
import { expect, test, type Page } from "@playwright/test";
import { projects, sheets } from "../src/content";

const ids = projects.map((p) => p.id);

async function ready(page: Page) {
  await page.goto("/");
  await page.waitForFunction(() => document.querySelector(".sheet-tag") !== null);
  // The map island is lazy: wait until it has hydrated.
  await page.waitForFunction(() => {
    const node = document.querySelector("#map-node-P-01");
    return node !== null && Object.keys(node).some((k) => k.startsWith("__reactProps"));
  });
}

test.describe("layout", () => {
  test("no horizontal scroll at 360px", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await ready(page);
    const overflow = await page.evaluate(() => {
      const doc = document.documentElement;
      const wide = Array.from(document.querySelectorAll<HTMLElement>("main *"))
        .filter(
          (el) =>
            el.getBoundingClientRect().right > window.innerWidth + 1 && el.offsetParent !== null,
        )
        .slice(0, 5)
        .map((el) => `${el.tagName}.${el.className}`);
      return { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth, wide };
    });
    expect(overflow.wide).toEqual([]);
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth);
  });

  test("renders all eight sheets with title blocks", async ({ page }) => {
    await ready(page);
    await expect(page.locator("section.sheet")).toHaveCount(sheets.length);
    await expect(page.locator("section.sheet .title-block")).toHaveCount(sheets.length);
    await expect(page.locator("h1")).toHaveCount(1);
  });
});

test.describe("projects", () => {
  test("every project id appears in both the system map and the register", async ({ page }) => {
    await ready(page);
    const inMap = await page
      .locator(".map-svg .map-node")
      .evaluateAll((els) => els.map((el) => el.getAttribute("data-pid")));
    const inList = await page
      .locator(".map-list .bus-node")
      .evaluateAll((els) => els.map((el) => el.getAttribute("data-pid")));
    const inRegister = await page
      .locator("[data-register] tr.reg-row")
      .evaluateAll((els) => els.map((el) => el.getAttribute("data-pid")));
    expect([...inMap].sort()).toEqual([...ids].sort());
    expect([...inList].sort()).toEqual([...ids].sort());
    expect([...inRegister].sort()).toEqual([...ids].sort());
  });

  test("node outline encodes status and counters are computed from data", async ({ page }) => {
    await ready(page);
    for (const p of projects) {
      await expect(page.locator(`#map-node-${p.id} .shape`)).toHaveAttribute(
        "data-status",
        p.status,
      );
    }
    const counts = new Map<string, number>();
    for (const p of projects) counts.set(p.status, (counts.get(p.status) ?? 0) + 1);
    for (const [status, n] of counts) {
      await expect(page.locator(`[data-count="${status}"]`)).toHaveText(String(n));
    }
    await expect(page.locator('[data-count="TOTAL"]')).toHaveText(String(projects.length));
  });

  test("hover cross-highlights the map and the register", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await ready(page);
    await page.locator('tr.reg-row[data-pid="P-05"]').hover();
    await expect(page.locator("#map-node-P-05")).toHaveClass(/is-hl/);
    await expect(page.locator("#map-node-P-13")).toHaveClass(/is-near/);
    await page.locator("#map-node-P-01").hover();
    await expect(page.locator('tr.reg-row[data-pid="P-01"]')).toHaveClass(/is-hl/);
    await expect(page.locator('.map-wire[data-wire~="P-01"]').first()).toHaveClass(/is-hl/);
  });

  test("register filters, sorts and expands", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await ready(page);
    const rows = page.locator("tr.reg-row");
    await page
      .getByRole("group", { name: "Status" })
      .getByRole("button", { name: "Shipped" })
      .click();
    await expect(rows).toHaveCount(projects.filter((p) => p.status === "SHIPPED").length);
    await page.getByRole("group", { name: "Status" }).getByRole("button", { name: "All" }).click();
    await expect(rows).toHaveCount(projects.length);
    await page.locator(".reg thead").getByRole("button", { name: "Name" }).click();
    const names = await page.locator("tr.reg-row .reg-name").allTextContents();
    expect(names).toEqual(
      [...names].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())),
    );
    await page.locator('tr.reg-row[data-pid="P-16"] .reg-id button').click();
    await expect(page.locator("#reg-detail-P-16")).toContainText("review quality failed the bar");
  });
});

test.describe("redline layer", () => {
  test("toggle hides every goal annotation from the page and the accessibility tree", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await ready(page);
    const visibleRedlines = () =>
      page.evaluate(
        () =>
          Array.from(
            document.querySelectorAll<HTMLElement | SVGElement>(
              ".redline, .reg td.reg-next, [data-goal]",
            ),
          ).filter((el) => el.getClientRects().length > 0).length,
      );
    expect(await visibleRedlines()).toBeGreaterThan(40);
    await expect(page.locator("[data-goal]").first()).toBeVisible();

    await page.getByRole("switch", { name: "Redlines" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-redlines", "off");
    expect(await visibleRedlines()).toBe(0);
    await expect(page.locator("[data-goal]").first()).toBeHidden();
    await expect(page.getByRole("switch", { name: "Redlines" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
    const tree = await page.locator("main").ariaSnapshot();
    expect(tree).not.toContain("Lift to native iOS");
    expect(tree).not.toContain("Customer support voice agent as the second Callback product");

    await page.getByRole("switch", { name: "Redlines" }).click();
    expect(await visibleRedlines()).toBeGreaterThan(40);
  });

  test("theme and redline state persist without a flash or hydration error", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(e.message));
    await ready(page);
    await page.getByRole("switch", { name: "Blueprint mode" }).click();
    await page.getByRole("switch", { name: "Redlines" }).click();
    await page.reload();
    // Attributes are set by the inline head script, before hydration.
    await expect(page.locator("html")).toHaveAttribute("data-theme", "blueprint");
    await expect(page.locator("html")).toHaveAttribute("data-redlines", "off");
    await page.waitForFunction(() => document.querySelector(".sheet-tag") !== null);
    await expect(page.getByRole("switch", { name: "Blueprint mode" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).toBe("rgb(10, 31, 61)");
    expect(errors).toEqual([]);
  });
});

test.describe("keyboard", () => {
  test("0 to 7 jump to sheets, R toggles redlines, B toggles blueprint", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await ready(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const no of ["5", "0", "7", "3"]) {
      await page.keyboard.press(no);
      await expect(page.locator(`#sheet-0${no}`)).toBeInViewport();
      await expect(page.locator(".sheet-tag")).toHaveAttribute("data-current-sheet", `0${no}`);
    }
    await page.keyboard.press("r");
    await expect(page.locator("html")).toHaveAttribute("data-redlines", "off");
    await page.keyboard.press("r");
    await expect(page.locator("html")).toHaveAttribute("data-redlines", "on");
    await page.keyboard.press("b");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "blueprint");
    await page.keyboard.press("b");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "paper");
  });

  test("map nodes: arrow keys move, Enter opens the drawer", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await ready(page);
    await page.locator("#map-node-P-01").focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.locator("#map-node-P-02")).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(page.locator("#map-node-P-06")).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog")).toContainText("Subreddit Pulse");
  });

  test("drawer traps focus, Escape closes and returns focus", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await ready(page);
    const opener = page.locator("#map-node-P-11");
    await opener.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("Call Copilot");
    await expect(dialog.locator(".stamp")).toHaveText("Shipped");
    await expect(dialog.getByRole("button", { name: "Close" })).toBeFocused();
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press(i % 3 === 2 ? "Shift+Tab" : "Tab");
      const inside = await page.evaluate(() =>
        document.querySelector("[data-drawer]")?.contains(document.activeElement),
      );
      expect(inside).toBe(true);
    }
    // Sheet shortcuts are suspended while the modal is open.
    await page.keyboard.press("b");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "paper");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();
  });
});

test.describe("motion", () => {
  test("reduced motion shows static fallbacks", async ({ browser }) => {
    const context = await browser.newContext({
      reducedMotion: "reduce",
      viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();
    await ready(page);
    await expect(page.locator("[data-trace] canvas")).toHaveCount(0);
    await expect(page.locator("[data-trace] .trace-static")).toBeVisible();
    const state = await page.evaluate(() => ({
      body: getComputedStyle(document.querySelector("#sheet-04 .sheet-body") as Element).opacity,
      border: getComputedStyle(document.querySelector("#sheet-04 .sheet-border rect") as Element)
        .strokeDashoffset,
      redline: getComputedStyle(document.querySelector("#sheet-01 .redline .draw") as Element)
        .strokeDashoffset,
      count: document.querySelector("#sheet-01 [data-final]")?.textContent,
      final: document.querySelector("#sheet-01 [data-final]")?.getAttribute("data-final"),
    }));
    expect(state.body).toBe("1");
    expect(state.border).toBe("0px");
    expect(state.redline).toBe("0px");
    expect(state.count).toBe(state.final);
    await context.close();
  });

  test("hero canvas runs, stays inside the frame budget and pauses off screen", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await ready(page);
    const canvas = page.locator("[data-trace] canvas");
    await expect(canvas).toHaveCount(1);
    await expect(page.locator("[data-trace]")).toHaveAttribute("data-live", "1");
    await expect(canvas).toHaveAttribute("data-frame-ms", /\d/, { timeout: 5000 });
    const ms = Number(await canvas.getAttribute("data-frame-ms"));
    test.info().annotations.push({ type: "hero frame ms", description: String(ms) });
    console.log(`hero canvas mean frame: ${ms} ms`);
    expect(ms).toBeLessThan(4);
    await page.locator("#sheet-04").scrollIntoViewIfNeeded();
    await expect(canvas).toHaveAttribute("data-running", "false");
  });
});

test.describe("meta", () => {
  test("head carries title, canonical, OG and JSON-LD", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(
      "Anisur Rahman (Shakil): Fullstack AI Engineer, Voice Agents and Agentic Systems",
    );
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      "https://arshakil.com",
    );
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      "content",
      /opengraph-image/,
    );
    const ld = JSON.parse(
      (await page.locator('script[type="application/ld+json"]').textContent()) ?? "{}",
    );
    expect(ld["@type"]).toBe("Person");
    expect(ld.sameAs).toContain("https://github.com/AnisurRahmann");
  });

  test("OG image, sitemap and robots are served", async ({ request }) => {
    const og = await request.get("/opengraph-image");
    expect(og.status()).toBe(200);
    expect(og.headers()["content-type"]).toContain("image/png");
    expect((await request.get("/sitemap.xml")).status()).toBe(200);
    expect(await (await request.get("/robots.txt")).text()).toContain(
      "Sitemap: https://arshakil.com/sitemap.xml",
    );
  });
});

test.describe("budget", () => {
  test("first-load JS for the home route is under 150 kB gzipped", async ({ page, request }) => {
    await ready(page);
    const srcs = await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLScriptElement>("script[src]"))
        .filter((s) => !s.noModule)
        .map((s) => s.src),
    );
    let bytes = 0;
    for (const src of new Set(srcs)) {
      bytes += gzipSync(await (await request.get(src)).body()).length;
    }
    console.log(
      `first-load JS: ${(bytes / 1000).toFixed(1)} kB gzipped across ${new Set(srcs).size} scripts`,
    );
    expect(bytes).toBeLessThan(150_000);
  });
});
