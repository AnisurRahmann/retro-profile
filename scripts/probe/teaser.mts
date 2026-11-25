/** Watch the first-visit time-lapse and drag the sky against a running server (dev: PORT=3000). */
import { chromium } from "@playwright/test";
const port = process.env.PORT ?? 3000;
const b = await chromium.launch({ args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
p.on("pageerror", (e) => console.log("pageerror", e.message));
await p.goto(`http://localhost:${port}/?teaser`, { waitUntil: "load" });
for (const t of [2000, 3500, 6000, 9000, 12000, 15000]) {
  await p.waitForTimeout(t - (t > 2000 ? [2000, 3500, 6000, 9000, 12000][[3500, 6000, 9000, 12000, 15000].indexOf(t)]! : 0));
  console.log(t, await p.locator("[data-testid=sky-label]").innerText().catch(() => "?"), await p.locator("[data-testid=sky-hint]").getAttribute("data-show"));
  if (t === 6000) await p.screenshot({ path: ".shots/sky/teaser-mid.png" });
}
// Drag the sky.
await p.mouse.move(200, 200);
await p.mouse.down();
await p.mouse.move(400, 205, { steps: 5 });
await p.mouse.move(560, 205, { steps: 5 });
console.log("drag", await p.locator("[data-testid=sky-label]").innerText());
await p.mouse.up();
await p.waitForTimeout(2000);
console.log("after", await p.locator("[data-testid=sky-label]").innerText());
await b.close();
