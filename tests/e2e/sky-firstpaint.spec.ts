/**
 * First paint on a cold load (v5.1 T8): the server-rendered fallback.
 *
 * 1. Without JavaScript, at 375×812 and 1440×900: the hero shows the gradient, the stars (the no-script sky is the
 *    initial night one), the hills and the bridge silhouettes.
 * 2. With JavaScript, every script chunk held back: what the first paint shows, against what the live canvas draws
 *    once it has taken over. The landscape must be in the same place, in the same colours.
 *
 * Screenshots are decoded in a separate page: a page without JavaScript cannot read them.
 */
import { expect, test, type Page } from "@playwright/test";

const SIZES = [
  { width: 375, height: 812, dpr: 2 },
  { width: 1440, height: 900, dpr: 1 },
];
/** Mid-morning, clear: no stars and the sun high, so below the text only the landscape makes edges. */
const DAY = "sky=2026-12-15T11:00&wx=clear";

type Rect = [x: number, y: number, w: number, h: number];
type Scan = { x0: number; x1: number; step: number; top: number; bottom: number };
type Job =
  | { kind: "means"; rects: Rect[] }
  | { kind: "bright"; rect: Rect; min: number }
  | { kind: "skyline"; scan: Scan };

/** Decodes a screenshot in the page and measures it. */
function measure(page: Page, png: Buffer, job: Job, dpr: number): Promise<unknown> {
  return page.evaluate(
    async ({ b64, job, dpr }) => {
      const img = new Image();
      img.src = "data:image/png;base64," + b64;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      const g = c.getContext("2d")!;
      g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height).data;
      const px = (x: number, y: number): number[] => {
        const i = (y * c.width + x) * 4;
        return [d[i]!, d[i + 1]!, d[i + 2]!];
      };
      // A rect in CSS px, as device px.
      const edges = (r: Rect): [number, number, number, number] => [
        Math.round(r[0] * dpr),
        Math.round(r[1] * dpr),
        Math.round((r[0] + r[2]) * dpr),
        Math.round((r[1] + r[3]) * dpr),
      ];
      if (job.kind === "means") {
        return job.rects.map((r) => {
          const [x0, y0, x1, y1] = edges(r);
          const sum = [0, 0, 0];
          for (let y = y0; y < y1; y++)
            for (let x = x0; x < x1; x++) {
              const p = px(x, y);
              sum[0]! += p[0]!;
              sum[1]! += p[1]!;
              sum[2]! += p[2]!;
            }
          const n = (x1 - x0) * (y1 - y0);
          return sum.map((v) => Math.round(v / n));
        });
      }
      if (job.kind === "bright") {
        const [x0, y0, x1, y1] = edges(job.rect);
        let n = 0;
        for (let y = y0; y < y1; y++)
          for (let x = x0; x < x1; x++) {
            const p = px(x, y);
            if (p[0]! >= job.min && p[1]! >= job.min && p[2]! >= job.min) n++;
          }
        return n;
      }
      // The skyline: per sampled column (CSS px), the first row from `top` down where the colour has stepped away from
      // the row 4px above it and stays stepped for 7px (a landscape edge, not a bird, a dot or a truss member). Else null.
      const { x0, x1, step, top, bottom } = job.scan;
      const back = Math.round(4 * dpr);
      const hold = Math.round(7 * dpr);
      const stepped = (a: number[], b: number[]) =>
        Math.abs(a[0]! - b[0]!) + Math.abs(a[1]! - b[1]!) + Math.abs(a[2]! - b[2]!) > 40;
      const out: (number | null)[] = [];
      for (let x = x0; x <= x1; x += step) {
        const X = Math.round(x * dpr);
        let found: number | null = null;
        for (let y = top; y < bottom && found === null; y++) {
          const Y = Math.round(y * dpr);
          const sky = px(X, Y - back);
          let edge = true;
          for (let k = 0; k < hold && edge; k++) edge = stepped(px(X, Y + k), sky);
          if (edge) found = y;
        }
        out.push(found);
      }
      return out;
    },
    { b64: png.toString("base64"), job, dpr },
  );
}
/** The mean colour of each rect (CSS px). */
const means = (page: Page, png: Buffer, rects: Rect[], dpr: number) =>
  measure(page, png, { kind: "means", rects }, dpr) as Promise<number[][]>;
