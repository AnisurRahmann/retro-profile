/** Contact sheet: npx tsx scripts/probe/sheet.mts out.png cols width file1.png file2.png … */
import fs from "node:fs";
import { chromium } from "@playwright/test";
const [out, cols, width, ...files] = process.argv.slice(2);
const c = Number(cols);
const w = Number(width);
const imgs = files.map((f) => `<figure><img src="data:image/png;base64,${fs.readFileSync(f).toString("base64")}"><figcaption>${f.split("/").pop()}</figcaption></figure>`).join("");
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: c * w + (c + 1) * 6, height: 400 } });
await p.setContent(`<style>body{margin:0;background:#222;display:grid;grid-template-columns:repeat(${c},${w}px);gap:6px;padding:6px;font:11px monospace;color:#ccc}figure{margin:0}img{width:${w}px;display:block}</style>${imgs}`);
await p.waitForTimeout(300);
await p.screenshot({ path: out!, fullPage: true });
await b.close();
