/**
 * Volumetric lab review shots (T6; review states, 100% crops and metrics T9). States A–C (BRIEF §7, from
 * LAB_PRESETS) × tiers high/medium/low × 1440×900 DPR 2 and 375×812 DPR 3, plus two frames of A 10 s apart (wind
 * drift), into .shots/volumetric-lab/run-<ts>/ with a sheet.png contact sheet (an HTML grid screenshotted by
 * Playwright).
 *
 * T9 adds:
 * - A-away (A with the camera 180° from the sun), captured like A–C;
 * - the reference renders A-ref and C-ref (scale=1&reproject=0&accum=64: every pixel marched, no reprojection, a
 *   64-frame mean), at 1440×900 DPR 2 on the high tier only;
 * - crops/: a 100% crop of every 1440×900 shot (six 600×600 in a 3×2 grid, and the 300 device px above the horizon);
 * - crops.png (one row per shot), pair-A.png (A-high's crops beside A-ref's) and metrics.json (one entry per crop).
 *
 * Needs a dev or test build running: LAB_URL is required, and there is no default port.
 * Usage: LAB_URL=http://localhost:<port> pnpm lab:shots [A B C A-away A-ref C-ref …]   (default: all six)
 */
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { chromium, type Page } from "@playwright/test";
import { LAB_PRESETS, QUALITY_TIERS, TIERS, type QualityTier, type VolDebug } from "../../src/components/sky/volumetric/types";
import { presetState } from "../../src/lib/sky/volumetric/lab-state";
import { sceneFor } from "../../src/lib/sky/volumetric/scene";
import { crop, decodePng, encodePng } from "./lab-image.mjs";
import { BAND_SIZE, CROP_SIZE, cropRects, measureCrop, type CropMetrics } from "./lab-metrics.mjs";
import { labUrl } from "./lab-url.mjs";

const BASE = labUrl();

/**
 * window.__vol, plus the flag a reference render needs: `accumReady` (T10 wires it, see handoffs/T9.md "Requests").
 * False while a state with accum > 0 is still averaging, true once the N frames are in (and whenever accum is 0).
 * The hook is the only way the probe learns this.
 */
type VolHook = VolDebug & { accumReady?: boolean };

type State = { id: string; url: (tier: QualityTier) => string; ref?: boolean };
const SIZES = [
  { name: "1440x900", w: 1440, h: 900, dpr: 2 },
  { name: "375x812", w: 375, h: 812, dpr: 3 },
] as const;
/** The reference renders: 1440×900 DPR 2, high tier, a mean of this many frames. */
const REF_SIZE = SIZES[0];
const REF_TIER: QualityTier = "high";
const REF_ACCUM = 64;

const stateQuery = (id: keyof typeof LAB_PRESETS, tier?: string) => {
  const q = new URLSearchParams(Object.entries(LAB_PRESETS[id]).map(([k, v]) => [k, String(v)]));
  if (tier) q.set("tier", tier);
  return q.toString();
};
const refQuery = (id: keyof typeof LAB_PRESETS, tier: string) =>
  `${stateQuery(id, tier)}&scale=1&reproject=0&accum=${REF_ACCUM}`;
/** A-away: A's camera turned 180° from the sun: the sun's bearing for A (sceneFor) plus 180°. */
const AWAY_AZ = ((sceneFor(presetState("A")).sun.azDeg + 180) % 360).toFixed(2);

const STATES: readonly State[] = [
  { id: "A", url: (tier) => stateQuery("A", tier) },
  { id: "B", url: (tier) => stateQuery("B", tier) },
  { id: "C", url: (tier) => stateQuery("C", tier) },
  { id: "A-away", url: (tier) => `${stateQuery("A", tier)}&view=${AWAY_AZ}` },
  { id: "A-ref", url: () => refQuery("A", REF_TIER), ref: true },
  { id: "C-ref", url: () => refQuery("C", REF_TIER), ref: true },
];

const wanted = process.argv.slice(2);
const unknown = wanted.filter((id) => !STATES.some((s) => s.id === id));
if (unknown.length) {
  console.error(`[lab] unknown state ${unknown.join(", ")}: choose from ${STATES.map((s) => s.id).join(" ")}`);
  process.exit(2);
}
const states = STATES.filter((s) => !wanted.length || wanted.includes(s.id));

