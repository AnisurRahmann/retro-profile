import { chromium } from "@playwright/test";
const b = await chromium.launch();
for (const sc of ["1", "1.5", "2"]) {
  const hot = process.env.HOT === "1";
  const p = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, reducedMotion: hot ? "no-preference" : "reduce" });
  await p.goto(`http://localhost:3000/lifts?sfscale=${sc}`, { waitUntil: "networkidle" });
  await p.waitForTimeout(2500);
  if (hot) { await p.mouse.move(132, 330, { steps: 5 }); await p.waitForTimeout(700); }
  const png = (await p.screenshot({ clip: { x: 22, y: 286, width: 220, height: 88 } })).toString("base64");
  const r = await p.evaluate(async (b64) => {
    const i = new Image(); i.src = "data:image/png;base64," + b64; await i.decode();
    const c = document.createElement("canvas"); c.width = i.width; c.height = i.height;
    const x = c.getContext("2d")!; x.drawImage(i, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data;
    const L: number[] = []; for (let k = 0; k < d.length; k += 4) L.push(d[k]! * 0.2126 + d[k + 1]! * 0.7152 + d[k + 2]! * 0.0722);
    const bg = [...L].sort((a, b) => a - b)[Math.floor(L.length * 0.5)]!;
    const peak = Math.max(...L) - bg;
    const half = L.filter((v) => v - bg > peak / 2).length;
    return { peak: peak.toFixed(1), halfMaxPxPerDot: (half / 40).toFixed(1) }; // 10 x 4 dots in the clip
  }, png);
  console.log(`scale ${sc}:`, JSON.stringify(r));
  await p.close();
}
await b.close();
