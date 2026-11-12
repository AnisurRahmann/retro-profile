import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * All copy lives in src/content.ts. This test reads every component and route
 * file and fails on anything that looks like a sentence: three or more plain
 * words in a row inside a string literal or as JSX text.
 */
const ROOTS = ["src/components", "src/app"];
const PROSE = /[A-Za-z][A-Za-z']+(?:[ ]+[A-Za-z][A-Za-z']+){2,}/;

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return files(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}

/** Attribute values that are structural, not copy. */
const STRUCTURAL =
  /(?:className|class|d|points|viewBox|style|rel|transform|content)\s*[=:]\s*\{?\s*$/;

function findCopy(source: string): string[] {
  const code = stripComments(source);
  const hits: string[] = [];
  const literal = /(["'`])((?:\\.|(?!\1)[^\\\n])*)\1/g;
  for (let m = literal.exec(code); m; m = literal.exec(code)) {
    const value = m[2] ?? "";
    if (!PROSE.test(value)) continue;
    const before = code.slice(Math.max(0, m.index - 40), m.index);
    if (STRUCTURAL.test(before)) continue;
    if (/^(use client|use server)$/.test(value)) continue;
    hits.push(value);
  }
  const jsxText = />([^<>{}=;()]+)</g;
  for (let m = jsxText.exec(code); m; m = jsxText.exec(code)) {
    const value = (m[1] ?? "").trim();
    if (PROSE.test(value)) hits.push(value);
  }
  return hits;
}

describe("copy lives in src/content.ts", () => {
  const all = ROOTS.flatMap(files);

  it("finds the component files", () => {
    expect(all.length).toBeGreaterThan(10);
  });

  it.each(all)("%s has no hardcoded copy", (file) => {
    expect(findCopy(readFileSync(file, "utf8"))).toEqual([]);
  });

  it("detects a planted sentence", () => {
    expect(findCopy(`const a = <p>This is hardcoded copy</p>;`)).toHaveLength(1);
    expect(findCopy(`const a = "Another planted sentence here";`)).toHaveLength(1);
    expect(findCopy(`<div className="flex grid block" />`)).toHaveLength(0);
  });
});