const now = new Date();
const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
const OUT = process.env.RUN_DIR ?? `.shots/volumetric-lab/run-${stamp}`;

// The renderer sets window.__vol once it has drawn (frames climbs only while it lives, so a disposed
// StrictMode first instance never satisfies this); error short-circuits the wait. The evaluate callbacks stay
// plain: tsx wraps a const-bound function inside one in a __name helper that doesn't exist in the page (T6).
const waitReady = async (page: Page) => {
  await page.waitForFunction(() => {
    const v = (window as { __vol?: VolHook }).__vol;
    return !!v && (v.error !== null || (v.ready && v.frames > 40));
  }, { timeout: 120_000, polling: 250 });
  const v = await page.evaluate(() => (window as { __vol?: VolHook }).__vol);
  if (!v || v.error) throw new Error(`[vol] ${v?.error ?? "renderer did not start"}`);
  return v;
};

/**
 * A reference render waits for the hook's accumReady. A renderer that doesn't expose it (before T10) ignores accum=,
 * so nothing is being averaged: there is nothing to wait for, and the shot is not a reference render. Returns whether
 * the mean was confirmed.
 */
const waitAccum = async (page: Page, id: string) => {
  const exposed = await page.evaluate(() => typeof (window as { __vol?: VolHook }).__vol?.accumReady === "boolean");
  if (!exposed) {
    console.warn(`[vol] ${id}: window.__vol.accumReady is not exposed (the renderer predates T10): accum=${REF_ACCUM} has no effect, so this is not a reference render`);
    return false;
  }
  await page.waitForFunction(() => {
    const v = (window as { __vol?: VolHook }).__vol;
    return !!v && (v.error !== null || v.accumReady === true);
  }, { timeout: 180_000, polling: 100 });
  const v = await page.evaluate(() => (window as { __vol?: VolHook }).__vol);
  if (!v || v.error) throw new Error(`[vol] ${id}: ${v?.error ?? "renderer went away while accumulating"}`);
  return true;
};

type Shot = {
  file: string;
  name: string;
  id: string;
  label: string;
  group: string;
  w: number;
  h: number;
  dpr: number;
  tier: QualityTier;
  /** The cloud target's scale the shot was really rendered at. */
  scale: number;
  ref: boolean;
  /**
   * A reference render only: whether the hook confirmed the review params are in effect (the mean was complete).
   * T10 wires scale, reproject and accum together, so a renderer that doesn't report the mean ignores all three.
   * Such a shot is an ordinary render of its preset at the tier's scale, and is labelled so.
   */
  accumConfirmed: boolean | null;
};
type Size = (typeof SIZES)[number];
const shots: Shot[] = [];
const cropEntries: Record<string, unknown>[] = [];
const cropFiles = new Map<string, Map<string, string>>();
const round = (x: number, d = 4) => Number(x.toFixed(d));

/** The 100% crops of a 1440×900 shot, saved and measured. */
const cropShot = (s: Shot) => {
  const frame = decodePng(fs.readFileSync(s.file));
  if (frame.width !== s.w * s.dpr || frame.height !== s.h * s.dpr) {
    throw new Error(`[lab] ${s.file}: ${frame.width}×${frame.height} px, expected ${s.w * s.dpr}×${s.h * s.dpr}`);
  }
  const files = new Map<string, string>();
  for (const r of cropRects(frame.width, frame.height)) {
    const img = crop(frame, r.x, r.y, r.w, r.h);
    const file = `${OUT}/crops/${s.name}-${r.name}.png`;
    fs.writeFileSync(file, encodePng(img));
    files.set(r.name, file);
    const band = r.name === "band";
    const m: CropMetrics = measureCrop(img, { scale: s.scale, origin: [r.x, r.y], dpr: s.dpr, band });
    cropEntries.push({
      shot: s.name,
      state: s.id,
      tier: s.tier,
      viewport: { width: s.w, height: s.h, dpr: s.dpr },
      cloudScale: s.scale,
      crop: r.name,
      rect: [r.x, r.y, r.w, r.h],
      file: `crops/${s.name}-${r.name}.png`,
      lattice: m.lattice === null ? null : round(m.lattice, 6),
      latticeQuads: m.latticeQuads,
      edgeWidth: m.edgeWidth === null ? null : round(m.edgeWidth, 3),
      edgeSamples: m.edgeSamples,
      bodyStd: m.bodyStd === null ? null : round(m.bodyStd, 5),
      bodyBoxes: m.bodyBoxes,
      streak: m.streak === null || !Number.isFinite(m.streak) ? null : round(m.streak, 4),
    });
  }
  cropFiles.set(s.name, files);
  console.log(`${OUT}/crops/${s.name}-{${[...files.keys()].join(",")}}.png`);
};

