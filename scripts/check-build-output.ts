/**
 * Fails if any rendered output (HTML, RSC payloads, metadata routes) contains an unresolved "[[".
 * Runs as postbuild and from tests/build. Client JS chunks are skipped: minified code contains "[[" legitimately,
 * and content.ts never reaches the client (components get resolved props from src/site.ts).
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.join(process.cwd(), ".next/server/app");
const RENDERED = /\.(html|rsc|body|meta|xml|txt|json)$/;
/** A placeholder is [[ + prose + ]]. RSC payloads contain JSON "[[" arrays, which start with a quote or bracket. */
export const PLACEHOLDER_IN_OUTPUT = /\[\[[A-Za-z][^\]"[\n]{0,300}\]\]/;

export function findPlaceholders(dir = ROOT): string[] {
  if (!fs.existsSync(dir)) throw new Error(`${dir} missing: run next build first`);
  const hits: string[] = [];
  const walk = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (RENDERED.test(e.name) && PLACEHOLDER_IN_OUTPUT.test(fs.readFileSync(p, "utf8"))) hits.push(path.relative(process.cwd(), p));
    }
  };
  walk(dir);
  return hits;
}

if (process.argv[1]?.endsWith("check-build-output.ts")) {
  const hits = findPlaceholders();
  if (hits.length) {
    console.error(`Unresolved [[placeholders]] in rendered output:\n${hits.join("\n")}`);
    process.exit(1);
  }
  console.log("build output: no [[placeholders]]");
}
