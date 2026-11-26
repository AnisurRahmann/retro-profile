/**
 * Cloud lighting (owner T4): light march, Beer–Lambert + powder, dual-lobe HG, ambient, aerial perspective.
 * Contract: GLSL_CONTRACT.lighting. PLACEHOLDER (T0): isotropic phase, no light, no aerial perspective.
 */
export const lightingGlsl = /* glsl */ `
float cloudPhase(float cosTheta) {
  return 0.25 / 3.14159265;
}

vec3 cloudRadiance(vec3 p, vec3 rd, float density) {
  return vec3(0.0);
}

vec4 applyAerial(vec4 cloud, vec3 rd, float dist) {
  return cloud;
}
`;