const shoot = async (page: Page, s: Omit<Shot, "file" | "scale" | "accumConfirmed">, size: Size, askedTier: QualityTier) => {
  const v = await waitReady(page);
  // A tier the renderer didn't honour would mislabel the shot.
  if (v.tier !== askedTier) console.warn(`[vol] ${s.name}: asked for ${askedTier}, the renderer runs ${v.tier}`);
  if (s.ref && (v.state.accum !== REF_ACCUM || v.state.scale !== 1 || v.state.reproject !== 0)) {
    throw new Error(`[lab] ${s.name}: the lab did not read scale=1&reproject=0&accum=${REF_ACCUM} (its state says scale=${v.state.scale} reproject=${v.state.reproject} accum=${v.state.accum})`);
  }
  const accumConfirmed = s.ref ? await waitAccum(page, s.id) : null;
  await page.waitForTimeout(300);
  const file = `${OUT}/${s.name}.png`;
  await page.screenshot({ path: file });
  console.log(file);
  const tierScale = TIERS[v.tier]?.scale;
  if (tierScale === undefined) throw new Error(`[lab] ${s.name}: the renderer reports an unknown tier "${v.tier}"`);
  const live = accumConfirmed !== false;
  const shot: Shot = { ...s, file, scale: live ? (v.state.scale ?? tierScale) : tierScale, accumConfirmed };
  shots.push(shot);
  if (size.w === REF_SIZE.w && size.h === REF_SIZE.h) cropShot(shot);
};

fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(`${OUT}/crops`, { recursive: true });
const browser = await chromium.launch({ args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
const newPage = (size: Size) =>
  browser.newPage({
    viewport: { width: size.w, height: size.h },
    deviceScaleFactor: size.dpr,
    isMobile: size.w < 640,
    hasTouch: size.w < 640,
  });

console.log(`Lab review shots · ${BASE} · states ${states.map((s) => s.id).join(" ")}`);
for (const st of states) {
  const cells = st.ref ? [{ tier: REF_TIER, size: REF_SIZE as Size }] : QUALITY_TIERS.flatMap((tier) => SIZES.map((size) => ({ tier, size })));
  for (const { tier, size } of cells) {
    const page = await newPage(size);
    await page.goto(`${BASE}/lab/clouds?${st.url(tier)}`, { waitUntil: "load" });
    await shoot(page, { name: `${st.id}-${tier}-${size.name}`, id: st.id, label: `${st.id} · ${tier}`, group: size.name, w: size.w, h: size.h, dpr: size.dpr, tier, ref: !!st.ref }, size, tier);
    await page.close();
  }
}

// Drift: the same live state A ten seconds apart (wind scroll, detail evolution).
if (states.some((s) => s.id === "A")) {
  const page = await newPage(REF_SIZE);
  await page.goto(`${BASE}/lab/clouds?${stateQuery("A")}`, { waitUntil: "load" });
  const v = await waitReady(page);
  for (const [name, label, wait] of [
    ["A-drift-0s", "A · 0 s", 0],
    ["A-drift-10s", "A · +10 s", 10_000],
  ] as const) {
    await page.waitForTimeout(wait);
    await shoot(page, { name, id: "A-drift", label, group: "A drift (10 s apart)", w: REF_SIZE.w, h: REF_SIZE.h, dpr: REF_SIZE.dpr, tier: v.tier, ref: false }, REF_SIZE, v.tier);
  }
  await page.close();
}

// ─── metrics.json ────────────────────────────────────────────────────────────────────────────────────────────────

const mean = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x !== null && Number.isFinite(x));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};
const meanOf = (shot: string, key: keyof CropMetrics, band: boolean) =>
  mean(cropEntries.filter((e) => e.shot === shot && (e.crop === "band") === band).map((e) => e[key] as number | null));
