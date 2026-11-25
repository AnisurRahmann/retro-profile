/** Which elements stick out past the viewport (horizontal scroll)? PORT=3101 npx tsx scripts/probe/overflow.mts [/path] */
import { chromium } from "@playwright/test";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 375, height: 800 } });
await p.goto(`http://localhost:${process.env.PORT ?? 3101}${process.argv[2] ?? "/"}`);
await p.waitForTimeout(1500);
console.log(
  await p.evaluate(`(() => {
    const out = { scrollWidth: document.documentElement.scrollWidth, inner: innerWidth, bodySW: document.body.scrollWidth, wide: [] };
    for (const el of document.querySelectorAll("body *")) {
      const r = el.getBoundingClientRect();
      if (r.right > innerWidth + 1 && getComputedStyle(el).position !== "fixed") out.wide.push(el.tagName + "." + String(el.className).slice(0, 40) + " " + Math.round(r.right));
    }
    out.wide = out.wide.slice(0, 12);
    return out;
  })()`),
);
await b.close();
