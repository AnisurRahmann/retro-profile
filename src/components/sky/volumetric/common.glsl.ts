/**
 * Shared GLSL (owner T0; T8 may tune displayColor's constants). Contract: GLSL_CONTRACT.common in types.ts.
 * Every CLOUD_UNIFORMS name and the GEOMETRY #defines (VOL_*) are declared before this by assemble.ts.
 */
export const commonGlsl = /* glsl */ `
// Transmittance-weighted mean distance (km) of the clouds on this ray; written by marchClouds.
float gCloudDist = 0.0;

vec3 viewRay(vec2 uv) {
  vec2 ndc = uv * 2.0 - 1.0;
  return normalize(uCamForward + ndc.x * uTanHalfFov * uAspect * uCamRight + ndc.y * uTanHalfFov * uCamUp);
}

float blueNoise(vec2 fragCoord) {
  float b = texelFetch(uBlue, ivec2(mod(fragCoord, 64.0)), 0).r;
  return fract(b + float(uFrame % 64) * 0.61803398875);
}

vec2 raySphere(vec3 ro, vec3 rd, float r) {
  vec3 oc = ro - vec3(0.0, -VOL_EARTH_R, 0.0);
  float b = dot(oc, rd);
  float c = dot(oc, oc) - r * r;
  float h = b * b - c;
  if (h < 0.0) return vec2(-1.0);
  h = sqrt(h);
  return vec2(-b - h, -b + h);
}

float remap(float v, float lo, float hi, float newLo, float newHi) {
  return newLo + (v - lo) / (hi - lo) * (newHi - newLo);
}

vec3 displayColor(vec3 linear) {
  vec3 c = linear * uExposure;
  // Soft shoulder above 0.8 so the sun's core saturates without a hard clip.
  vec3 over = max(c - 0.8, 0.0);
  c = min(c, 0.8) + 0.2 * (1.0 - exp(-over / 0.2));
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));
}
`;