const summary = shots
  .filter((s) => cropFiles.has(s.name))
  .map((s) => ({
    shot: s.name,
    state: s.id,
    tier: s.tier,
    cloudScale: s.scale,
    // Over the six grid crops; the band is separate (its own lattice, edgeWidth and bodyStd, and its streak).
    lattice: meanOf(s.name, "lattice", false),
    edgeWidth: meanOf(s.name, "edgeWidth", false),
    bodyStd: meanOf(s.name, "bodyStd", false),
    bandLattice: meanOf(s.name, "lattice", true),
    bandEdgeWidth: meanOf(s.name, "edgeWidth", true),
    bandBodyStd: meanOf(s.name, "bodyStd", true),
    bandStreak: meanOf(s.name, "streak", true),
    ...(s.ref ? { accumConfirmed: s.accumConfirmed } : {}),
  }));
const metricsFile = `${OUT}/metrics.json`;
fs.writeFileSync(
  metricsFile,
  `${JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      baseUrl: BASE,
      note: [
        "Image metrics of the 100% crops, for comparing runs of lab:shots. They are not pass/fail gates.",
        "lattice: the crop box-resampled onto the cloud target's texel grid (cloudScale; texel k covers device px [k/scale, (k+1)/scale),",
        "  then the mean |[[1,-1],[-1,1]]| response of Rec.709 luma over 2×2 windows whose four texels all have HSV saturation < 0.35.",
        "  A 2×2 checkerboard of amplitude A on the texel grid reads 4A. latticeQuads: windows counted.",
        "edgeWidth: median 10–90% rise width (CSS px) of the strongest 1% of Sobel edges, each profiled ±12 device px along its gradient.",
        "  Wider is softer. Within 1% from about 2 to 5 CSS px of width at DPR 2; the window cuts wider edges (reads −7% at 7.7 CSS px).",
        "  edgeSamples: profiles counted.",
        "bodyStd: median standard deviation of luma over 41×41-px boxes whose mean saturation is < 0.2 (cloud bodies). bodyBoxes: boxes counted.",
        "streak (band only): Σ(dL/dy)² / Σ(dL/dx)² of the band's Sobel gradients. Above 1: horizontal streaks or banding. null when undefined.",
        "summary[]: means over the six grid crops; band* are the horizon band's own values.",
      ].join("\n"),
      crops: cropEntries,
      summary,
    },
    null,
    2,
  )}\n`,
);
const col = (x: number | null | undefined, w: number, d: number) => (x === null || x === undefined ? "n/a".padStart(w) : x.toFixed(d).padStart(w));
console.log(`\n${"shot".padEnd(24)}${"scale".padStart(6)}${"lattice".padStart(9)}${"edge px".padStart(9)}${"bodyStd".padStart(9)}${"streak".padStart(8)}`);
for (const s of summary) {
  console.log(`${s.shot.padEnd(24)}${s.cloudScale.toFixed(2).padStart(6)}${col(s.lattice, 9, 5)}${col(s.edgeWidth, 9, 2)}${col(s.bodyStd, 9, 4)}${col(s.bandStreak, 8, 2)}`);
}
console.log(metricsFile);

// ─── Contact sheets: HTML beside the PNGs, screenshotted by Playwright at 1:1 ────────────────────────────────────