/** How many pixels of the rect are at least `min` in every channel. */
const bright = (page: Page, png: Buffer, rect: Rect, min: number, dpr: number) =>
  measure(page, png, { kind: "bright", rect, min }, dpr) as Promise<number>;
/** The skyline's row (CSS px) at each sampled column, else null. */
const skyline = (page: Page, png: Buffer, scan: Scan, dpr: number) =>
  measure(page, png, { kind: "skyline", scan }, dpr) as Promise<(number | null)[]>;

test.describe("first paint on a cold load (v5.1 T8)", () => {
  for (const size of SIZES) {
    const phone = size.width < 640;
    // The top of the band, in CSS px: the phone's 200px stage scene ends 40px above the foot of a 772px stage, the
    // desktop band is 18vh tall. A band unit is 2px on the phone and 1.62px on the desktop.
    const top = phone ? 812 - 40 - 200 : 900 - 162;
    const u = (n: number) => Math.round(top + n * (phone ? 2 : 1.62));
    // Sky beside the text, where only stars can be bright.
    const starFields: Rect[] = phone
      ? [[8, 276, 359, 284]]
      : [
          [4, 306, 296, 234],
          [1140, 306, 296, 234],
        ];

    test(`without JavaScript at ${size.width}: the gradient, the stars, the hills and the bridge are in the first paint`, async ({
      browser,
    }) => {
      const ctx = await browser.newContext({
        viewport: { width: size.width, height: size.height },
        deviceScaleFactor: size.dpr,
        javaScriptEnabled: false,
      });
      const page = await ctx.newPage();
      await page.goto("/");
      await page.waitForTimeout(600);
      const png = await page.screenshot();
      const html = await page.content();
      await ctx.close();
      // The markup is the page's own: no script put it there.
      expect(html).toMatch(/data-sky-fallback="stars"/);
      expect(html).toMatch(phone ? /data-sky-fallback="stage"/ : /data-sky-fallback="band"/);

      const dec = await browser.newPage();
      // The sky is the initial one, which the first-paint script would replace: night.
      const [[sky]] = [await means(dec, png, [[4, 4, 8, 8]], size.dpr)];
      expect(Math.max(...sky!.map((v, k) => Math.abs(v - [6, 11, 22][k]!))), "night zenith").toBeLessThanOrEqual(3);
      // A strip of hill under its top edge, the sky above it; the deck of Keane Bridge, the river under it.
      const [hill, above, deck, river] = await means(
        dec,
        png,
        phone
          ? [
              [250, u(35), 110, u(45) - u(35)],
              [250, u(10), 110, 10],
              [40, u(64.2), 295, 3],
              [40, u(76), 295, 10],
            ]
          : [
              [40, u(50), 280, 8],
              [40, u(4), 280, 6],
              [1116, u(64.2), 124, 3],
              [40, u(78), 280, 8],
            ],
        size.dpr,
      );
      const sum = (c: number[]) => c[0]! + c[1]! + c[2]!;
      expect(sum(hill!), "the hills are darker than the sky above them").toBeLessThan(sum(above!) * 0.8);
      expect(sum(deck!), "the deck of Keane Bridge is darker than the river under it").toBeLessThan(sum(river!) * 0.6);
      const stars = (
        await Promise.all(starFields.map((r) => bright(dec, png, r, 40, size.dpr)))
      ).reduce((a, b) => a + b, 0);
      console.info(`[t8 ${size.width}] no JavaScript: sky ${sky}, hill ${hill}, deck ${deck}, river ${river}, ${stars} star pixels`);
      expect(stars, "the stars are in the first paint").toBeGreaterThanOrEqual(3);
      await dec.close();
    });

    test(`at ${size.width}: the live canvas replaces the fallback without moving the landscape`, async ({ browser }) => {
      test.setTimeout(60_000);
      const ctx = await browser.newContext({
        viewport: { width: size.width, height: size.height },
        deviceScaleFactor: size.dpr,
      });
      const page = await ctx.newPage();
      // Hold every script chunk back for 2.5 s, so the page stays at its first paint.
      await page.route(/\/_next\/static\/chunks\/.*\.js/, async (route) => {
        await new Promise((done) => setTimeout(done, 2500));
        await route.continue();
      });
      await page.goto(`/?${DAY}`, { waitUntil: "commit" });
      const fallback = page.locator(`[data-sky-fallback="${phone ? "stage" : "band"}"]`);
      await fallback.waitFor({ state: "attached" });
      await expect(fallback).toHaveCSS("position", phone ? "absolute" : "fixed");
      await page.waitForTimeout(100);
      // The inline first-paint script has run (mid-morning), and the stylesheet is in: the fallback fills the band.
      expect(await page.locator("html").getAttribute("data-sky")).toBe("day");
      expect(await fallback.boundingBox()).toMatchObject({
        x: expect.closeTo(0, 0.5),
        y: expect.closeTo(top, 0.5),
        width: expect.closeTo(size.width, 0.5),
        height: expect.closeTo(phone ? 248 : 162, 0.5),
      });
      const first = await page.screenshot();
      // Nor does the page under the hero: the first section keeps its place while the fallbacks are there.
      const shippedTop = () => page.evaluate(() => document.querySelector("#shipped")?.getBoundingClientRect().top);
      const shippedFirst = await shippedTop();
      // Then the scripts come: the renderer's canvases are drawn, the fallback fades out and is removed.
      await page.waitForFunction(() => document.documentElement.dataset.skyFallbackDone === "done", null, {
        timeout: 20_000,
      });
      await page.waitForFunction(
        (phone) => {
          const c = document.querySelector(phone ? "[data-sky-scene=stage] canvas" : "[data-sky-landscape]");
          return !!c && "ready" in (c as HTMLElement).dataset;
        },
        phone,
        { timeout: 20_000 },
      );
      await page.waitForTimeout(2500);
      expect(await page.locator("[data-sky-fallback]").count()).toBe(0);
      expect(await shippedTop()).toBe(shippedFirst);
      const live = await page.screenshot();
      await ctx.close();

      const dec = await browser.newPage();
      // The sky above the landscape and a strip of hill: the same colours.
      const rects: Rect[] = phone
        ? [
            [250, u(10), 110, 10],
            [250, u(35), 110, u(45) - u(35)],
          ]
        : [
            [40, u(4), 280, 6],
            [40, u(50), 280, 8],
          ];
      const [skyA, hillA] = await means(dec, first, rects, size.dpr);
      const [skyB, hillB] = await means(dec, live, rects, size.dpr);
      console.info(`[t8 ${size.width}] first: sky ${skyA}, hill ${hillA}; live: sky ${skyB}, hill ${hillB}`);
      expect(Math.max(...skyA!.map((v, k) => Math.abs(v - skyB![k]!))), "the sky does not change").toBeLessThanOrEqual(4);
      expect(Math.max(...hillA!.map((v, k) => Math.abs(v - hillB![k]!))), "the hills keep their colour").toBeLessThanOrEqual(10);
      // The skyline of each column, down to above the deck. On the desktop only the gutters: text can reflow into
      // the web font.
      const scans: Scan[] = phone
        ? [{ x0: 8, x1: 367, step: 4, top: u(-2), bottom: u(58) }]
        : [
            { x0: 8, x1: 328, step: 4, top: u(-2), bottom: u(60) },
            { x0: 1112, x1: 1432, step: 4, top: u(-2), bottom: u(62) },
          ];
      const a: (number | null)[] = [];
      const b: (number | null)[] = [];
      for (const scan of scans) {
        a.push(...(await skyline(dec, first, scan, size.dpr)));
        b.push(...(await skyline(dec, live, scan, size.dpr)));
      }
      await dec.close();
      const pairs = a
        .map((y, i) => [y, b[i]!] as const)
        .filter((p): p is [number, number] => p[0] !== null && p[1] !== null);
      const off = pairs.map(([x, y]) => Math.abs(x - y)).sort((p, q) => p - q);
      console.info(
        `[t8 ${size.width}] skyline in ${pairs.length} of ${a.length} columns; offset px: median ${off[off.length >> 1]}, 90th ${off[Math.floor(off.length * 0.9)]}, max ${off[off.length - 1]}`,
      );
      // Every column finds the skyline in both, and it is the same skyline: 9 of 10 within a pixel, never 2 off.
      expect(pairs.length).toBeGreaterThan(a.length * 0.85);
      expect(off[Math.floor(off.length * 0.9)]).toBeLessThanOrEqual(1);
      expect(off[off.length - 1]).toBeLessThanOrEqual(2);
    });
  }
});
