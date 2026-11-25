/** Label + popover look against a running server (default :3000). */
import { chromium } from "@playwright/test";
const port = process.env.PORT ?? 3000;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: Number(process.env.W ?? 1440), height: 900 } });
p.on("pageerror", (e) => console.log("pageerror", e.message));
p.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") console.log(m.type(), m.text().slice(0, 300)); });
await p.goto(`http://localhost:${port}/?${process.argv[2] ?? "sky=2026-12-15T16:55&wx=rain"}`, { waitUntil: "load" });
await p.waitForTimeout(2500);
await p.screenshot({ path: ".shots/sky/label-closed.png", clip: { x: 300, y: 80, width: 840, height: 260 } });
await p.getByTestId("sky-label").click();
await p.waitForTimeout(300);
await p.keyboard.press("PageUp");
await p.keyboard.press("PageUp");
await p.waitForTimeout(600);
await p.screenshot({ path: ".shots/sky/label-open.png" });
console.log(await p.getByTestId("sky-label").innerText());
await b.close();
