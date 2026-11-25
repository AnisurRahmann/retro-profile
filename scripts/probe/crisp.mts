/**
 * 400% nearest-neighbour crops of the same gutter patch at backing scales 1.0 / 1.5 / 2.0 (DPR 2).
 * HOT=1 parks the cursor on the patch so the dots are at their brightest and largest.
 * Needs `pnpm dev` on :3000 (the ?sfscale= override is dev/test only).
 */
import fs from "node:fs";
import { chromium } from "@playwright/test";

const hot = process.env.HOT === "1";
const b = await chromium.launch();
const crops: string[] = [];
for (const sc of ["1", "1.5", "2"]) {
  const p = await b.newPage({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    reducedMotion: hot ? "no-preference" : "reduce",
  });
  await p.goto(`http://localhost:3000/lifts?sfscale=${sc}`, { waitUntil: "networkidle" });
  await p.waitForTimeout(2500);
  if (hot) {
    await p.mouse.move(99, 308, { steps: 5 });
    await p.waitForTimeout(700);
  }
  crops.push((await p.screenshot({ clip: { x: 44, y: 286, width: 110, height: 44 } })).toString("base64"));
  await p.close();
}
const p = await b.newPage();
const out = await p.evaluate(async (list) => {
  const imgs = await Promise.all(
    list.map(async (b64) => {
      const i = new Image();
      i.src = "data:image/png;base64," + b64;
      await i.decode();
      return i;
    }),
  );
  const w = imgs[0]!.width * 4;
  const h = imgs[0]!.height * 4;
  const pad = 28;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = (h + pad) * imgs.length;
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#111";
  ctx.fillRect(0, 0, c.width, c.height);
  imgs.forEach((im, k) => {
    ctx.fillStyle = "#ccc";
    ctx.font = "16px monospace";
    ctx.fillText(["scale 1.0", "scale 1.5", "scale 2.0"][k]!, 8, k * (h + pad) + 19);
    ctx.drawImage(im, 0, k * (h + pad) + pad, w, h);
  });
  return c.toDataURL("image/png").split(",")[1]!;
}, crops);
const file = `.shots/signal-field/scale-compare-400pct${hot ? "-cursor" : ""}.png`;
fs.mkdirSync(".shots/signal-field", { recursive: true });
fs.writeFileSync(file, Buffer.from(out, "base64"));
console.log(file);
await b.close();
