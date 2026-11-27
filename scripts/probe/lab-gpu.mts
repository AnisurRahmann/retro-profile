/**
 * Volumetric lab GPU probe (T6; both outputs and the compositor since M2): GPU ms/frame per state (A–C, from
 * LAB_PRESETS), tier (high/medium/low) and output (single, layered) at 1920×1080 DPR 2 and 375×812 DPR 3, measured
 * over 5 s each from EXT_disjoint_timer_query_webgl2 through window.__vol (one query per frame per context; the probe
 * samples the latest means every 100 ms).
 *
 * The budget (BRIEF §5): **sum** = the cloud context's gpuMs + the background layer's bgGpuMs (layered only), both
 * amortised per frame, plus **comp** = the browser compositor's busy ms per frame (VizCompositorThread, from a 3 s
 * Chrome trace). comp is traced on the two target cells only (high at 1920×1080, low at 375×812); `OVER` compares
 * sum + comp with the target. Prints a table and writes <run>/gpu.json (RUN_DIR files it beside a lab:shots run).
 * Needs a dev or test build running: LAB_URL is required, and there is no default port.
 * Usage: LAB_URL=http://localhost:<port> pnpm lab:gpu [A B C ...]   (states; default all)   OUTS=single,layered
 */
import fs from "node:fs";
import { chromium, type Page } from "@playwright/test";
import { GPU_TARGETS, LAB_PRESETS, QUALITY_TIERS, type QualityTier, type VolDebug } from "../../src/components/sky/volumetric/types";
import { labUrl } from "./lab-url.mjs";

const BASE = labUrl();
const ids = (process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(LAB_PRESETS)) as (keyof typeof LAB_PRESETS)[];
const MEASURE_MS = 5_000;
const WARMUP_MS = 1_000;
const SAMPLE_EVERY_MS = 100;
const TRACE_MS = 3_000;
const OUTS = (process.env.OUTS ?? "single,layered").split(",").filter((o): o is "single" | "layered" => o === "single" || o === "layered");

const VIEWPORTS = [
  { w: GPU_TARGETS.high.width, h: GPU_TARGETS.high.height, dpr: GPU_TARGETS.high.dpr },
  { w: GPU_TARGETS.low.width, h: GPU_TARGETS.low.height, dpr: GPU_TARGETS.low.dpr },
] as const;

const stateQuery = (id: keyof typeof LAB_PRESETS, tier: string) => {
  const q = new URLSearchParams(Object.entries(LAB_PRESETS[id]).map(([k, v]) => [k, String(v)]));
  q.set("tier", tier);
  return q.toString();
};

const waitReady = async (page: Page) => {
  await page.waitForFunction(
    () => {
      const v = (window as { __vol?: VolDebug }).__vol;
      return !!v && (v.error !== null || (v.ready && v.frames > 40));
    },
    { timeout: 120_000, polling: 250 },
  );
  const v = await page.evaluate(() => (window as { __vol?: VolDebug }).__vol);
  if (!v || v.error) throw new Error(`[vol] ${v?.error ?? "renderer did not start"}`);
  return v;
};

/** The renderer's latest finished GPU query, sampled in-page every SAMPLE_EVERY_MS for MEASURE_MS. */
const measure = (page: Page) =>
  page.evaluate(
    ({ ms, every }: { ms: number; every: number }) => {
      return new Promise<{ samples: number[]; cloud: number[]; bg: number[]; frames: number; error: string | null }>((resolve) => {
        const samples: number[] = [];
        const cloud: number[] = [];
        const bg: number[] = [];
        let lastFrame = 0;
        let settled = false;
        // No const-bound inner functions here: tsx (esbuild keepNames) would wrap them in a __name helper
        // that doesn't exist in the page once Playwright serializes this callback.
        const iv = setInterval(() => {
          const v = (window as { __vol?: VolDebug }).__vol;
          if (!v || settled) return;
          if (v.error) {
            settled = true;
            clearInterval(iv);
            resolve({ samples, cloud, bg, frames: v.frames, error: v.error });
          } else if (v.gpuMs !== null && v.frames > lastFrame && (v.out !== "layered" || v.bgGpuMs !== null)) {
            lastFrame = v.frames;
            const b = v.out === "layered" ? (v.bgGpuMs ?? 0) : 0;
            samples.push(v.gpuMs + b);
            cloud.push(v.gpuMs);
            bg.push(b);
          }
        }, every);
        setTimeout(() => {
          if (settled) return;
          settled = true;
          clearInterval(iv);
          const v = (window as { __vol?: VolDebug }).__vol;
          resolve({ samples, cloud, bg, frames: v?.frames ?? 0, error: v?.error ?? null });
        }, ms);
      });
    },
    { ms: MEASURE_MS, every: SAMPLE_EVERY_MS },
  );

const stats = (xs: number[]) => {
  if (!xs.length) return { mean: null as number | null, p95: null as number | null, max: null as number | null };
  const sorted = [...xs].sort((a, b) => a - b);
  return {
    mean: xs.reduce((a, b) => a + b, 0) / xs.length,
    p95: sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)]!,
    max: sorted[sorted.length - 1]!,
  };
};

const targetMs = (tier: QualityTier, vp: (typeof VIEWPORTS)[number]) => {
  const t = tier === "high" ? GPU_TARGETS.high : tier === "low" ? GPU_TARGETS.low : null;
  return t && t.width === vp.w && t.height === vp.h && t.dpr === vp.dpr ? t.ms : null;
};

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

