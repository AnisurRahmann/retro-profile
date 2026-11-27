/** The volumetric lab's GLSL modules assemble into one valid-looking program (docs/volumetric/BRIEF.md, owner T0). */
import { describe, expect, it } from "vitest";
import { assembleFragment, GLSL_SOURCES, header } from "@/components/sky/volumetric/assemble";
import { CLOUD_UNIFORMS, GLSL_CONTRACT, GLSL_GLOBALS, GLSL_MODULES, QUALITY_TIERS } from "@/components/sky/volumetric/types";

const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
const TYPES = "float|int|bool|void|vec2|vec3|vec4|ivec2|ivec3|mat2|mat3|mat4";
/** Function definitions (a signature followed by a body), name → count. */
function definitions(src: string): Map<string, number> {
  const m = new Map<string, number>();
  for (const x of strip(src).matchAll(new RegExp(`^\\s*(?:${TYPES})\\s+(\\w+)\\s*\\([^;{]*\\)\\s*\\{`, "gm"))) m.set(x[1]!, (m.get(x[1]!) ?? 0) + 1);
  return m;
}
const uniforms = (src: string) => [...strip(src).matchAll(/^\s*uniform\s+\w+\s+(\w+)\s*;/gm)].map((x) => x[1]!);
const nameOf = (sig: string) => sig.match(/(\w+)\s*\(/)![1]!;
const MAIN = "void main() {\n  vec3 rd = viewRay(vUv);\n  vec4 c = marchClouds(uCamPos, rd);\n  outColor = vec4(displayColor(c.rgb + c.a * background(rd)), 1.0);\n}\n";

describe("GLSL module contract", () => {
  it.each(GLSL_MODULES)("%s defines each of its contract functions exactly once", (mod) => {
    const defs = definitions(GLSL_SOURCES[mod]);
    for (const sig of GLSL_CONTRACT[mod].functions) {
      const name = nameOf(sig);
      expect(defs.get(name), `${mod}: ${sig}`).toBe(1);
      // The signature matches the contract (types and parameter names may differ in spacing only).
      const norm = (s: string) => s.replace(/\s+/g, " ").replace(/\s*([(),])\s*/g, "$1").trim();
      expect(norm(strip(GLSL_SOURCES[mod])), `${mod}: ${sig}`).toContain(norm(sig));
    }
  });

  it("no function is defined in two modules, and helpers carry their module's prefix", () => {
    const seen = new Map<string, string>();
    for (const mod of GLSL_MODULES) {
      const contract = new Set(GLSL_CONTRACT[mod].functions.map(nameOf));
      for (const [name, n] of definitions(GLSL_SOURCES[mod])) {
        expect(seen.get(name), `${name} in ${mod} and ${seen.get(name)}`).toBeUndefined();
        seen.set(name, mod);
        // Overloads of one helper are fine; a second body of a contract function is not.
        if (contract.has(name)) expect(n, name).toBe(1);
        else expect(name.startsWith(mod), `${mod} helper ${name} needs the "${mod}" prefix`).toBe(true);
      }
    }
  });

  it("modules never declare a CLOUD_UNIFORMS name, and no uniform is declared twice", () => {
    for (const tier of QUALITY_TIERS) {
      const all = uniforms(assembleFragment(MAIN, tier));
      expect(all.length).toBe(new Set(all).size);
      expect(uniforms(header(tier)).sort()).toEqual(Object.keys(CLOUD_UNIFORMS).sort());
    }
    for (const mod of GLSL_MODULES) for (const u of uniforms(GLSL_SOURCES[mod])) expect(u in CLOUD_UNIFORMS, `${mod} redeclares ${u}`).toBe(false);
  });

  it.each(GLSL_MODULES)("%s has balanced braces and parentheses and no #version or precision of its own", (mod) => {
    const s = strip(GLSL_SOURCES[mod]);
    const count = (c: string) => s.split(c).length - 1;
    expect(count("{")).toBe(count("}"));
    expect(count("(")).toBe(count(")"));
    expect(s).not.toMatch(/#version|precision\s+\w+\s+\w+;|\bvoid\s+main\s*\(/);
  });

  it("globals are declared once, by their module", () => {
    const src = strip(assembleFragment(MAIN, "high"));
    for (const [g, mod] of Object.entries(GLSL_GLOBALS)) {
      expect(src.match(new RegExp(`^\\s*float\\s+${g}\\b`, "gm"))?.length, g).toBe(1);
      expect(strip(GLSL_SOURCES[mod])).toMatch(new RegExp(`^\\s*float\\s+${g}\\b`, "m"));
    }
  });

  it.each(QUALITY_TIERS)("assembles for the %s tier: one #version first, one main, every VOL_ define used is defined", (tier) => {
    const src = assembleFragment(MAIN, tier);
    expect(src.startsWith("#version 300 es\n")).toBe(true);
    expect(src.match(/#version/g)?.length).toBe(1);
    expect(strip(src).match(/\bvoid\s+main\s*\(/g)?.length).toBe(1);
    const defined = new Set([...src.matchAll(/#define\s+(VOL_\w+)/g)].map((x) => x[1]));
    for (const used of strip(src).matchAll(/\b(VOL_\w+)\b/g)) expect(defined.has(used[1]!), used[1]).toBe(true);
    expect(src).toContain(`#define VOL_TIER_${tier.toUpperCase()} 1`);
  });

  it("calls only functions that are defined earlier or are GLSL built-ins", () => {
    const src = strip(assembleFragment(MAIN, "high"));
    const defined = new Set(definitions(src).keys());
    const BUILTINS = new Set(
      ("abs acos all any asin atan ceil clamp cos cross degrees distance dot exp exp2 faceforward floor fract inversesqrt " +
        "length log log2 max min mix mod normalize pow radians reflect refract round sign sin smoothstep sqrt step tan " +
        "texture textureLod texelFetch textureSize float int uint bool vec2 vec3 vec4 ivec2 ivec3 ivec4 mat2 mat3 mat4 " +
        "if for while return main fwidth dFdx dFdy trunc tanh sinh cosh isnan isinf transpose inverse").split(" "),
    );
    const unknown = [...src.matchAll(/\b([a-zA-Z_]\w*)\s*\(/g)].map((x) => x[1]!).filter((n) => !BUILTINS.has(n) && !defined.has(n));
    expect([...new Set(unknown)]).toEqual([]);
  });
});
