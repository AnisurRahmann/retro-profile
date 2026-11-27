/**
 * Cloud density (owner T4): per-type height gradient, SHAPE remapped by it, DETAIL erosion, × coverage.
 * Contract: GLSL_CONTRACT.density. After the Nubis / HZD density model (Schneider 2015, 2017): the shape's
 * Perlin-Worley is remapped by its Worley fbm, multiplied by the type's height gradient, remapped by coverage, then
 * eroded by the detail fbm (wispy at the base, billowy at the top).
 *
 * VOL_TEMP_NOISE (temporary, M1 removes it once T1 and T2 are merged): T0's placeholder textures are flat, so an
 * in-shader 3D value noise stands in for SHAPE and DETAIL, and a 2D one breaks the uniform placeholder coverage into
 * patches with T2's formula. Remove: the `#define VOL_TEMP_NOISE` line, the block between `// ── temp noise` and
 * `// ── /temp noise`, and the three `#ifdef VOL_TEMP_NOISE` blocks (keep each `#else` branch).
 */
export const densityGlsl = /* glsl */ `
#define VOL_TEMP_NOISE 1

// One SHAPE tile spans this many km (Worley cells of ~2.5 km at its lowest frequency); one DETAIL tile, this many.
const float DENSITY_SHAPE_KM = 10.0;
const float DENSITY_DETAIL_KM = 0.6;
// Extinction (per km) of a fully dense sample.
const float DENSITY_SCALE = 80.0;
// How far the detail fbm eats into the shape's edges: cumulus and cumulonimbus, and a stratus deck (gentler, so an
// overcast deck stays continuous).
const float DENSITY_EROSION = 0.6;
const float DENSITY_EROSION_STRATUS = 0.22;
// The detail field drifts and boils at this rate (km/s, apparent), on top of the wind.
const float DENSITY_DETAIL_DRIFT = 0.012;
// Tops lean downwind: the shape is sheared by this many km per km of height.
const float DENSITY_SHEAR = 0.35;

// ── temp noise
float densityTempHash(vec3 c) {
  c = mod(c, 64.0);
  return fract(sin(dot(c, vec3(127.1, 311.7, 74.7))) * 43758.5453);
}

float densityTempValue(vec3 x) {
  vec3 i = floor(x);
  vec3 f = x - i;
  f = f * f * (3.0 - 2.0 * f);
  float a = mix(densityTempHash(i), densityTempHash(i + vec3(1, 0, 0)), f.x);
  float b = mix(densityTempHash(i + vec3(0, 1, 0)), densityTempHash(i + vec3(1, 1, 0)), f.x);
  float c = mix(densityTempHash(i + vec3(0, 0, 1)), densityTempHash(i + vec3(1, 0, 1)), f.x);
  float d = mix(densityTempHash(i + vec3(0, 1, 1)), densityTempHash(i + vec3(1, 1, 1)), f.x);
  return mix(mix(a, b, f.y), mix(c, d, f.y), f.z);
}

// Billowy (|2n − 1| inverted), like an inverted Worley's rounded cells.
float densityTempBillow(vec3 x) {
  return 1.0 - abs(densityTempValue(x) * 2.0 - 1.0);
}

// SHAPE's channels as T1 builds them: R Perlin-Worley (sparse, cell-shaped), GBA a rising-frequency billow fbm.
vec4 densityTempShape(vec3 uvw) {
  float a = densityTempBillow(uvw * 4.0);
  float b = densityTempBillow(uvw * 8.0 + 3.1);
  float c = densityTempValue(uvw * 16.0 + 7.3);
  float fbm = a * 0.625 + b * 0.25 + c * 0.125;
  float perlin = densityTempValue(uvw * 4.0 + 11.7) * 0.6 + b * 0.4;
  float r = clamp(remap(perlin, 1.0 - a, 1.0, 0.0, 1.0), 0.0, 1.0);
  return vec4(r, fbm, fbm, fbm);
}

vec3 densityTempDetail(vec3 uvw) {
  float a = densityTempBillow(uvw * 2.0);
  float b = densityTempBillow(uvw * 4.0 + 5.3);
  return vec3(a, b, a * b);
}

// T2's coverage formula, cov = clamp(n·1.4 − (1 − coverage)·1.1, 0, 1), over a patchy 2D field (cumulus) or a
// near-uniform one (stratus, level 0.75 ± a little).
float densityTempCoverage(vec2 uv, float coverage, float type) {
  float env = densityTempValue(vec3(uv * 4.0, 0.0));
  float patches = densityTempValue(vec3(uv * 11.0, 4.0));
  float n = clamp((env * 0.45 + patches * 0.55 - 0.5) * 2.2 + 0.5, 0.0, 1.0);
  n = 1.0 - 0.9 * pow(1.0 - n, 2.15);
  n = mix(0.75 + (env - 0.5) * 0.25, n, smoothstep(0.1, 0.4, type));
  return clamp(n * 1.4 - (1.0 - coverage) * 1.1, 0.0, 1.0);
}
// ── /temp noise

// Altitude (km above the ground) of p.
float densityAltitude(vec3 p) {
  return length(p - vec3(0.0, -VOL_EARTH_R, 0.0)) - VOL_EARTH_R;
}

// The cloud top (km) for a weather-map type: CLOUD_TOP for stratus and cumulus, rising to CB_TOP for cumulonimbus.
float densityTop(float type) {
  return mix(VOL_CLOUD_TOP, VOL_CB_TOP, smoothstep(0.55, 1.0, type));
}

float densityHeightFraction(float alt, float type) {
  return clamp((alt - VOL_CLOUD_BASE) / (densityTop(type) - VOL_CLOUD_BASE), 0.0, 1.0);
}

vec3 weatherAt(vec3 p) {
  vec2 uv = p.xz / VOL_WEATHER_MAP_KM - uWeatherOffset;
  vec3 w = texture(uWeather, uv).rgb;
#ifdef VOL_TEMP_NOISE
  w.r = densityTempCoverage(uv, w.r, w.g);
#endif
  return w;
}

float heightFraction(vec3 p) {
  return densityHeightFraction(densityAltitude(p), weatherAt(p).g);
}

// The type's vertical profile at height fraction h: stratus a thin flat layer, cumulus a flat base and a rounded top,
// cumulonimbus a tall column to the top of its (taller) shell.
float densityGradient(float h, float type) {
  float stratus = smoothstep(0.0, 0.05, h) * (1.0 - smoothstep(0.14, 0.34, h));
  float cumulus = smoothstep(0.0, 0.06, h) * (1.0 - smoothstep(0.32, 0.92, h));
  float cb = smoothstep(0.0, 0.03, h) * (1.0 - smoothstep(0.86, 1.0, h));
  float a = smoothstep(0.0, 0.5, type);
  float b = smoothstep(0.5, 1.0, type);
  return mix(mix(stratus, cumulus, a), cb, b);
}

// The SHAPE / DETAIL lookups (world km → texture uvw, with the wind already applied by the caller).
vec4 densityShape(vec3 q) {
#ifdef VOL_TEMP_NOISE
  return densityTempShape(q / DENSITY_SHAPE_KM);
#else
  return textureLod(uShape, q / DENSITY_SHAPE_KM, 0.0);
#endif
}

vec3 densityDetail(vec3 q) {
#ifdef VOL_TEMP_NOISE
  return densityTempDetail(q / DENSITY_DETAIL_KM);
#else
  return textureLod(uDetail, q / DENSITY_DETAIL_KM, 0.0).rgb;
#endif
}

float cloudDensity(vec3 p, float lod) {
  float alt = densityAltitude(p);
  if (alt < VOL_CLOUD_BASE || alt > VOL_CB_TOP) return 0.0;
  vec3 w = weatherAt(p);
  float h = densityHeightFraction(alt, w.g);
  if (alt > densityTop(w.g)) return 0.0;

  // Coverage; a cumulonimbus spreads into an anvil near its top (coverage raised toward 1 there).
  float anvil = smoothstep(0.75, 1.0, w.g) * smoothstep(0.62, 0.85, h);
  float cov = pow(w.r, mix(1.0, 0.25, anvil));
  if (cov < 0.01) return 0.0;

  // The field moves with the weather map (uv = xz / K − offset, so world features move by +offset·K), and the
  // tops lean downwind.
  vec2 wind = uWeatherOffset * VOL_WEATHER_MAP_KM;
  vec2 windDir = length(uWindVel) > 1e-8 ? normalize(uWindVel) : vec2(0.0);
  vec3 q = vec3(p.x - wind.x, alt, p.z - wind.y) - vec3(windDir.x, 0.0, windDir.y) * (alt - VOL_CLOUD_BASE) * DENSITY_SHEAR;

  vec4 s = densityShape(q);
  float lowFbm = s.g * 0.625 + s.b * 0.25 + s.a * 0.125;
  float base = remap(s.r, -(1.0 - lowFbm), 1.0, 0.0, 1.0);
  base *= densityGradient(h, w.g);
  // Coverage remap: only the shape's peaks above (1 − cov) survive, so a sparse sky is small rounded cells.
  base = clamp(remap(base, 1.0 - cov, 1.0, 0.0, 1.0), 0.0, 1.0) * cov;
  if (base <= 0.0) return 0.0;

  float d = base;
  if (lod < 1.0) {
    vec3 drift = vec3(windDir.x, 0.4, windDir.y) * uTime * DENSITY_DETAIL_DRIFT;
    vec3 dn = densityDetail(q - drift);
    float hiFbm = dn.r * 0.625 + dn.g * 0.25 + dn.b * 0.125;
    // Wispy (inverted) at the base, billowy at the top.
    float erode = mix(hiFbm, 1.0 - hiFbm, clamp(h * 8.0, 0.0, 1.0));
    float amount = mix(DENSITY_EROSION_STRATUS, DENSITY_EROSION, smoothstep(0.1, 0.5, w.g));
    float eroded = clamp(remap(base, erode * amount, 1.0, 0.0, 1.0), 0.0, 1.0);
    d = mix(eroded, base, lod);
  }
  // Rain clouds are denser (the precipitation hook; lighting darkens their bases).
  return d * DENSITY_SCALE * (1.0 + w.b);
}
`;