const image = (file: string, cls = "") => `<img class="${cls}" src="${file.slice(OUT.length + 1)}">`;
/** A 1440×900 DPR 2 frame in device px, and the width of the six grid crops side by side. */
const FRAME_W = REF_SIZE.w * REF_SIZE.dpr;
const CROPS_W = 6 * CROP_SIZE;
/** pair-A.png: the rule between the two crops of a pair, and between the two bands. */
const PAIR_RULE = 6;
/** Named colours only: there is no hex in this project's code. */
const SHEET_CSS =
  "body{margin:0;background:black;color:silver;padding:12px;font:12px monospace}" +
  "h2{margin:14px 0 6px;font-size:12px;font-weight:400;color:white}" +
  ".grid{display:grid;gap:6px}figure{margin:0}img{display:block}figcaption{padding:3px 0 6px;color:gray}" +
  ".row{margin:0 0 16px}.lab{padding:0 0 4px;color:white}" +
  `.crops{display:grid;grid-template-columns:repeat(6,${CROP_SIZE}px)}` +
  `.crops img,.pair img{width:${CROP_SIZE}px;height:${CROP_SIZE}px;image-rendering:pixelated}` +
  `.band img{width:${FRAME_W}px;height:${BAND_SIZE}px;image-rendering:pixelated}` +
  // pair-A: a rule between the two members of a pair, a wide gutter between pairs.
  `.pairs{display:grid;grid-template-columns:repeat(3,${2 * CROP_SIZE + PAIR_RULE}px);gap:40px}` +
  `.pair{display:grid;grid-template-columns:${CROP_SIZE}px ${PAIR_RULE}px ${CROP_SIZE}px}.pair i,.rule{display:block;background:gray}` +
  `.pair i{width:${PAIR_RULE}px}.rule{height:${PAIR_RULE}px;margin:8px 0}`;

/** The crop sheets are thousands of px wide, so their headings are read zoomed out. */
const BIG = ".lab,h2{font-size:24px}.lab{padding:6px 0 8px}h2{margin:0 0 12px;line-height:1.35}";

/** Screenshots html (whose images sit beside it in OUT) at device scale 1: 100% crops stay 100%. */
const shootHtml = async (html: string, out: string, width: number) => {
  const tmp = `${OUT}/.${out.slice(OUT.length + 1)}.html`;
  fs.writeFileSync(tmp, html);
  const page = await browser.newPage({ viewport: { width, height: 800 }, deviceScaleFactor: 1 });
  try {
    await page.goto(pathToFileURL(tmp).href, { waitUntil: "load" });
    await page.waitForTimeout(300);
    await page.screenshot({ path: out, fullPage: true });
  } finally {
    await page.close();
    fs.rmSync(tmp, { force: true });
  }
  console.log(out);
};

// crops.png: one row per 1440×900 shot: the six grid crops side by side, the horizon band under them.
const cropped = shots.filter((s) => cropFiles.has(s.name));
if (cropped.length) {
  const W = CROPS_W + 24;
  // Chromium's screenshot limit is 16384 px. A row is its crops, the band, a heading and a margin; keep the page
  // under 16,000.
  const PER_PAGE = Math.max(1, Math.floor(16_000 / (CROP_SIZE + BAND_SIZE + 60 + 16)));
  if (cropped.length > PER_PAGE) console.warn(`[lab] ${cropped.length} cropped shots: crops.png comes in ${Math.ceil(cropped.length / PER_PAGE)} sheets of ${PER_PAGE} rows`);
  const pages = Math.max(1, Math.ceil(cropped.length / PER_PAGE));
  for (let p = 0; p < pages; p++) {
    const rows = cropped.slice(p * PER_PAGE, (p + 1) * PER_PAGE);
    const html =
      `<!doctype html><meta charset="utf-8"><style>${SHEET_CSS}${BIG}</style>` +
      `<h2>100% crops · 1440×900 DPR 2 · one row per shot: g0 g1 g2 (centres 25% down), g3 g4 g5 (55% down), then the ${BAND_SIZE} device px above the horizon${pages > 1 ? ` · sheet ${p + 1}/${pages}` : ""}</h2>` +
      rows
        .map(
          (s) =>
            `<section class="row"><div class="lab">${s.name} · cloud scale ${s.scale.toFixed(2)}${s.accumConfirmed === false ? " · NOT a reference render (the renderer predates T10)" : s.ref ? ` · every pixel marched · mean of ${REF_ACCUM} frames` : ""}</div>` +
            `<div class="crops">${[...cropFiles.get(s.name)!.keys()].filter((k) => k !== "band").map((k) => image(cropFiles.get(s.name)!.get(k)!)).join("")}</div>` +
            `<div class="band">${image(cropFiles.get(s.name)!.get("band")!)}</div></section>`,
        )
        .join("");
    await shootHtml(html, `${OUT}/${p ? `crops-${p + 1}.png` : "crops.png"}`, W);
  }
}

