/**
 * The primary march (owner T4): shell intersections, blue-noise jitter, early exit, distance-scaled steps.
 * Contract: GLSL_CONTRACT.march. PLACEHOLDER (T0): nothing hit (transmittance 1).
 */
export const marchGlsl = /* glsl */ `
vec4 marchClouds(vec3 ro, vec3 rd) {
  gCloudDist = 0.0;
  return vec4(0.0, 0.0, 0.0, 1.0);
}
`;
