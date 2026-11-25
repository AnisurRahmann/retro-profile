/** Print window.__sky for a state (test build, PORT 3101): W=375 H=812 npx tsx scripts/probe/state.mts "sky=…&wx=…" */
import { chromium } from "@playwright/test";
const b = await chromium.launch({ args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
const w = Number(process.env.W ?? 1440);
const p = await b.newPage({ viewport: { width: w, height: Number(process.env.H ?? 900) }, deviceScaleFactor: w < 640 ? 2 : 1 });
await p.goto(`http://localhost:${process.env.PORT ?? 3101}/?${process.argv[2]}`, { waitUntil: "networkidle" });
await p.waitForTimeout(5000);
const s = await p.evaluate(() => (window as unknown as { __sky?: Record<string, unknown> }).__sky);
console.log(JSON.stringify({ state: s?.state, condition: s?.condition, sun: s?.sun, moon: s?.moon, geom: s?.geom }));
await b.close();
