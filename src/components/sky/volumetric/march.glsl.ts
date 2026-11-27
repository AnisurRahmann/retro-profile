/**
 * The primary march (owner T4): shell intersections, blue-noise jitter, early exit, distance-scaled steps.
 * Contract: GLSL_CONTRACT.march.
 *
 * Steps are spaced geometrically between the shell's entry and exit (each step a fixed fraction of its distance
 * from the camera), so the screen-space footprint of a step stays roughly constant from the zenith to the horizon.
 * Integration is Hillaire's energy-conserving form: each step adds T · L · (1 − e^(−σ·dt)).
 */
export const marchGlsl = /* glsl */ `
// Closest the first step may start (km), so the geometric spacing is defined when the camera is inside the shell.
const float MARCH_NEAR = 0.2;
// Past this distance (km) steps sample the shape only: 25 → 90 for cumulus; T8: 15 → 50 for a stratus deck, where the
// undersampled DETAIL tile beat into moiré near the horizon (cumulus keep it: without erosion, backlit clouds near a
// low sun turn into thick glowing outlines).
const float MARCH_LOD_NEAR = 25.0;
const float MARCH_LOD_FAR = 90.0;
const float MARCH_LOD_NEAR_STRATUS = 15.0;
const float MARCH_LOD_FAR_STRATUS = 50.0;

// The view ray's span inside the cloud shell (tStart, tEnd); tEnd <= tStart = no clouds on this ray.
vec2 marchSpan(vec3 ro, vec3 rd, float top) {
  float alt = length(ro - vec3(0.0, -VOL_EARTH_R, 0.0)) - VOL_EARTH_R;
  vec2 ground = raySphere(ro, rd, VOL_EARTH_R);
  vec2 inner = raySphere(ro, rd, VOL_EARTH_R + VOL_CLOUD_BASE);
  vec2 outer = raySphere(ro, rd, VOL_EARTH_R + top);
  vec2 span = vec2(0.0, -1.0);
  if (alt < VOL_CLOUD_BASE) {
    // Below the base (the lab's camera): from the base up to the top, unless the ground is in the way.
    if (ground.x > 0.0) return span;
    span = vec2(inner.y, outer.y);
  } else if (alt < top) {
    // Inside the layer: from here to the base (looking down) or out through the top.
    span = vec2(0.0, inner.x > 0.0 ? inner.x : outer.y);
  } else {
    if (outer.y < 0.0) return span;
    span = vec2(max(outer.x, 0.0), inner.x > 0.0 ? inner.x : outer.y);
  }
  span.x = max(span.x, 0.0);
  span.y = min(span.y, span.x + VOL_MAX_MARCH);
  return span;
}

// The in-shader debug views (SHADER_DEBUG_VIEWS; uDebug = index + 1). rgb is shown on its own (transmittance 0).
vec4 marchDebug(vec3 ro, vec3 rd, vec2 span, vec3 col, float tr, float tau, float light) {
  vec3 p = ro + rd * span.x;
  if (uDebug == 1) return vec4(span.y > span.x ? weatherAt(p) : vec3(0.0), 0.0);
  if (uDebug == 2) return vec4(vec3(1.0 - exp(-tau * 0.25)), 0.0);
  if (uDebug == 3) return vec4(vec3(tr), 0.0);
  if (uDebug == 4) return vec4(vec3(light), 0.0);
  return vec4(vec3(gCloudDist / 120.0), 0.0);
}

vec4 marchClouds(vec3 ro, vec3 rd) {
  gCloudDist = 0.0;
  float top = uCloudType > 0.75 ? VOL_CB_TOP : VOL_CLOUD_TOP;
  vec2 span = marchSpan(ro, rd, top);
  vec3 col = vec3(0.0);
  float tr = 1.0;
  float tau = 0.0;
  float light = 0.0;
  float wSum = 0.0;

  if (span.y > span.x) {
    float t0 = max(span.x, MARCH_NEAR);
    float t1 = max(span.y, t0 + 1e-3);
    float ratio = t1 / t0;
    float lnr = log(ratio);
    float n = float(VOL_STEPS);
    float jitter = blueNoise(gl_FragCoord.xy);
    float stratus = 1.0 - smoothstep(0.0, 0.5, uCloudType);
    float lodNear = mix(MARCH_LOD_NEAR, MARCH_LOD_NEAR_STRATUS, stratus);
    float lodFar = mix(MARCH_LOD_FAR, MARCH_LOD_FAR_STRATUS, stratus);
    for (int i = 0; i < VOL_STEPS; i++) {
      float x = (float(i) + jitter) / n;
      float t = t0 * exp(lnr * x);
      float dt = t * lnr / n;
      vec3 p = ro + rd * t;
      float sigma = cloudDensity(p, smoothstep(lodNear, lodFar, t));
      if (sigma <= 0.0) continue;
      float a = exp(-sigma * dt);
      vec3 L = cloudRadiance(p, rd, sigma);
      float w = tr * (1.0 - a);
      col += L * w;
      gCloudDist += t * w;
      wSum += w;
      light += dot(L, vec3(0.2126, 0.7152, 0.0722)) * w;
      tau += sigma * dt;
      tr *= a;
      if (tr < VOL_MIN_TRANSMITTANCE) break;
    }
    gCloudDist = wSum > 0.0 ? gCloudDist / wSum : 0.0;
    light = wSum > 0.0 ? light / wSum : 0.0;
  }

  if (uDebug > 0) return marchDebug(ro, rd, span, col, tr, tau, light);
  return applyAerial(vec4(col, tr), rd, gCloudDist);
}
`;
