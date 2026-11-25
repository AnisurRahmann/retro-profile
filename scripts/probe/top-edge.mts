import { chromium } from "@playwright/test";
const url = process.argv[2] ?? "http://localhost:3100/";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 400 }, deviceScaleFactor: Number(process.argv[3] ?? 1) });
await p.goto(url, { waitUntil: "networkidle" });
await p.waitForTimeout(800);
const shot = (await p.screenshot()).toString("base64");
const rows = await p.evaluate(async (b64) => {
  const img = new Image();
  img.src = "data:image/png;base64," + b64;
  await img.decode();
  const c = document.createElement("canvas");
  c.width = img.width; c.height = img.height;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  const out: string[] = [];
  for (const y of [0, 1, 2, 3, 10]) {
    const seen = new Set<string>();
    for (const x of [5, 300, 720, 1100, 1435]) {
      const d = ctx.getImageData(x, y, 1, 1).data;
      seen.add(`${d[0]},${d[1]},${d[2]}`);
    }
    out.push(`y=${y}: ${[...seen].join(" | ")}`);
  }
  return out;
}, shot);
console.log(url); console.log(rows.join("\n"));
const els = await p.evaluate(() => [...document.querySelectorAll("body *")].filter(e => { const r = e.getBoundingClientRect(); return r.top <= 1 && r.height <= 4 && r.width > 200; }).map(e => e.tagName + "." + e.className));
console.log("thin top elements:", els);
await b.close();
