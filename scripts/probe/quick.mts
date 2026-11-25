import { chromium } from "@playwright/test";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
for (const q of (process.argv[2] ?? "2026-12-15T16:55").split(",")) {
  await p.goto(`http://localhost:${process.env.PORT ?? 3000}/?sky=${q}&wx=clear`, { waitUntil: "load" });
  await p.waitForTimeout(4500);
  await p.screenshot({ path: `.shots/sky/quick-${q.replace(/:/g, "")}.png` });
}
await b.close();
