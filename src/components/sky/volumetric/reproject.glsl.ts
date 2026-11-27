/**
 * Temporal reprojection and the bilateral upsample (owner T7). Contract: GLSL_CONTRACT.reproject.
 * T7's own uniforms are declared here, prefixed uRp (they are not CLOUD_UNIFORMS); targets.ts sets them.
 *
 * The passes (targets.ts):
 *   march      one pixel of each 2×2 block of the cloud target (uRpOffset, Bayer order), into a half-size RGBA32F
 *              target: rgb premultiplied radiance, a = floor(distance × REPROJECT_DIST_SCALE) + transmittance
 *              (reprojectPack). The header has a single `out vec4`, so the distance rides in the alpha's integer part.
 *   resolve    the cloud target (RGBA16F, tier scale): the previous one reprojected with the wind, clamped to the
 *              3×3 neighbourhood of fresh samples (anti-ghosting), and blended with the fresh sample at uRpAlpha.
 *   velocity   the cloud field's screen motion (viewport uv per second) on a coarse grid, for the composite's shift.
 *   background / display  full-resolution caches of background(rd) (linear, RGBA16F) and of displayColor of it
 *              (RGBA8), redrawn every few marches (targets.ts BG_EVERY), so the stars still twinkle.
 *   composite  (every frame, full resolution) cloudsAt(uv): the cloud target shifted by the wind since the last
 *              resolve, upsampled with 4 taps weighted by bilinear × transmittance similarity where the transmittance
 *              has an edge. Clear sky (one bilinear tap says transmittance 1) takes the display cache as it is.
 *
 * The camera is static, so the only motion is the cloud field's: a world point P was at P − wind·dt before.
 */
