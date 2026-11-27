/**
 * Temporal reprojection and the bilateral upsample (owner T7). Contract: GLSL_CONTRACT.reproject.
 * T7's own uniforms are declared here, prefixed uRp (they are not CLOUD_UNIFORMS); targets.ts sets them.
 *
 * The passes (targets.ts):
 *   march      one pixel of each 2×2 block of the cloud target (uRpOffset, Bayer order), into a half-size RGBA32F
 *              target: rgb premultiplied radiance, a = floor(distance × REPROJECT_DIST_SCALE) + transmittance
 *              (reprojectPack). The header has a single `out vec4`, so the distance rides in the alpha's integer part.
 *   resolve    the cloud target (RGBA16F, tier scale): the previous one reprojected with the wind and clipped to
 *              the fresh samples' variance box, mixed with a spatial estimate from the fresh samples (T11, see
 *              reprojectResolve); a fresh pixel takes its own sample at uRpAlpha.
 *   velocity   the cloud field's screen motion (viewport uv per second) on a coarse grid, for the composite's shift.
 *   background / display  full-resolution caches of background(rd) (linear, RGBA16F) and of displayColor of it
 *              (RGBA8), redrawn every few marches (targets.ts BG_EVERY), so the stars still twinkle.
 *   composite  (every frame, full resolution) cloudsAt(uv): the cloud target shifted by the wind since the last
 *              resolve, upsampled with 4 taps weighted by bilinear × transmittance similarity where the transmittance
 *              has an edge. Clear sky (one bilinear tap says transmittance 1) takes the display cache as it is.
 *   layered    (T11, out=layered, instead of the composite) the same clouds as a premultiplied layer at s_out over
 *              a separate background canvas (reprojectLayered); uRpBg is then the background at s_out.
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
// The layered output's alpha mode and its clamp visualisation (reprojectLayered).
uniform float uRpLift;
uniform float uRpClampViz;

const float REPROJECT_DIST_SCALE = 32.0;
const float REPROJECT_DIST_MAX = 255.0;
const float REPROJECT_T_MAX = 0.9998;
// T11, the resolve. The history's weight falls linearly with how far the clip moved it (transmittance, or radiance
// relative to the box's brightness) and is 0 from τ on: there it is a different cloud, and the spatial estimate
// replaces it.
const float REPROJECT_TAU = 0.2;
// Radiance below this doesn't count as brighter than it is when the clip distance is normalised.
const float REPROJECT_LUMA_FLOOR = 0.05;
// The clip box's least half-extent: in Y, Co and Cg relative to the box's brightest luminance, and in transmittance.
const float REPROJECT_EXTENT_FLOOR = 0.03;
const float REPROJECT_EXTENT_FLOOR_T = 0.01;
// A non-fresh pixel's box is its nearest fresh samples' min/max, padded by this share of the 3×3 range: tight
// enough to catch sub-texel reprojection lag (the dot lattice), loose enough not to clip jitter noise into grain.
const float REPROJECT_BOX_PAD = 0.5;
// The spatial estimate's depth falloff, relative to the group's depth (a cloud 25% nearer weighs e^-1).
const float REPROJECT_DEPTH_SIGMA = 0.25;
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

// The previous cloud target at uv through a Catmull-Rom filter (5 bilinear taps: the 4×4 kernel's middle 2×2 merged
// into one tap per axis, its four corners dropped and the weights renormalised). Bilinear blurs the history by up to
// half a texel at every reprojection (the wind moves the field by about that much per march), while a fresh pixel
// gets a sharp sample: whichever pixel of the 2×2 block was marched last then stands out, a lattice.
vec4 reprojectHistory(vec2 uv) {
  vec2 size = vec2(textureSize(uRpHistory, 0));
  vec2 p = uv * size - 0.5;
  vec2 i = floor(p);
  vec2 f = p - i;
  vec2 w0 = f * (-0.5 + f * (1.0 - 0.5 * f));
  vec2 w1 = 1.0 + f * f * (-2.5 + 1.5 * f);
  vec2 w2 = f * (0.5 + f * (2.0 - 1.5 * f));
  vec2 w3 = f * f * (-0.5 + 0.5 * f);
  vec2 w12 = w1 + w2;
  vec2 t0 = (i - 0.5) / size;
  vec2 t12 = (i + 0.5 + w2 / w12) / size;
  vec2 t3 = (i + 2.5) / size;
  vec4 c = texture(uRpHistory, vec2(t12.x, t0.y)) * (w12.x * w0.y)
    + texture(uRpHistory, vec2(t0.x, t12.y)) * (w0.x * w12.y)
    + texture(uRpHistory, t12) * (w12.x * w12.y)
    + texture(uRpHistory, vec2(t3.x, t12.y)) * (w3.x * w12.y)
    + texture(uRpHistory, vec2(t12.x, t3.y)) * (w12.x * w3.y);
  float wsum = w12.x * w0.y + w0.x * w12.y + w12.x * w12.y + w3.x * w12.y + w12.x * w3.y;
  c /= wsum;
  return vec4(max(c.rgb, vec3(0.0)), clamp(c.a, 0.0, 1.0));
}

// Premultiplied radiance and transmittance → (Y, Co, Cg, T), and back. The clip box lives in this space: luminance
// and chroma decorrelate, so a box in it hugs a cloud's colours much tighter than one in RGB.
vec4 reprojectToYCoCg(vec4 c) {
  return vec4(dot(c.rgb, vec3(0.25, 0.5, 0.25)), 0.5 * (c.r - c.b), dot(c.rgb, vec3(-0.25, 0.5, -0.25)), c.a);
}

vec4 reprojectFromYCoCg(vec4 y) {
  return vec4(y.x + y.y - y.z, y.x + y.z, y.x - y.y - y.z, y.w);
}

// Clips p toward the box centre onto the box's surface (not a per-channel clamp, which bends a colour toward a
// corner the neighbourhood never had).
vec4 reprojectClip(vec4 p, vec4 centre, vec4 extent) {
  vec4 v = p - centre;
  vec4 a = abs(v) / max(extent, vec4(1e-5));
  float m = max(max(a.x, a.y), max(a.z, a.w));
  return m > 1.0 ? centre + v / m : p;
}

// The resolve pass for cloud-target pixel q (T11). This march's fresh samples sit at 2·b + uRpOffset for every
// march-target texel b. Three estimates:
//   spatial  q's own fresh sample if it has one, else the bilinear mix of the 2 or 4 fresh samples around it, each
//            cloudy one also weighted by how close its depth is to the group's (bilateral);
//   box      the min/max, in YCoCg + transmittance, of the fresh samples q is built from: the 3×3 around a fresh
//            pixel; for the others, the ones the spatial estimate mixes, padded by REPROJECT_BOX_PAD × the 3×3 range;
//   history  the previous cloud target at q's reprojected position (Catmull-Rom), clipped toward the box's centre.
// out = mix(spatial, clipped history, w) with w = 1 − |history − clipped| / τ (0 when the history is invalid or
// outside the view); a fresh pixel caps w at 1 − α, so it still takes α of its own sample.
// Measured (T11 hand-off, "Checkerboard"): the dot lattice on wisps was reprojection lag (a fraction of a texel per
// march, grown ~4/α times by the running mean), which a 3×3 box of samples two texels apart can't see; the box of
// the nearest samples can. The history is Catmull-Rom, because bilinear re-blurs it by up to half a texel per march. A μ ± γσ box was worse than min/max: one cloudy sample among nine clear ones (a wisp)
// lies ~2.7σ from the mean, so a variance box clips the wisp out of its own history.
vec4 reprojectResolve(ivec2 q) {
  ivec2 hi = textureSize(uRpMarch, 0) - 1;
  // The four fresh samples around q are b0 + (0|1, 0|1), at bilinear weights (f is 0 or ½ on each axis).
  ivec2 rel = q - uRpOffset;
  ivec2 b0 = ivec2(floor(vec2(rel) * 0.5));
  vec2 f = vec2(rel - b0 * 2) * 0.5;
  bool fresh = f == vec2(0.0);
  vec4 lo = vec4(1e9);
  vec4 up = vec4(-1e9);
  vec4 lo9 = vec4(1e9);
  vec4 up9 = vec4(-1e9);
  float maxD = 0.0;
  for (int dy = -1; dy <= 1; dy++) {
    for (int dx = -1; dx <= 1; dx++) {
      float d;
      vec4 n = reprojectToYCoCg(reprojectUnpack(texelFetch(uRpMarch, clamp(b0 + ivec2(dx, dy), ivec2(0), hi), 0), d));
      maxD = max(maxD, d);
      lo9 = min(lo9, n);
      up9 = max(up9, n);
    }
  }
  if (fresh) {
    lo = lo9;
    up = up9;
  }

  vec4 s[4];
  float sd[4];
  float wb[4];
  float dNum = 0.0;
  float dDen = 0.0;
  for (int i = 0; i < 4; i++) {
    ivec2 o = ivec2(i & 1, i >> 1);
    s[i] = reprojectUnpack(texelFetch(uRpMarch, clamp(b0 + o, ivec2(0), hi), 0), sd[i]);
    wb[i] = (o.x == 1 ? f.x : 1.0 - f.x) * (o.y == 1 ? f.y : 1.0 - f.y);
    float op = wb[i] * (1.0 - s[i].a) * step(1e-4, sd[i]);
    dNum += op * sd[i];
    dDen += op;
    if (!fresh && wb[i] > 0.0) {
      vec4 n = reprojectToYCoCg(s[i]);
      lo = min(lo, n);
      up = max(up, n);
    }
  }
  // The group's opacity-weighted depth. Clear samples (no depth) keep their plain weight: a wisp against clear sky
  // interpolates as coverage; only cloud against cloud at another depth is held apart.
  float dRef = dDen > 1e-6 ? dNum / dDen : 0.0;
  vec4 spatial = vec4(0.0);
  float wSum = 0.0;
  for (int i = 0; i < 4; i++) {
    float w = wb[i];
    if (dRef > 0.0 && sd[i] > 1e-4) {
      float r = (sd[i] - dRef) / (REPROJECT_DEPTH_SIGMA * dRef);
      w *= exp(-r * r);
    }
    spatial += s[i] * w;
    wSum += w;
  }
  spatial = wSum > 1e-6 ? spatial / wSum : s[0];
  if (uRpValid < 0.5) return spatial;

  vec2 res = vec2(textureSize(uRpHistory, 0));
  vec3 rd = viewRay((vec2(q) + 0.5) / res);
  float d = fresh && sd[0] > 0.0 ? sd[0] : (dRef > 0.0 ? dRef : (maxD > 0.0 ? maxD : reprojectShellDist(rd)));
  vec2 prev = uRpDt > 0.0 ? reprojectPrevUv(rd, d, uRpDt) : (vec2(q) + 0.5) / res;
  if (!reprojectInside(prev)) return spatial;

  vec4 h = reprojectToYCoCg(reprojectHistory(prev));
  // A grey cloud has no chroma: every sample's Co and Cg are ~0, so the box is flat there and the history's fp16
  // chroma noise alone would clip it to the centre in every channel. The floor keeps a flat dimension from deciding.
  float yMax = max(up.x, REPROJECT_LUMA_FLOOR);
  vec4 extent = max(0.5 * (up - lo) + (fresh ? 0.0 : REPROJECT_BOX_PAD) * 0.5 * (up9 - lo9), vec4(vec3(REPROJECT_EXTENT_FLOOR * yMax), REPROJECT_EXTENT_FLOOR_T));
  vec4 hc = reprojectClip(h, 0.5 * (lo + up), extent);
  // How far the clip moved the history: transmittance as it is, radiance relative to the box's brightest.
  vec4 dv = abs(h - hc);
  float off = max(dv.w, length(dv.xyz) / yMax);
  float w = clamp(1.0 - off / REPROJECT_TAU, 0.0, 1.0);
  if (fresh) w *= 1.0 - uRpAlpha;
  return mix(spatial, reprojectFromYCoCg(hc), w);
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

// The layered output (T11, out=layered): the cloud canvas, premultiplied, over a separate background canvas that
// shows D(b) (D = displayColor). The browser blends C + (1 − A)·D(b), so with
//   A = 1 − T,  C = D(c + T·b) − T·D(b)
// the page shows the single pass's D(c + T·b) exactly, for the b in uRpBg (the background at this canvas's size).
// Premultiplied colour must not exceed A; D is concave, so C ≥ 0 always holds, but C ≤ A does not (a bright thin
// cloud over a darker sky). uRpLift = 1 raises A to the least alpha that keeps every channel ≤ A, which is still
// exact for that b; 0 clamps C to A as the brief states. uRpClampViz = 1 paints the clamp instead: magenta where it
// binds by more than one 8-bit level, red by more than 8, green where it doesn't bind (on cloud), clear elsewhere.
vec4 reprojectLayered(vec2 uv, ivec2 px) {
  vec4 c = cloudsAt(uv);
  if (c.a >= REPROJECT_CLEAR) return vec4(0.0);
  vec3 b = texelFetch(uRpBg, px, 0).rgb;
  vec3 db = displayColor(b);
  vec3 x = displayColor(c.rgb + c.a * b);
  float a = 1.0 - c.a;
  vec3 over = x - c.a * db - a;
  if (uRpClampViz > 0.5) {
    float m = max(max(over.r, over.g), over.b);
    if (a < 1.0 / 255.0) return vec4(0.0);
    return m > 8.0 / 255.0 ? vec4(1.0, 0.0, 0.0, 1.0) : m > 1.0 / 255.0 ? vec4(1.0, 0.0, 1.0, 1.0) : vec4(0.0, 1.0, 0.0, 1.0);
  }
  if (uRpLift > 0.5) {
    vec3 need = (x - db) / max(1.0 - db, vec3(1e-4));
    a = clamp(max(a, max(max(need.r, need.g), need.b)), 0.0, 1.0);
  }
  return vec4(clamp(x - (1.0 - a) * db, 0.0, a), a);
}
`;
