/**
 * Weather v6 evidence (docs/PROGRESS.md "Weather v6"), against a dev server with the weather mocked:
 *   WEATHER_MOCK=1 CHAT_MOCK=1 NEXT_DIST_DIR=.scratch/next-dev pnpm dev -p 3105
 * Usage (BASE= to point elsewhere):
 *   npx tsx scripts/weather-v6-shots.ts w1 … w6   a task's Evidence list → .shots/v6/<task>/
 *   npx tsx scripts/weather-v6-shots.ts matrix    W7: every condition × 4 times × 2 sizes → .shots/v6/matrix/ and contact sheets
 *   npx tsx scripts/weather-v6-shots.ts --gpu      GPU ms/frame per condition at the two gate sizes, steady state → .shots/v6/gpu.json
 * Each run also writes what the page reported (window.__sky) next to the shots, in manifest.json.
 */
import fs from "node:fs";
import { chromium, type Browser, type Page } from "@playwright/test";

const BASE = process.env.BASE ?? "http://localhost:3105";
const ROOT = ".shots/v6";
const args = process.argv.slice(2);
const only = args.filter((a) => !a.startsWith("--"));
const GPU = args.includes("--gpu");

type Size = "desk" | "phone";
const SIZES: Record<Size, { width: number; height: number; dpr: number }> = {
  desk: { width: 1440, height: 900, dpr: 1 },
  phone: { width: 375, height: 812, dpr: 2 },
};
/** The performance gates' sizes (DECISIONS): 1920×1080 at DPR 2, 375×812 at DPR 3. */
const GATE: Record<Size, { width: number; height: number; dpr: number }> = {
  desk: { width: 1920, height: 1080, dpr: 2 },
  phone: { width: 375, height: 812, dpr: 3 },
};

type Shot = {
  /** File name without .png. */
  name: string;
  /** The query string after "/?". */
  q: string;
  size: Size;
  /** Where to scroll to before the shot (default: the top). */
  scroll?: "shipped" | "closer" | number;
  /** ms to wait after the sky's first frame (default 5,000: the weather eases in over 4 s). */
  wait?: number;
  /** Frames this many seconds apart. */
  frames?: number;
  gap?: number;
  /** Force a lightning strike and shoot `at` ms later. */
  strike?: "cg" | "ic";
  at?: number;
  reduced?: boolean;
  /** A crop to take instead of the viewport (CSS px), and how much to enlarge it. */
  crop?: [number, number, number, number];
  zoom?: number;
  /** Dump window.__sky.lightningLog next to the shot. */
  log?: boolean;
  /** With `frames`: measure how far the cloud moved between the first and the last frame (W2's calibration). */
  drift?: { band: [number, number]; axis: "x" | "y"; max: number };
};

const D = "2026-11-26";
const q = (time: string, wx: string, rest = "") => `sky=${D}T${time}&wx=${wx}${rest ? `&${rest}` : ""}`;
const both = (name: string, query: string, extra: Partial<Shot> = {}): Shot[] =>
  (["desk", "phone"] as Size[]).map((size) => ({ name: `${name}-${size === "desk" ? "1440x900" : "375x812"}`, q: query, size, ...extra }));