export const reprojectGlsl = /* glsl */ `
// The march target (RGBA32F, packed; texelFetch only).
uniform highp sampler2D uRpMarch;
// The previous cloud target (resolve input).
uniform sampler2D uRpHistory;
// The latest cloud target (composite input).
uniform sampler2D uRpClouds;
// The screen velocity grid (RG16F, uv per animation second).
uniform sampler2D uRpVel;
// The background caches at full resolution: linear (RGBA16F) and displayColor'd (RGBA8).
uniform highp sampler2D uRpBg;
uniform sampler2D uRpDisplay;
// The cloud-target pixel of each 2×2 block marched this time.
uniform ivec2 uRpOffset;
// Animation seconds since the history was resolved (resolve), or since the last resolve (composite).
uniform float uRpDt;
// 0 = no usable history (first frame, resize, new state): take the nearest fresh sample.
uniform float uRpValid;
// Weight of the fresh sample on its own pixel.
uniform float uRpAlpha;

const float REPROJECT_DIST_SCALE = 32.0;
const float REPROJECT_DIST_MAX = 255.0;
const float REPROJECT_T_MAX = 0.9998;
// History further than this (transmittance, or luminance relative to the box) outside the fresh neighbourhood is
// a different cloud: the fresh sample replaces it instead of blending.
const float REPROJECT_REJECT = 0.2;
// Bilateral falloff on the transmittance difference (per unit of transmittance).
const float REPROJECT_SHARPNESS = 4.0;
// Transmittance change per full-resolution pixel above which the upsample is bilateral (an edge).
const float REPROJECT_EDGE = 0.03;
// Transmittance from which a composite pixel is clear sky.
const float REPROJECT_CLEAR = 0.9995;
// Below this transmittance the background doesn't show.
const float REPROJECT_OPAQUE = 0.002;
// The finite difference (s) the velocity grid is measured over.
const float REPROJECT_VEL_DT = 0.25;

vec4 reprojectPack(vec4 cloud, float dist) {
  return vec4(cloud.rgb, floor(clamp(dist, 0.0, REPROJECT_DIST_MAX) * REPROJECT_DIST_SCALE) + clamp(cloud.a, 0.0, REPROJECT_T_MAX));
}

vec4 reprojectUnpack(vec4 m, out float dist) {
  float k = floor(m.a);
  dist = k / REPROJECT_DIST_SCALE;
  float tr = m.a - k;
  return vec4(m.rgb, tr >= REPROJECT_T_MAX - 1e-4 ? 1.0 : tr);
}

// The apparent velocity (km/s) of cloud detail: the weather map's wind, plus density's detail drift (its constant;
// the detail noise moves with both, and an edge is mostly detail). Without the drift the history lags ~20% behind,
// and the 2×2 cadence turns the lag into stripes across the wind on thin cloud.
vec3 reprojectWorldVelocity() {
  vec2 dir = length(uWindVel) > 1e-8 ? normalize(uWindVel) : vec2(0.0);
  return vec3(uWindVel.x, 0.0, uWindVel.y) * VOL_WEATHER_MAP_KM + vec3(dir.x, 0.4, dir.y) * DENSITY_DETAIL_DRIFT;
}

// Where the cloud now at distance d along rd was dt seconds ago, in viewport uv (x < 0 when behind the camera).
vec2 reprojectPrevUv(vec3 rd, float d, float dt) {
  vec3 p = uCamPos + rd * d - reprojectWorldVelocity() * dt;
  vec3 v = p - uCamPos;
  float z = dot(v, uCamForward);
  if (z <= 1e-4) return vec2(-1.0);
  return vec2(dot(v, uCamRight) / (z * uTanHalfFov * uAspect), dot(v, uCamUp) / (z * uTanHalfFov)) * 0.5 + 0.5;
}

// A distance for rays without a cloud sample: the shell's lower part.
float reprojectShellDist(vec3 rd) {
  float r = VOL_EARTH_R + VOL_CLOUD_BASE + 0.4 * (VOL_CLOUD_TOP - VOL_CLOUD_BASE);
  return min(max(raySphere(uCamPos, rd, r).y, 0.0), REPROJECT_DIST_MAX);
}

bool reprojectInside(vec2 uv) {
  return uv.x >= 0.0 && uv.y >= 0.0 && uv.x <= 1.0 && uv.y <= 1.0;
}

float reprojectLuma(vec3 c) {
  return dot(c, vec3(0.2126, 0.7152, 0.0722));
}

// The resolve pass for cloud-target pixel q.
vec4 reprojectResolve(ivec2 q) {
  ivec2 msize = textureSize(uRpMarch, 0);
  ivec2 b = q / 2;
  vec4 lo = vec4(1e9);
  vec4 hi = vec4(-1e9);
  vec4 own = vec4(0.0, 0.0, 0.0, 1.0);
  float ownD = 0.0;
  float maxD = 0.0;
  for (int dy = -1; dy <= 1; dy++) {
    for (int dx = -1; dx <= 1; dx++) {
      float d;
      vec4 s = reprojectUnpack(texelFetch(uRpMarch, clamp(b + ivec2(dx, dy), ivec2(0), msize - 1), 0), d);
      lo = min(lo, s);
      hi = max(hi, s);
      maxD = max(maxD, d);
      if (dx == 0 && dy == 0) {
        own = s;
        ownD = d;
      }
    }
  }
  if (uRpValid < 0.5) return own;

  vec2 res = vec2(textureSize(uRpHistory, 0));
  vec3 rd = viewRay((vec2(q) + 0.5) / res);
  float d = ownD > 0.0 ? ownD : (maxD > 0.0 ? maxD : reprojectShellDist(rd));
  vec2 prev = uRpDt > 0.0 ? reprojectPrevUv(rd, d, uRpDt) : (vec2(q) + 0.5) / res;
  bool fresh = q == b * 2 + uRpOffset;
  if (!reprojectInside(prev)) return own;

  vec4 h = texture(uRpHistory, prev);
  vec4 hc = clamp(h, lo, hi);
  if (!fresh) return hc;
  float off = max(abs(h.a - hc.a), abs(reprojectLuma(h.rgb) - reprojectLuma(hc.rgb)) / max(reprojectLuma(hi.rgb), 0.05));
  return mix(hc, own, off > REPROJECT_REJECT ? 1.0 : uRpAlpha);
}

// The velocity pass: d(uv)/dt of the cloud field seen at viewport uv (at the shell's lower part).
vec2 reprojectVelocity(vec2 uv) {
  vec3 rd = viewRay(uv);
  vec2 prev = reprojectPrevUv(rd, reprojectShellDist(rd), REPROJECT_VEL_DT);
  return prev.x < 0.0 ? vec2(0.0) : (uv - prev) / REPROJECT_VEL_DT;
}

vec4 cloudsAt(vec2 uv) {
  vec2 suv = uv - texture(uRpVel, uv).xy * uRpDt;
  vec4 bil = texture(uRpClouds, suv);
  // Clear sky, and the smooth inside of a cloud, are as bilinear gives them; only edges pay for the 4 taps.
  float edge = abs(dFdx(bil.a)) + abs(dFdy(bil.a));
  if (bil.a >= REPROJECT_CLEAR || edge < REPROJECT_EDGE) return bil;
  ivec2 size = textureSize(uRpClouds, 0);
  vec2 p = suv * vec2(size) - 0.5;
  vec2 i0 = floor(p);
  vec2 f = p - i0;
  ivec2 o = ivec2(i0);
  ivec2 mx = size - 1;
  vec4 c00 = texelFetch(uRpClouds, clamp(o, ivec2(0), mx), 0);
  vec4 c10 = texelFetch(uRpClouds, clamp(o + ivec2(1, 0), ivec2(0), mx), 0);
  vec4 c01 = texelFetch(uRpClouds, clamp(o + ivec2(0, 1), ivec2(0), mx), 0);
  vec4 c11 = texelFetch(uRpClouds, clamp(o + ivec2(1, 1), ivec2(0), mx), 0);
  vec4 w = vec4((1.0 - f.x) * (1.0 - f.y), f.x * (1.0 - f.y), (1.0 - f.x) * f.y, f.x * f.y);
  vec4 tr = vec4(c00.a, c10.a, c01.a, c11.a);
  // Taps whose transmittance is far from the interpolated one count less, so edges stay crisp instead of a 3× ramp.
  w *= exp(-REPROJECT_SHARPNESS * abs(tr - bil.a));
  w /= max(w.x + w.y + w.z + w.w, 1e-6);
  return c00 * w.x + c10 * w.y + c01 * w.z + c11 * w.w;
}

// The composite for the fragment at px: clouds over the cached background, display-encoded.
vec4 reprojectComposite(vec2 uv, ivec2 px) {
  vec4 c = cloudsAt(uv);
  if (c.a >= REPROJECT_CLEAR) return texelFetch(uRpDisplay, px, 0);
  vec3 bg = c.a > REPROJECT_OPAQUE ? texelFetch(uRpBg, px, 0).rgb : vec3(0.0);
  return vec4(displayColor(c.rgb + c.a * bg), 1.0);
}
`;
