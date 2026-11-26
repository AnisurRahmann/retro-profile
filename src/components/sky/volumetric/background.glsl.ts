/**
 * The background behind the clouds (owner T5): the gradient, stars, moon and sun. Contract: GLSL_CONTRACT.background.
 * PLACEHOLDER (T0): the gradient and a plain sun disc only. T5 ports bodies.ts / particles.ts here.
 */
export const backgroundGlsl = /* glsl */ `
vec3 skyGradient(vec3 rd) {
  float e = asin(clamp(rd.y, -1.0, 1.0)) * 57.29578;
  if (e < 0.0) return uGround;
  vec3 low = mix(uHorizonCol, uMid, smoothstep(0.0, 18.0, e));
  return mix(low, uZenith, smoothstep(12.0, 75.0, e));
}

vec3 background(vec3 rd) {
  vec3 c = skyGradient(rd);
  float d = dot(rd, uSunDir);
  // Placeholder disc (0.53° wide), so the sun's place is visible until T5.
  c += uSunColor * uSunVisible * 4.0 * smoothstep(0.99996, 0.99998, d) * step(0.0, rd.y);
  return c;
}
`;
