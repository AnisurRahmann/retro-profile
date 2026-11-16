// The Open Graph image: the anchor room (a00), cropped to 1200 x 630, with the name and role set in the display font.
// Usage: pnpm og   (writes public/og.png, which is committed. `pnpm build` never runs this.)
// Rendered in headless Chromium, because the display font only exists as WOFF2 and the browser sets it exactly as the site does.
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import { meta, profile } from "../src/content";

const WIDTH = 1200;
const HEIGHT = 630;
const data = (path: string, type: string) => `data:${type};base64,${readFileSync(path).toString("base64")}`;
const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;");

const html = `<!doctype html><meta charset="utf-8"><style>
@font-face { font-family: "Big Shoulders"; font-weight: 900; src: url(${data("src/assets/big-shoulders-display-900.woff2", "font/woff2")}) format("woff2"); }
* { margin: 0; box-sizing: border-box; }
body { width: ${WIDTH}px; height: ${HEIGHT}px; overflow: hidden; background: #F4F1EA; color: #17181A; font-family: "Big Shoulders"; font-weight: 900; text-transform: uppercase; }
/* the room keeps its full width: 1376 x 768 scales to 1200 x 670, the crop takes 40px off the floor */
img { position: absolute; left: 0; top: 0; width: ${WIDTH}px; }
h1 { position: absolute; left: 44px; top: 30px; font-size: 80px; line-height: 0.86; letter-spacing: -0.005em; }
p { position: absolute; left: 46px; top: 106px; font-size: 31px; line-height: 1; letter-spacing: 0.02em; }
</style><img src="${data("assets/illustrations/raw/a00-anchor-room.png", "image/png")}" alt=""><h1>${escape(profile.name)}</h1><p>${escape(meta.jobTitle)}</p>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });
await page.setContent(html);
await page.evaluate(() => document.fonts.ready);
if (!(await page.evaluate(() => document.fonts.check('900 80px "Big Shoulders"')))) throw new Error("og: the display font did not load");
await page.screenshot({ path: "public/og.png", clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT } });
await browser.close();
console.log(`public/og.png: ${WIDTH} x ${HEIGHT}`);