/** Each task's Evidence list. */
const TASKS: Record<string, Shot[]> = {
  w1: [
    ...both("partly-1100", q("11:00", "partly", "wind=15&from=270")),
    ...both("overcast-1300", q("13:00", "overcast")),
    ...both("golden-1645-partly", q("16:45", "partly")),
    ...both("night-0200-partly", q("02:00", "partly")),
  ],
  w5: [
    // Between strikes: the dev-only `lightning=off` keeps the scheduler quiet.
    ...both("thunder-1500", q("15:00", "thunder", "wind=45&from=315&lightning=off")),
    ...both("thunder-1830", q("18:30", "thunder", "wind=45&from=315&lightning=off")),
    // A storm's rain is wind-driven even under a light forecast wind.
    { name: "thunder-1500-calm-1440x900", q: q("15:00", "thunder", "wind=5&from=270&lightning=off"), size: "desk" },
  ],
  w4: [
    // A forced bolt at its return stroke (the leader takes 70–110 ms): the storm's clouds are in after 5 s.
    ...both("bolt-2100", q("21:00", "thunder", "wind=45&from=315"), { strike: "cg", at: 120, log: true }),
    ...both("sheet-flash-2100", q("21:00", "thunder", "wind=45&from=315"), { strike: "ic", at: 100, log: true }),
    ...both("bolt-1530", q("15:30", "thunder", "wind=45&from=315"), { strike: "cg", at: 120, log: true }),
    // Natural scheduling for a minute: the count and the log.
    { name: "thunder-60s-1440x900", q: q("21:00", "thunder", "wind=45&from=315"), size: "desk", wait: 60_000, log: true },
    // Reduced motion: no lightning at all, the hook included.
    { name: "thunder-reduced-1440x900", q: q("21:00", "thunder", "wind=45&from=315"), size: "desk", strike: "cg", at: 120, reduced: true, log: true },
  ],
  w3: [
    ...both("drizzle-1500", q("15:00", "drizzle", "wind=10&from=90")),
    ...both("rain-1500", q("15:00", "rain", "wind=20&from=200")),
    ...both("heavy-rain-1500", q("15:00", "heavy-rain", "wind=30&from=200")),
    // Night: the lamps are on and the rain shows in their light.
    ...both("rain-2130", q("21:30", "rain", "wind=15&from=200")),
    // Noon under a storm is as dark as a clear sunset: the lights are on in the afternoon.
    both("heavy-rain-1300-lights", q("13:00", "heavy-rain", "wind=30&from=200"), { scroll: "shipped" })[0]!,
    // The splash marks on the water: the river beside the cards in the fixed band at 1440×900 (about y 805–850).
    {
      name: "heavy-rain-splash-1440x900",
      q: q("15:00", "heavy-rain", "wind=30&from=200"),
      size: "desk",
      crop: [1100, 770, 340, 110],
      zoom: 4,
    },
    { name: "rain-splash-1440x900", q: q("15:00", "rain", "wind=20&from=200"), size: "desk", crop: [1100, 770, 340, 110], zoom: 4 },
    { name: "lamp-rain-2130-1440x900", q: q("21:30", "rain", "wind=15&from=200"), size: "desk", crop: [0, 770, 340, 110], zoom: 3 },
  ],
  w2: [
    ...both("wind15-from270", q("11:00", "partly", "wind=15&from=270"), { frames: 3, gap: 5, wait: 3000 }),
    ...both("wind40-from0", q("11:00", "partly", "wind=40&from=0"), { frames: 3, gap: 5, wait: 3000 }),
    ...both("wind40-from180", q("11:00", "partly", "wind=40&from=180"), { frames: 3, gap: 5, wait: 3000 }),
    // Calibration: a LOW feature in the upper third of 1440×900 at 15 km/h moves 60–120 px in 10 s. The band is
    // clear of the page (desktop: below the header; phone: between the status chip and "Shipped"), so only sky is correlated.
    {
      name: "cal-wind15-1440x900",
      q: q("11:00", "partly", "wind=15&from=270"),
      size: "desk",
      frames: 2,
      gap: 10,
      wait: 3000,
      drift: { band: [60, 300], axis: "x", max: 240 },
    },
    {
      name: "cal-wind15-375x812",
      q: q("11:00", "partly", "wind=15&from=270"),
      size: "phone",
      frames: 2,
      gap: 10,
      wait: 3000,
      drift: { band: [268, 338], axis: "x", max: 60 },
    },
  ],
};

