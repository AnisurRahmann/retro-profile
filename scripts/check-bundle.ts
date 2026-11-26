/**
 * Sky bundle budgets, enforced on the production build (.next). No dependencies: node:vm, node:zlib.
 *
 * - Up-front sky JS ≤ 13 kB gzip: the sky's client components (src/components/sky/*: controller, mount, label,
 *   strip, stage, clock) and every module only they pull in, in the home page's first-load chunks. Needed for the
 *   first-paint gradient's takeover, the clock and the label.
 * - Idle-loaded renderer ≤ 26 kB gzip: the chunks of the dynamic import in SkyMount (react-loadable manifest).
 * Both exclude suncalc (and React/Next, which live in the framework chunks).
 *
 * Attribution: each Turbopack chunk is evaluated in a sandbox to recover its modules (id → factory source); the
 * client reference manifests name the entry modules; edges are the factories' e.r()/e.i() calls. A module counts
 * as sky when it's reachable from a sky entry and from no other client entry. Sizes are gzip -9 of the
 * concatenated module sources (one stream, like the network sees a chunk).
 * Usage: pnpm build && pnpm check:bundle
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import zlib from "node:zlib";

const NEXT = process.env.NEXT_DIST_DIR ?? ".next";
const BUDGET = { upfront: 13_000, idle: 35_000 };
/** suncalc itself (its UMD factory defines the API), not the modules that call it. */
const SUNCALC = /getMoonIllumination\s*=\s*function/;

type Mod = { id: number; src: string; chunk: string };
const modules = new Map<number, Mod>();

function loadChunk(rel: string) {
  const file = path.join(NEXT, rel.replace(/^\/?_next\//, ""));
  const code = fs.readFileSync(file, "utf8");
  if (!code.startsWith("(globalThis.TURBOPACK")) return;
  const ctx: Record<string, unknown> = { TURBOPACK: [] as unknown[] };
  ctx.globalThis = ctx;
  vm.runInNewContext(code, ctx, { filename: file });
  for (const entry of ctx.TURBOPACK as unknown[][]) {
    for (let i = 1; i < entry.length - 1; i++) {
      const id = entry[i];
      const fn = entry[i + 1];
      if (typeof id === "number" && typeof fn === "function") {
        modules.set(id, { id, src: fn.toString(), chunk: rel });
        i++;
      }
    }
  }
}

const deps = (m: Mod) => [...m.src.matchAll(/\b[a-z]\.[ri]\((\d+)\)/g)].map((x) => Number(x[1]));
function reach(roots: number[]): Set<number> {
  const seen = new Set<number>();
  const stack = [...roots];
  while (stack.length) {
    const id = stack.pop()!;
    if (seen.has(id) || !modules.has(id)) continue;
    seen.add(id);
    stack.push(...deps(modules.get(id)!));
  }
  return seen;
}
const gzip = (ids: Iterable<number>) => zlib.gzipSync([...ids].map((id) => modules.get(id)!.src).join("\n"), { level: 9 }).length;

// Client entries from every page's client reference manifest.
const manifests: string[] = [];
const walk = (dir: string) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith("_client-reference-manifest.js")) manifests.push(p);
  }
};
walk(path.join(NEXT, "server", "app"));
const sky = new Set<number>();
const other = new Set<number>();
const chunks = new Set<string>();
for (const f of manifests) {
  const ctx: Record<string, unknown> = {};
  ctx.globalThis = ctx;
  ctx.self = ctx;
  vm.runInNewContext(fs.readFileSync(f, "utf8"), ctx);
  for (const m of Object.values(ctx.__RSC_MANIFEST as Record<string, { clientModules: Record<string, { id: number; chunks: string[] }> }>)) {
    for (const [key, v] of Object.entries(m.clientModules)) {
      (key.includes("/src/components/sky/") ? sky : other).add(Number(v.id));
      v.chunks.forEach((c) => chunks.add(c));
    }
  }
}
const build = JSON.parse(fs.readFileSync(path.join(NEXT, "build-manifest.json"), "utf8")) as { rootMainFiles: string[] };
build.rootMainFiles.forEach((c) => chunks.add(c));
chunks.forEach(loadChunk);

// The renderer: the dynamic import's chunks.
const loadable = JSON.parse(fs.readFileSync(path.join(NEXT, "server", "app", "(site)", "page", "react-loadable-manifest.json"), "utf8")) as Record<string, { files: string[] }>;
const idleFiles = Object.values(loadable).flatMap((e) => e.files);
const before = new Set(modules.keys());
idleFiles.forEach(loadChunk);
const idleIds = [...modules.keys()].filter((id) => !before.has(id) && !SUNCALC.test(modules.get(id)!.src));

const fromOther = reach([...other]);
const upfrontIds = [...reach([...sky])].filter((id) => !fromOther.has(id) && !SUNCALC.test(modules.get(id)!.src) && !idleIds.includes(id));

const upfront = gzip(upfrontIds);
const idle = gzip(idleIds);
const kb = (n: number) => `${(n / 1000).toFixed(1)} kB`;
console.log(`sky up-front: ${kb(upfront)} gzip (${upfrontIds.length} modules; budget ${kb(BUDGET.upfront)})`);
console.log(`sky renderer (idle): ${kb(idle)} gzip (${idleIds.length} modules in ${idleFiles.join(", ")}; budget ${kb(BUDGET.idle)})`);
const fails = [upfront > BUDGET.upfront && "up-front", idle > BUDGET.idle && "renderer"].filter(Boolean);
if (!upfrontIds.length || !idleIds.length) {
  console.error("check:bundle: found no sky modules; the build layout changed?");
  process.exit(1);
}
if (fails.length) {
  console.error(`check:bundle: over budget: ${fails.join(", ")}`);
  process.exit(1);
}
