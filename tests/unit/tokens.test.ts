import fs from "node:fs";
import { describe, expect, it } from "vitest";

const css = fs.readFileSync("src/app/globals.css", "utf8");
const token = (name: string) => {
  const m = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!m) throw new Error(`token --${name} missing`);
  return m[1]!;
};
const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
};
const contrast = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x! + 0.05) / (y! + 0.05);
};

describe("design tokens (WCAG)", () => {
  const backgrounds = ["ink", "surface", "surface-2"];
  it.each(backgrounds)("text and graphite are AA on --%s", (bg) => {
    expect(contrast(token("text"), token(bg))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token("graphite"), token(bg))).toBeGreaterThanOrEqual(4.5);
  });
  it.each(backgrounds)("signal is ≥ 3:1 on --%s", (bg) => {
    expect(contrast(token("signal"), token(bg))).toBeGreaterThanOrEqual(3);
  });
  it.each(["slate", "teal", "plum", "olive", "rust", "steel"])("tile %s carries an AA monogram and stays muted", (t) => {
    const tile = token(`tile-${t}`);
    expect(contrast(token("text"), tile)).toBeGreaterThanOrEqual(4.5);
    expect(lum(tile)).toBeLessThan(lum(token("graphite")));
  });
  it("keeps the hex mirror in src/lib/brand.ts in sync with the CSS tokens", async () => {
    const { brand } = await import("@/lib/brand");
    const map: Record<string, string> = { ink: "ink", surface: "surface", surface2: "surface-2", hairline: "hairline", text: "text", graphite: "graphite", signal: "signal" };
    for (const [k, v] of Object.entries(brand)) expect(v.toLowerCase(), k).toBe(token(map[k]!).toLowerCase());
    expect(fs.readFileSync("src/app/icon.svg", "utf8")).toContain(token("ink"));
  });
  it("has no hardcoded hex colours outside globals.css", () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = `${dir}/${e.name}`;
        if (e.isDirectory()) walk(p);
        else if (/\.(tsx?|css)$/.test(e.name) && !p.endsWith("globals.css") && !p.includes("/og/") && !p.includes("opengraph") && !p.endsWith("brand.ts")) {
          const src = fs.readFileSync(p, "utf8");
          if (/#[0-9a-fA-F]{6}\b/.test(src)) offenders.push(p);
        }
      }
    };
    walk("src");
    expect(offenders).toEqual([]);
  });
});