/** What the renderer reports in dev and test builds (window.__sky). */
type Sky = {
  frames?: number;
  condition?: string;
  sun?: unknown;
  moon?: unknown;
  strike?: (k: "cg" | "ic") => void;
  lightningLog?: unknown[];
  lightningCount?: { cg: number; ic: number };
};
type W = Window & { __sky?: Sky };

const scroll = (page: Page, to: Shot["scroll"]) =>
  page.evaluate((to) => {
    if (to === undefined || to === 0) window.scrollTo(0, 0);
    else if (typeof to === "number") window.scrollTo(0, to);
    else {
      const el = document.getElementById(to)!;
      window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 0.4 * window.innerHeight);
    }
  }, to);

/** Enlarge a crop (a zoomed detail shot) through an HTML page: crops of tiny marks are unreadable at 1×. */
async function zoom(browser: Browser, file: string, box: [number, number, number, number], by: number) {
  const page = await browser.newPage({ viewport: { width: Math.round(box[2] * by) + 12, height: Math.round(box[3] * by) + 12 } });
  const png = fs.readFileSync(file);
  await page.setContent(
    `<style>body{margin:0;background:#222;padding:6px}img{width:${box[2] * by}px;image-rendering:pixelated;display:block}</style><img src="data:image/png;base64,${png.toString("base64")}">`,
  );
  await page.screenshot({ path: file, clip: { x: 6, y: 6, width: Math.round(box[2] * by), height: Math.round(box[3] * by) } });
  await page.close();
}

async function take(browser: Browser, out: string, s: Shot) {
  const v = SIZES[s.size];
  const ctx = await browser.newContext({
    viewport: { width: v.width, height: v.height },
    deviceScaleFactor: v.dpr,
    isMobile: s.size === "phone",
    hasTouch: s.size === "phone",
    ...(s.reduced ? { reducedMotion: "reduce" as const } : {}),
  });
  const page = await ctx.newPage();
  const problems: string[] = [];
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") problems.push(`${m.type()}: ${m.text()}`);
  });
  await page.goto(`${BASE}/?${s.q}`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => ((window as W).__sky?.frames ?? 0) > 0, null, { timeout: 20_000 });
  await page.waitForTimeout(s.wait ?? 5000);
  await scroll(page, s.scroll);
  await page.waitForTimeout(700);
  const files: string[] = [];
  const snap = async (name: string) => {
    const file = `${out}/${name}.png`;
    await page.screenshot(s.crop ? { path: file, clip: { x: s.crop[0], y: s.crop[1], width: s.crop[2], height: s.crop[3] } } : { path: file });
    if (s.crop && s.zoom) await zoom(browser, file, s.crop, s.zoom);
    files.push(file);
    console.log(file);
  };
  if (s.strike) {
    await page.evaluate((k) => (window as W).__sky?.strike?.(k), s.strike);
    await page.waitForTimeout(s.at ?? 120);
  }
  if (s.frames) for (let i = 0; i < s.frames; i++) {
    if (i) await page.waitForTimeout((s.gap ?? 5) * 1000);
    await snap(`${s.name}-${i}`);
  } else await snap(s.name);
  const sky = await page.evaluate((): Sky | null => (window as W).__sky ?? null);
  if (s.log && Array.isArray(sky?.lightningLog))
    console.log(`  ${s.name}: lightning ${JSON.stringify(sky.lightningCount ?? null)} log ${JSON.stringify(sky.lightningLog)}`);
  let moved: number | null = null;
  if (s.drift && files.length > 1) {
    const d = await drift(browser, files[0]!, files.at(-1)!, s.drift, v.dpr);
    moved = Math.round(d.px * 100) / 100;
    console.log(`  ${s.name}: cloud moved ${moved} px in ${(s.gap ?? 5) * (files.length - 1)} s along ${s.drift.axis} (correlation ${d.r.toFixed(3)})`);
  }
  if (problems.length) console.log(`  ! ${s.name}: ${problems.slice(0, 6).join(" | ")}`);
  await ctx.close();
  return { shot: s, files, problems, sun: sky?.sun ?? null, moon: sky?.moon ?? null, condition: sky?.condition ?? null, moved };
}

