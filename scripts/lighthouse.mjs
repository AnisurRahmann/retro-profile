// Lighthouse against the exported site. Usage: node scripts/lighthouse.mjs  (needs `pnpm build` first, Chrome installed)
import { execFileSync, spawn } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";

const PORT = 4174;
const pages = [
  ["home", "/"],
  ["gym", "/gym/"],
];
mkdirSync(".lighthouse", { recursive: true });
const server = spawn("node", ["scripts/serve-out.mjs", String(PORT)], { stdio: "ignore" });
await new Promise((resolve) => setTimeout(resolve, 800));
try {
  for (const [name, path] of pages) {
    const out = `.lighthouse/${name}.json`;
    execFileSync(
      "npx",
      ["--yes", "lighthouse", `http://localhost:${PORT}${path}`, "--quiet", "--chrome-flags=--headless=new", "--only-categories=performance,accessibility,best-practices,seo", "--output=json", `--output-path=${out}`],
      { stdio: "ignore" },
    );
    const report = JSON.parse(readFileSync(out, "utf8"));
    const scores = Object.entries(report.categories).map(([key, value]) => `${key}=${Math.round(value.score * 100)}`);
    console.log(name, scores.join(" "));
    for (const key of ["first-contentful-paint", "largest-contentful-paint", "total-blocking-time", "cumulative-layout-shift"]) {
      console.log("  ", key, report.audits[key].displayValue);
    }
    for (const [key, audit] of Object.entries(report.audits)) {
      if (audit.score !== null && audit.score < 1 && audit.scoreDisplayMode === "binary") {
        const nodes = (audit.details?.items ?? []).slice(0, 3).map((item) => item.node?.snippet ?? item.url ?? "");
        console.log("   FAIL", key, JSON.stringify(nodes).slice(0, 300));
      }
    }
  }
} finally {
  server.kill();
}
