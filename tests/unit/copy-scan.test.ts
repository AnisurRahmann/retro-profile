import fs from "node:fs";
import { describe, expect, it } from "vitest";

/** No copy outside src/content.ts: string literals / JSX text over 40 chars in components and app. */
const CLASSY = /^[a-z0-9\-:[\]/.()_%#,>&!*@=~+'"\s]+$/;

function files(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = `${dir}/${e.name}`;
    return e.isDirectory() ? files(p) : /\.tsx?$/.test(e.name) && !/\.test\./.test(e.name) ? [p] : [];
  });
}

function looksLikeCopy(s: string): boolean {
  const t = s.trim();
  if (t.length <= 40) return false;
  if (CLASSY.test(t) && !/[A-Z]/.test(t)) return false; // class names
  if (/^[\w\-./:?=&%{}$]+$/.test(t)) return false; // urls, paths
  if (/^(M|m)[\d\s.,\-a-zA-Z]+$/.test(t) && /\d/.test(t)) return false; // svg paths
  return /[A-Za-z]{3,}\s+[A-Za-z]{2,}\s+[A-Za-z]{2,}/.test(t);
}

describe("copy lives in src/content.ts", () => {
  it("has no long string literals in src/components or src/app", () => {
    const offenders: string[] = [];
    for (const f of [...files("src/components"), ...files("src/app")]) {
      const src = fs.readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
      const literals = [...src.matchAll(/"([^"\n]*)"|'([^'\n]*)'|`([^`]*)`|>([^<>{}]+)</g)].map(
        (m) => m[1] ?? m[2] ?? m[3] ?? m[4] ?? "",
      );
      for (const l of literals) if (looksLikeCopy(l)) offenders.push(`${f}: ${l.trim().slice(0, 60)}`);
    }
    expect(offenders).toEqual([]);
  });
});

describe("copy scanner self-check", () => {
  it("flags prose and ignores class names", () => {
    expect(looksLikeCopy("This is a long sentence that should be flagged as copy")).toBe(true);
    expect(looksLikeCopy("flex items-center gap-2 text-sm text-graphite hover:text-text")).toBe(false);
  });
});