// pair-A.png: each crop of A-high beside the same crop of A-ref.
const live = cropFiles.get(`A-${REF_TIER}-${REF_SIZE.name}`);
const ref = cropFiles.get(`A-ref-${REF_TIER}-${REF_SIZE.name}`);
if (live && ref) {
  const keys = [...live.keys()];
  const refShot = shots.find((s) => s.name === `A-ref-${REF_TIER}-${REF_SIZE.name}`)!;
  const html =
    `<!doctype html><meta charset="utf-8"><style>${SHEET_CSS}${BIG}</style>` +
    `<h2>pair A · 1440×900 DPR 2 · each crop of A · high · cloud scale ${TIERS[REF_TIER].scale.toFixed(2)} (left) beside the same crop of A-ref (right) · ${refShot.accumConfirmed ? `A-ref: scale 1 · no reprojection · mean of ${REF_ACCUM} frames` : `A-ref is NOT a reference render: the renderer predates T10, so scale 1 and accum ${REF_ACCUM} had no effect and both sides are ordinary renders of A`}</h2>` +
    `<div class="pairs">${keys.filter((k) => k !== "band").map((k) => `<div class="pair">${image(live.get(k)!)}<i></i>${image(ref.get(k)!)}</div>`).join("")}</div>` +
    `<div class="band">${image(live.get("band")!)}</div><i class="rule"></i><div class="band">${image(ref.get("band")!)}</div>`;
  await shootHtml(html, `${OUT}/pair-A.png`, 3 * (2 * CROP_SIZE + PAIR_RULE) + 2 * 40 + 24);
} else console.log("pair-A.png skipped: the run has no A-high and A-ref at 1440×900");

// sheet.png: every group as a labelled grid of the shots.
const section = (title: string, cells: Shot[], cols: number, width: number) =>
  cells.length
    ? `<h2>${title}</h2><div class="grid" style="grid-template-columns:repeat(${cols},${width}px)">${cells
        .map((s) => `<figure>${image(s.file)}<figcaption>${s.label} · ${s.tier}</figcaption></figure>`)
        .join("")}</div>`
    : "";
const rows = (xs: Shot[]) => [...new Set(xs.map((s) => s.id))].join(" ");
const desktop = shots.filter((s) => s.group === "1440x900" && !s.ref);
const mobile = shots.filter((s) => s.group === "375x812");
const refs = shots.filter((s) => s.ref);
const drift = shots.filter((s) => s.group.startsWith("A drift"));
await shootHtml(
  `<!doctype html><meta charset="utf-8"><style>${SHEET_CSS}.grid img{width:100%}</style>` +
    section(`1440×900 DPR 2 — rows ${rows(desktop)}, columns high medium low`, desktop, 3, 460) +
    section(`375×812 DPR 3 — rows ${rows(mobile)}, columns high medium low`, mobile, 3, 150) +
    section(`reference renders — 1440×900 DPR 2, high tier, scale 1, no reprojection, a ${REF_ACCUM}-frame mean${refs.some((s) => !s.accumConfirmed) ? " — NOT in effect: the renderer predates T10, so these are ordinary renders of A and C" : ""}`, refs, 2, 700) +
    section("A drift (10 s apart)", drift, 2, 560),
  `${OUT}/sheet.png`,
  3 * 460 + 12 * 6 + 24,
);

const unconfirmed = refs.filter((s) => !s.accumConfirmed).map((s) => s.name);
console.log(`${OUT} — ${shots.length} shots, ${cropEntries.length} crops${unconfirmed.length ? `; ${unconfirmed.join(", ")}: NOT reference renders (scale, reproject and accum have no effect before T10)` : ""}`);
await browser.close();
