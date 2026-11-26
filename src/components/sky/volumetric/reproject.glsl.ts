/**
 * Temporal reprojection and the bilateral upsample (owner T7). Contract: GLSL_CONTRACT.reproject.
 * T7's own uniforms are declared here, prefixed uRp (they are not CLOUD_UNIFORMS).
 * PLACEHOLDER (T0): the cloud target sampled directly (the placeholder pipeline doesn't use it yet).
 */
export const reprojectGlsl = /* glsl */ `
uniform sampler2D uRpClouds;

vec4 cloudsAt(vec2 uv) {
  return texture(uRpClouds, uv);
}
`;
