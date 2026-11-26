/**
 * Cloud density (owner T4): per-type height gradient, SHAPE remapped by it, DETAIL erosion, × coverage.
 * Contract: GLSL_CONTRACT.density. PLACEHOLDER (T0): no clouds (density 0).
 */
export const densityGlsl = /* glsl */ `
vec3 weatherAt(vec3 p) {
  return texture(uWeather, p.xz / VOL_WEATHER_MAP_KM - uWeatherOffset).rgb;
}

float heightFraction(vec3 p) {
  float h = length(p - vec3(0.0, -VOL_EARTH_R, 0.0)) - VOL_EARTH_R;
  return clamp((h - VOL_CLOUD_BASE) / (VOL_CLOUD_TOP - VOL_CLOUD_BASE), 0.0, 1.0);
}

float cloudDensity(vec3 p, float lod) {
  return 0.0;
}
`;