type TraceEvent = { name: string; ph: string; dur?: number; tid: number; pid: number; args?: { name?: string } };
/** The compositor's busy ms per frame: VizCompositorThread task time over a TRACE_MS Chrome trace ÷ frames drawn. */
const compositorMs = async (page: Page): Promise<number | null> => {
  const browser = page.context().browser();
  if (!browser) return null;
  const f0 = await page.evaluate(() => (window as { __vol?: VolDebug }).__vol?.frames ?? 0);
  await browser.startTracing(page, { categories: ["toplevel", "viz"] });
  await page.waitForTimeout(TRACE_MS);
  const buf = await browser.stopTracing();
  const f1 = await page.evaluate(() => (window as { __vol?: VolDebug }).__vol?.frames ?? 0);
  const raw = JSON.parse(buf.toString()) as { traceEvents?: TraceEvent[] } | TraceEvent[];
  const events = Array.isArray(raw) ? raw : (raw.traceEvents ?? []);
  const names = new Map<string, string>();
  for (const e of events) if (e.name === "thread_name" && e.args?.name) names.set(`${e.pid}:${e.tid}`, e.args.name);
  let us = 0;
  for (const e of events) {
    if (e.ph !== "X" || !e.dur || (e.name !== "ThreadControllerImpl::RunTask" && e.name !== "RunTask")) continue;
    if (names.get(`${e.pid}:${e.tid}`) === "VizCompositorThread") us += e.dur;
  }
  return f1 > f0 ? us / 1000 / (f1 - f0) : null;
};

const now = new Date();
const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
const OUT = process.env.RUN_DIR ?? `.shots/volumetric-lab/run-${stamp}`;
const rows: Record<string, unknown>[] = [];

const browser = await chromium.launch({ args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
console.log(`Lab GPU ms/frame · EXT_disjoint_timer_query_webgl2 · ${MEASURE_MS / 1000} s per cell · ${BASE}`);
console.log("sum = cloud + bg context (amortised means); comp = VizCompositorThread ms/frame (target cells); OVER: sum + comp");
console.log(
  `${"state".padEnd(6)}${"tier".padEnd(7)}${"out".padEnd(8)}${"viewport".padEnd(16)}${"sum".padStart(7)}${"p95".padStart(7)}${"max".padStart(7)}${"cloud".padStart(7)}${"bg".padStart(6)}${"comp".padStart(6)}  ${"n".padStart(3)}${"frames".padStart(6)}`,
);
for (const vp of VIEWPORTS) {
  const page = await browser.newPage({
    viewport: { width: vp.w, height: vp.h },
    deviceScaleFactor: vp.dpr,
    isMobile: vp.w < 640,
    hasTouch: vp.w < 640,
  });
  for (const id of ids) {
    for (const tier of QUALITY_TIERS) {
      for (const out of OUTS) {
        await page.goto(`${BASE}/lab/clouds?${stateQuery(id, tier)}&out=${out}`, { waitUntil: "load" });
        const { tier: ran, out: ranOut } = await waitReady(page);
        await page.waitForTimeout(WARMUP_MS);
        const { samples, cloud, bg, frames, error } = await measure(page);
        const { mean: sum, p95, max } = stats(samples);
        const target = targetMs(tier, vp);
        const comp = target !== null && !error ? await compositorMs(page) : null;
        const total = sum === null ? null : sum + (comp ?? 0);
        const over = target !== null && total !== null && total > target;
        const miss = !error && !samples.length ? "EXT_disjoint_timer_query_webgl2 unavailable" : error;
        const ms = (x: number | null, w = 7) => (x === null ? "–".padStart(w) : x.toFixed(2).padStart(w));
        console.log(
          `${id.padEnd(6)}${tier.padEnd(7)}${out.padEnd(8)}${`${vp.w}×${vp.h} DPR ${vp.dpr}`.padEnd(16)}${ms(sum)}${ms(p95)}${ms(max)}${ms(mean(cloud))}${ms(out === "layered" ? mean(bg) : null, 6)}${ms(comp, 6)}  ${String(samples.length).padStart(3)}${String(frames).padStart(6)}${over ? "  OVER" : ""}${ran !== tier ? `  RAN ${ran}` : ""}${ranOut !== out ? `  OUT ${ranOut}` : ""}${miss ? `  ${miss}` : ""}`,
        );
        rows.push({
          state: id,
          tier,
          ranTier: ran,
          out,
          ranOut,
          viewport: { width: vp.w, height: vp.h, dpr: vp.dpr },
          gpuMeanMs: sum,
          gpuP95Ms: p95,
          gpuMaxMs: max,
          cloudMeanMs: mean(cloud),
          bgMeanMs: out === "layered" ? mean(bg) : null,
          compositorMs: comp,
          budgetMs: target === null ? null : total,
          gpuSamples: samples.length,
          frames,
          targetMs: target,
          overTarget: over,
          error: miss,
        });
      }
    }
  }
  await page.close();
}
await browser.close();

fs.mkdirSync(OUT, { recursive: true });
const file = `${OUT}/gpu.json`;
fs.writeFileSync(
  file,
  `${JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      baseUrl: BASE,
      measureMs: MEASURE_MS,
      warmupMs: WARMUP_MS,
      sampleEveryMs: SAMPLE_EVERY_MS,
      traceMs: TRACE_MS,
      budget: "sum of the cloud and background contexts' amortised GPU ms + VizCompositorThread ms/frame",
      targets: GPU_TARGETS,
      rows,
    },
    null,
    2,
  )}\n`,
);
console.log(`\ntargets: high ≤ ${GPU_TARGETS.high.ms} ms at ${GPU_TARGETS.high.width}×${GPU_TARGETS.high.height} DPR ${GPU_TARGETS.high.dpr} · low ≤ ${GPU_TARGETS.low.ms} ms at ${GPU_TARGETS.low.width}×${GPU_TARGETS.low.height} DPR ${GPU_TARGETS.low.dpr}`);
console.log(file);
