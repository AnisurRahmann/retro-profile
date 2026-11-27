/**
 * Volumetric lab GPU probe (T6): GPU ms/frame per state (A–C, from LAB_PRESETS) and tier (high/medium/low) at
 * 1920×1080 DPR 2 and 375×812 DPR 3, measured over 5 s each from EXT_disjoint_timer_query_webgl2 through
 * window.__vol (renderer.ts already runs one query per frame; the probe samples the latest result every 100 ms).
 * Prints a table with the BRIEF §5 targets (GPU_TARGETS) marked, and writes <run>/gpu.json
 * (RUN_DIR points it at an existing lab:shots run, filing it next to the shots).
 * Needs a dev or test build running (LAB_URL, default http://localhost:$VOL_PORT, else 3005).
 * Usage: pnpm lab:gpu [A B C ...]   (states to measure; default all)
 */
import fs from "node:fs";
import { chromium, type Page } from "@playwright/test";
import { GPU_TARGETS, LAB_PRESETS, QUALITY_TIERS, type QualityTier, type VolDebug } from "../../src/components/sky/volumetric/types";

const BASE = process.env.LAB_URL ?? `http://localhost:${process.env.VOL_PORT ?? 3005}`;
const ids = (process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(LAB_PRESETS)) as (keyof typeof LAB_PRESETS)[];
const MEASURE_MS = 5_000;
const WARMUP_MS = 1_000;
const SAMPLE_EVERY_MS = 100;

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
};

/** The renderer's latest finished GPU query, sampled in-page every SAMPLE_EVERY_MS for MEASURE_MS. */
const measure = (page: Page) =>
  page.evaluate(
    ({ ms, every }: { ms: number; every: number }) => {
      return new Promise<{ samples: number[]; frames: number; error: string | null }>((resolve) => {
        const samples: number[] = [];
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
            resolve({ samples, frames: v.frames, error: v.error });
          } else if (v.gpuMs !== null && v.frames > lastFrame) {
            lastFrame = v.frames;
            samples.push(v.gpuMs);
          }
        }, every);
        setTimeout(() => {
          if (settled) return;
          settled = true;
          clearInterval(iv);
          const v = (window as { __vol?: VolDebug }).__vol;
          resolve({ samples, frames: v?.frames ?? 0, error: v?.error ?? null });
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

const now = new Date();
const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
const OUT = process.env.RUN_DIR ?? `.shots/volumetric-lab/run-${stamp}`;
const rows: Record<string, unknown>[] = [];

const browser = await chromium.launch({ args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
console.log(`Lab GPU ms/frame · EXT_disjoint_timer_query_webgl2 · ${MEASURE_MS / 1000} s per cell · ${BASE}`);
console.log(`${"state".padEnd(6)}${"tier".padEnd(7)}${"viewport".padEnd(16)}${"mean".padStart(7)}${"p95".padStart(7)}${"max".padStart(7)}  ${"n".padStart(3)}${"frames".padStart(6)}`);
for (const vp of VIEWPORTS) {
  const page = await browser.newPage({
    viewport: { width: vp.w, height: vp.h },
    deviceScaleFactor: vp.dpr,
    isMobile: vp.w < 640,
    hasTouch: vp.w < 640,
  });
  for (const id of ids) {
    for (const tier of QUALITY_TIERS) {
      await page.goto(`${BASE}/lab/clouds?${stateQuery(id, tier)}`, { waitUntil: "networkidle" });
      await waitReady(page);
      await page.waitForTimeout(WARMUP_MS);
      const { samples, frames, error } = await measure(page);
      const { mean, p95, max } = stats(samples);
      const target = targetMs(tier, vp);
      const over = target !== null && mean !== null && mean > target;
      const miss = !error && !samples.length ? "EXT_disjoint_timer_query_webgl2 unavailable" : error;
      const ms = (x: number | null) => (x === null ? "n/a".padStart(7) : x.toFixed(2).padStart(7));
      console.log(
        `${id.padEnd(6)}${tier.padEnd(7)}${`${vp.w}×${vp.h} DPR ${vp.dpr}`.padEnd(16)}${ms(mean)}${ms(p95)}${ms(max)}  ${String(samples.length).padStart(3)}${String(frames).padStart(6)}${over ? "  OVER" : ""}${miss ? `  ${miss}` : ""}`,
      );
      rows.push({
        state: id,
        tier,
        viewport: { width: vp.w, height: vp.h, dpr: vp.dpr },
        gpuMeanMs: mean,
        gpuP95Ms: p95,
        gpuMaxMs: max,
        gpuSamples: samples.length,
        frames,
        targetMs: target,
        overTarget: over,
        error: miss,
      });
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
      targets: GPU_TARGETS,
      rows,
    },
    null,
    2,
  )}\n`,
);
console.log(`\ntargets: high ≤ ${GPU_TARGETS.high.ms} ms at ${GPU_TARGETS.high.width}×${GPU_TARGETS.high.height} DPR ${GPU_TARGETS.high.dpr} · low ≤ ${GPU_TARGETS.low.ms} ms at ${GPU_TARGETS.low.width}×${GPU_TARGETS.low.height} DPR ${GPU_TARGETS.low.dpr}`);
console.log(file);
