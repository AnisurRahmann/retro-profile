/**
 * Builds a fragment shader from the GLSL modules (owner T0). Order and rules: GLSL_MODULES / GLSL_CONTRACT in types.ts.
 * Pure (no WebGL), so tests/unit/vol-assembly.test.ts can check the assembly without a GPU.
 */
import { backgroundGlsl } from "./background.glsl";
import { commonGlsl } from "./common.glsl";
import { densityGlsl } from "./density.glsl";
import { lightingGlsl } from "./lighting.glsl";
import { marchGlsl } from "./march.glsl";
import { reprojectGlsl } from "./reproject.glsl";
import { CLOUD_UNIFORMS, GEOMETRY, GLSL_MODULES, TIERS, type GlslModuleName, type QualityTier } from "./types";

export const GLSL_SOURCES: Record<GlslModuleName, string> = {
  common: commonGlsl,
  background: backgroundGlsl,
  density: densityGlsl,
  lighting: lightingGlsl,
  march: marchGlsl,
  reproject: reprojectGlsl,
};

/** The full-screen triangle; vUv in [0, 1]² (y up). */
export const VERTEX_SHADER = `#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
`;

const f = (n: number) => (Number.isInteger(n) ? `${n}.0` : String(n));

/** #version, precision, the tier and GEOMETRY #defines, and every CLOUD_UNIFORMS declaration. */
export function header(tier: QualityTier): string {
  const t = TIERS[tier];
  const defines = [
    `#define VOL_TIER_${tier.toUpperCase()} 1`,
    `#define VOL_STEPS ${t.steps}`,
    `#define VOL_LIGHT_STEPS ${t.lightSteps}`,
    `#define VOL_SHAPE_SIZE ${f(t.shapeSize)}`,
    `#define VOL_DETAIL_SIZE ${f(t.detailSize)}`,
    ...Object.entries(GEOMETRY).map(([k, v]) => `#define VOL_${k} ${f(v)}`),
  ];
  const uniforms = Object.entries(CLOUD_UNIFORMS).map(([name, type]) => `uniform ${type} ${name};`);
  return [
    "#version 300 es",
    "precision highp float;",
    "precision highp int;",
    "precision highp sampler3D;",
    ...defines,
    "in vec2 vUv;",
    "out vec4 outColor;",
    ...uniforms,
    "",
  ].join("\n");
}

/** header + every module in GLSL_MODULES order + main. */
export function assembleFragment(main: string, tier: QualityTier, sources: Record<GlslModuleName, string> = GLSL_SOURCES): string {
  return [header(tier), ...GLSL_MODULES.map((m) => `// ── ${m}\n${sources[m]}`), "// ── main", main].join("\n");
}
