/**
 * Is the column scrim's edge visible as a line? Screenshots the page at 1440×900 (content hidden, so only the
 * sky and the scrim are measured), reads rows below the stage, and reports the sharpest luminance kink (the
 * second difference of a 9px-smoothed row) inside the scrim's 220px side bands vs the sky outside them.
 * A line shows up as a kink well above the sky's own texture. Usage (server on PORT, default 3000):
 *   npx tsx scripts/probe/scrim-edge.mts "sky=2026-12-15T11:00&wx=partly,sky=2026-12-15T16:45&wx=clear"
 */
import { chromium } from "@playwright/test";

const port = process.env.PORT ?? 3000;
const b = await chromium.launch({
  args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"],
});
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
for (const q of (
  process.argv[2] ?? "sky=2026-12-15T11:00&wx=partly,sky=2026-12-15T16:45&wx=clear"
).split(",")) {
  await p.goto(`http://localhost:${port}/?${q}`, { waitUntil: "load" });
  await p.addStyleTag({
    content:
      "main, footer, header { visibility: hidden !important } .sky-landscape { display: none !important }",
  });
  await p.waitForTimeout(6000);
  for (const scrim of [true, false]) {
    if (!scrim) await p.addStyleTag({ content: ".sky-scrim { display: none !important }" });
    await p.waitForTimeout(300);
    const png = (await p.screenshot()).toString("base64");
    // A string, so tsx's helpers don't leak into the page.
    const out = (await p.evaluate(`(async (src) => {
    const img = new Image();
    img.src = \`data:image/png;base64,\${src}\`;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    const g = c.getContext("2d");
    g.drawImage(img, 0, 0);
    const lin = (v) => (v <= 10.3 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4);
    const res = {};
    const stage = document.querySelector("[data-sky-stage]").getBoundingClientRect().bottom;
    const rows = [stage + 120, stage + 200, stage + 280].filter((y) => y < img.height - 2);
    let edge = 0;
    let open = 0;
    for (const y of rows) {
      const d = g.getImageData(0, Math.round(y), img.width, 1).data;
      const L = [];
      for (let x = 0; x < img.width; x++) L.push(Math.cbrt(0.2126 * lin(d[4 * x]) + 0.7152 * lin(d[4 * x + 1]) + 0.0722 * lin(d[4 * x + 2])));
      const sm = L.map((_, x) => {
        let s = 0;
        let n = 0;
        for (let k = -4; k <= 4; k++) if (L[x + k] !== undefined) (s += L[x + k]), n++;
        return s / n;
      });
      for (let x = 12; x < img.width - 12; x++) {
        const k = Math.abs(sm[x - 6] - 2 * sm[x] + sm[x + 6]);
        const inBand = (x > 116 && x < 336) || (x > 1104 && x < 1324);
        if (inBand) edge = Math.max(edge, k);
        else if (x > 1340) open = Math.max(open, k);
      }
    }
    res.edgeKink = edge;
    res.skyKink = open;
    return res;
})(${JSON.stringify(png)})`)) as Record<string, number>;
    console.log(
      q,
      scrim ? "with scrim   " : "without scrim",
      `side bands ${(out.edgeKink * 1000).toFixed(2)} ‰L, open sky ${(out.skyKink * 1000).toFixed(2)} ‰L`,
    );
  }
}
await b.close();