/**
 * How far the cloud moved between two shots, in CSS px: the shift along an axis that best correlates a band of the
 * first frame with the last (brute force, the band downsampled 2×). Positive is leftward (x) or upward (y).
 */
async function drift(browser: Browser, first: string, last: string, d: { band: [number, number]; axis: "x" | "y"; max: number }, scale: number) {
  const page = await browser.newPage();
  const band = async (file: string) => {
    await page.setContent(`<img id="i" src="data:image/png;base64,${fs.readFileSync(file).toString("base64")}">`);
    // No inner helpers: tsx's transform gives them a name the page doesn't have.
    return page.evaluate(
      async ({ y0, y1, axis }) => {
        const img = document.getElementById("i") as HTMLImageElement;
        await img.decode();
        const c = document.createElement("canvas");
        c.width = Math.round(img.naturalWidth / 4);
        c.height = Math.round(img.naturalHeight / 4);
        const g = c.getContext("2d", { willReadFrequently: true })!;
        g.drawImage(img, 0, 0, c.width, c.height);
        const d = g.getImageData(0, 0, c.width, c.height).data;
        const rows: number[][] = [];
        if (axis === "x")
          for (let y = y0; y < y1; y++) {
            const row: number[] = [];
            for (let x = 0; x < c.width; x++) {
              const i = (y * c.width + x) * 4;
              row.push(0.2126 * d[i]! + 0.7152 * d[i + 1]! + 0.0722 * d[i + 2]!);
            }
            rows.push(row);
          }
        else
          for (let x = y0; x < y1; x++) {
            const row: number[] = [];
            for (let y = 0; y < c.height; y++) {
              const i = (y * c.width + x) * 4;
              row.push(0.2126 * d[i]! + 0.7152 * d[i + 1]! + 0.0722 * d[i + 2]!);
            }
            rows.push(row);
          }
        return rows;
      },
      { y0: Math.round(d.band[0] / scale / 4), y1: Math.round(d.band[1] / scale / 4), axis: d.axis },
    );
  };
  const a = await band(first);
  const b = await band(last);
  await page.close();
  let best = { s: 0, r: -Infinity };
  const max = Math.round(d.max / scale / 4);
  for (let s = 0; s <= max; s++) {
    let dot = 0;
    let aa = 0;
    let bb = 0;
    for (let r = 0; r < a.length; r++) {
      const ra = a[r]!;
      const rb = b[r]!;
      const n = ra.length - s;
      let ma = 0;
      let mb = 0;
      for (let i = 0; i < n; i++) {
        ma += ra[i]!;
        mb += rb[i + s]!;
      }
      ma /= n;
      mb /= n;
      for (let i = 0; i < n; i++) {
        const va = ra[i]! - ma;
        const vb = rb[i + s]! - mb;
        dot += va * vb;
        aa += va * va;
        bb += vb * vb;
      }
    }
    const r = dot / Math.sqrt(aa * bb);
    if (r > best.r) best = { s, r };
  }
  // One sample of the band is 4 device px: 4 / scale CSS px.
  return { px: best.s * (4 / scale), r: best.r };
}

/** One sheet from shots: an HTML grid, screenshotted. */
async function sheet(browser: Browser, out: string, title: string, files: string[], cols: number, width: number) {
  const page = await browser.newPage({ viewport: { width: cols * width + (cols + 1) * 6, height: 400 } });
  const imgs = files
    .map((f) => `<figure><img src="data:image/png;base64,${fs.readFileSync(f).toString("base64")}"><figcaption>${f.split("/").pop()}</figcaption></figure>`)
    .join("");
  await page.setContent(
    `<style>body{margin:0;background:#222;display:grid;grid-template-columns:repeat(${cols},${width}px);gap:6px;padding:6px;font:11px monospace;color:#ccc}figure{margin:0}img{width:${width}px;display:block}</style><h1 style="grid-column:1/-1;margin:0;font-size:13px">${title}</h1>${imgs}`,
  );
  await page.waitForTimeout(300);
  const file = `${out}/sheet-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`;
  await page.screenshot({ path: file, fullPage: true });
  await page.close();
  console.log(file);
  return file;
}

