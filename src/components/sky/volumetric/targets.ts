/**
 * The frame's passes (owner T7): cloud render target, checkerboard reprojection, re-march rate, upsample, composite.
 * Contract: CreatePipeline in types.ts. PLACEHOLDER (T0): one full-resolution pass that marches and composites
 * (clouds over background with transmittance), every frame.
 */
import type { CloudPipeline, CreatePipeline } from "./types";

const SINGLE_PASS = /* glsl */ `
void main() {
  vec3 rd = viewRay(vUv);
  vec4 c = marchClouds(uCamPos, rd);
  outColor = vec4(displayColor(c.rgb + c.a * background(rd)), 1.0);
}
`;

export const createPipeline: CreatePipeline = (gl): CloudPipeline => {
  let w = 1;
  let h = 1;
  return {
    resize(width, height) {
      w = width;
      h = height;
    },
    render(ctx) {
      const p = ctx.program("single", SINGLE_PASS);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, w, h);
      ctx.apply(p, { uResolution: [w, h] });
      ctx.fullscreen();
    },
    dispose() {},
  };
};