const browser = await chromium.launch({ args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
if (GPU) {
  // The gate: the atmosphere pass on the real GPU, from the renderer's own timer log, per condition and size.
  const rows: { condition: string; size: string; ms: number[] }[] = [];
  for (const size of ["desk", "phone"] as Size[])
    for (const [time, wx, rest] of [
      ["11:00", "clear", ""],
      ["11:00", "partly", "wind=15&from=270"],
      ["13:00", "overcast", ""],
      ["07:00", "fog", ""],
      ["15:00", "drizzle", ""],
      ["15:00", "rain", "wind=20&from=200"],
      ["15:00", "heavy-rain", "wind=30&from=200"],
      ["15:00", "thunder", "wind=45&from=315"],
      ["18:30", "thunder", "wind=45&from=315"],
    ] as const) {
      const g = GATE[size];
      const ctx = await browser.newContext({ viewport: { width: g.width, height: g.height }, deviceScaleFactor: g.dpr, isMobile: size === "phone", hasTouch: size === "phone" });
      const page = await ctx.newPage();
      const ms: number[] = [];
      page.on("console", (m) => {
        const hit = m.text().match(/\[sky\] GPU ([\d.]+) ms\/frame/);
        if (hit) ms.push(Number(hit[1]));
      });
      await page.goto(`${BASE}/?${q(time, wx, rest)}`, { waitUntil: "networkidle" });
      // The weather eases in over 4 s: the steady state is what the gate is about.
      await page.waitForTimeout(6000);
      const t0 = Date.now();
      while (ms.length < 6 && Date.now() - t0 < 60_000) await page.waitForTimeout(500);
      await ctx.close();
      rows.push({ condition: `${wx} ${time}${rest ? ` ${rest}` : ""}`, size: `${g.width}x${g.height} DPR ${g.dpr}`, ms });
      const sorted = [...ms].sort((a, b) => a - b);
      console.log(`${wx.padEnd(11)} ${time}  ${size.padEnd(5)}  GPU ${ms.map((v) => v.toFixed(2)).join(" ")} ms  (median ${sorted[sorted.length >> 1]?.toFixed(2) ?? "-"}, max ${sorted.at(-1)?.toFixed(2) ?? "-"})`);
    }
  fs.mkdirSync(ROOT, { recursive: true });
  fs.writeFileSync(`${ROOT}/gpu.json`, JSON.stringify(rows, null, 1));
} else {
  const tasks = only.length ? only : ["w1"];
  for (const task of tasks) {
    const shots = TASKS[task];
    if (!shots) throw new Error(`no evidence list for "${task}"`);
    const out = `${ROOT}/${task}`;
    fs.mkdirSync(out, { recursive: true });
    const manifest: unknown[] = [];
    for (const s of shots) manifest.push(await take(browser, out, s));
    fs.writeFileSync(`${out}/manifest.json`, JSON.stringify(manifest, null, 1));
    const desks = shots.filter((s) => s.size === "desk" && !s.frames).map((s) => `${out}/${s.name}.png`);
    const phones = shots.filter((s) => s.size === "phone" && !s.frames).map((s) => `${out}/${s.name}.png`);
    if (desks.length > 1) await sheet(browser, out, `${task} desktop`, desks, 2, 700);
    if (phones.length > 1) await sheet(browser, out, `${task} phone`, phones, Math.min(4, phones.length), 300);
  }
}
await browser.close();
