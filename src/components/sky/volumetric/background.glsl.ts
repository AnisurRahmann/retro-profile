/**
 * The background behind the clouds (owner T5): the gradient, the stars, the moon and the sun, in linear HDR.
 * Contract: GLSL_CONTRACT.background. The clouds composite over it with their transmittance
 * (final = cloud.rgb + cloud.a × background), so a dense cloud hides the disc and a thin edge lets it glow through.
 *
 * A port of the home page's look (src/components/sky/bodies.ts, particles.ts, sky-shader.ts, src/lib/sky/model.ts),
 * moved from screen space onto the sky dome:
 * - Gradient: gradient.ts's zenith / mid / horizon colours by elevation, plus the horizon glow under the sun at
 *   sunrise and sunset (horizon × 1.331 at 0.75 · glow, model.ts's glow curve). background() dithers it with blue
 *   noise (±½ LSB in display space); skyGradient() stays dither-free because lighting's aerial perspective calls it.
 * - Stars: one candidate per cell of a cube-mapped grid, kept with a probability ∝ the cell's solid angle (an even
 *   density, ~2,100 over the sphere: ~260 in a 1440×900 view, as on the home page), seeded by uStarSeed (the day).
 *   Brightness follows the home page's power law (alpha 0.22 + 0.78·m, size 0.4–1.4 px at 900 px, m = u^3.2),
 *   8% are warm, each twinkles at 0.85 + 0.15·sin. The field turns about the celestial pole (Sylhet, 24.9° N) with
 *   the sun's hour angle, so it moves with the lab's clock. Hidden by day (uStarAlpha) and faded in the last 6° above
 *   the horizon.
 * - Stars, moon and the sun's disc are laid "over" in display (gamma) space, like the home page's canvas, so their
 *   alphas read the same; the blooms add in linear (weights converted).
 * - Moon: a sphere lit from the sun's side with the illuminated fraction uMoonFraction (phase angle
 *   cos α = 2f − 1), so the terminator is the correct ellipse, tilted toward the real sun. Lit part --text at 0.92,
 *   earthshine 0.06, the soft glow (0.16 · illumination, a 7.3° gaussian). Night only (model.ts's night curve).
 * - Sun: the limb-darkened disc (hot centre, 82% at the edge), coloured by elevation (uSunColor), and three soft
 *   blooms at 3×, 8× and 20× the radius, tinted toward the horizon colour near sunrise and sunset, breathing ±4%
 *   over 9 s. The home page's corona and crepuscular wedges are not ported: real shafts belong to the volume.
 *
 * Angular sizes match the home page's pixel sizes at a 900 px tall viewport with the lab's 60° FOV: the sun is 16 px
 * (1.07°) in radius, the moon 14 px (0.93°). Every tunable is a BACKGROUND_* constant.
 */
export const backgroundGlsl = /* glsl */ `
// Disc radii (rad) and one home-page CSS px at 900 px tall (rad).
const float BACKGROUND_SUN_R = 0.01862;
const float BACKGROUND_MOON_R = 0.01629;
const float BACKGROUND_PX = 0.001164;
// The disc's radiance over its colour (≥ 1 so a thin edge still glows through). T8: 2.6, so the disc burns out to a
// hot yellow-white through displayColor's shoulder, as in a photograph, instead of a flat peach disc at sunset.
const float BACKGROUND_SUN_GAIN = 2.6;
// The blooms (×R, weight). Weights are the home page's sRGB alphas 0.35 / 0.12 / 0.05 taken to linear (a^2.2).
const vec3 BACKGROUND_BLOOM_K = vec3(3.0, 8.0, 20.0);
// T8: the inner bloom ×2.2 and the middle ×1.6, the glare a lens records around a bright sun.
const vec3 BACKGROUND_BLOOM_W = vec3(0.22, 0.015, 0.0014);
// Moon colours (linear): --text for the disc; the home sky shader's glow colour.
const vec3 BACKGROUND_MOON_COL = vec3(0.791, 0.823, 0.888);
const vec3 BACKGROUND_MOON_GLOW = vec3(0.342, 0.393, 0.539);
const float BACKGROUND_MOON_GLOW_R = 0.128;
// Stars: cells per cube-face edge, the share of (solid-angle-weighted) cells holding a star, the pole's latitude.
const float BACKGROUND_STAR_CELLS = 26.0;
const float BACKGROUND_STAR_FILL = 0.9;
const float BACKGROUND_LAT = 0.4346;

// Elevation curves from src/lib/sky/model.ts: the horizon glow (sunrise / sunset) and night.
float backgroundGlow() {
  return smoothstep(-8.0, -2.0, uSunElev) * (1.0 - smoothstep(4.0, 10.0, uSunElev));
}

float backgroundNight() {
  return smoothstep(-6.0, -14.0, uSunElev);
}

vec3 skyGradient(vec3 rd) {
  float e = asin(clamp(rd.y, -1.0, 1.0)) * 57.29578;
  if (e < 0.0) return uGround;
  vec3 low = mix(uHorizonCol, uMid, smoothstep(0.0, 18.0, e));
  vec3 c = mix(low, uZenith, smoothstep(12.0, 75.0, e));
  // The horizon glow under the sun: ~76° wide in azimuth, ~25° tall (the home page's 0.9 vw × 0.42 vh ellipse).
  float glow = backgroundGlow();
  if (glow > 0.001) {
    vec2 s = normalize(uSunDir.xz + vec2(1e-6, 0.0));
    vec2 h = normalize(rd.xz + vec2(1e-6, 0.0));
    float daz = acos(clamp(dot(s, h), -1.0, 1.0)) / 1.3265;
    float del = e / 25.0;
    c = mix(c, uHorizonCol * 1.331, 0.75 * glow * exp(-(daz * daz + del * del) * 2.2));
  }
  return c;
}

// Three uniform values in [0, 1) for a lattice point (D. Hoskins, "Hash without Sine", MIT licence).
vec3 backgroundHash(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.xxy + p.yxx) * p.zyx);
}

// rd in the celestial frame: about the pole (north, 24.9° up), turned back by the sun's hour angle.
vec3 backgroundCelestial(vec3 rd) {
  vec3 P = vec3(0.0, sin(BACKGROUND_LAT), cos(BACKGROUND_LAT));
  vec3 E = vec3(1.0, 0.0, 0.0);
  vec3 Q = vec3(0.0, P.z, -P.y);
  float a = atan(dot(uSunDir, Q), dot(uSunDir, E));
  vec2 xy = vec2(dot(rd, E), dot(rd, Q));
  float c = cos(a), s = sin(a);
  return vec3(c * xy.x + s * xy.y, -s * xy.x + c * xy.y, dot(rd, P));
}

// The star field's contribution (rgb premultiplied by its coverage) for a view ray; px is one device px (rad).
vec4 backgroundStars(vec3 rd, float px) {
  vec3 d = backgroundCelestial(rd);
  vec3 a = abs(d);
  float face;
  vec2 uv;
  if (a.x >= a.y && a.x >= a.z) { face = d.x > 0.0 ? 0.0 : 1.0; uv = d.yz / a.x; }
  else if (a.y >= a.z) { face = d.y > 0.0 ? 2.0 : 3.0; uv = d.xz / a.y; }
  else { face = d.z > 0.0 ? 4.0 : 5.0; uv = d.xy / a.z; }
  vec2 g = (uv * 0.5 + 0.5) * BACKGROUND_STAR_CELLS;
  vec2 cell = floor(g);
  vec3 h1 = backgroundHash(vec3(cell, face * 53.0 + uStarSeed * 0.731));
  vec3 h2 = backgroundHash(vec3(cell.yx + 91.7, face * 17.0 + uStarSeed * 1.37 + 5.3));
  vec2 cuv = (cell + 0.5) / BACKGROUND_STAR_CELLS * 2.0 - 1.0;
  // Keep a cell's star with a probability ∝ its solid angle, (1 + u² + v²)^-1.5, so the density is even.
  float keep = BACKGROUND_STAR_FILL * pow(1.0 + dot(cuv, cuv), -1.5);
  if (h1.x > keep) return vec4(0.0);
  // The star sits inside its cell (with a margin wider than the largest star), so one cell per pixel suffices.
  vec2 spos = (cell + 0.15 + 0.7 * h1.yz) / BACKGROUND_STAR_CELLS * 2.0 - 1.0;
  vec2 off = (uv - spos) * 0.5 * BACKGROUND_STAR_CELLS;
  // The angle to the star: the offset on the face, in cells, times a cell's angular size there.
  float cellRad = 2.0 / BACKGROUND_STAR_CELLS / (1.0 + dot(spos, spos));
  float dist = length(off) * cellRad;
  float m = pow(h2.x, 3.2);
  float alpha = 0.22 + 0.78 * m;
  float r = (0.4 + 1.0 * m) * BACKGROUND_PX;
  float rr = max(r, 0.75 * px);
  float cov = (1.0 - smoothstep(rr - 0.5 * px, rr + 0.5 * px, dist)) * (r * r) / (rr * rr);
  float tw = 0.85 + 0.15 * sin(uTime * (0.6 + 1.6 * h2.y) * 6.2832 + h2.z * 6.2832);
  vec3 col = fract(h2.y * 37.0) < 0.08 ? uStarWarm : uStarCool;
  float k = alpha * tw * cov;
  return vec4(col * k, k);
}

// "Over" in display (gamma) space, as the home page's canvas blends: alphas keep their look on a dark sky.
vec3 backgroundOver(vec3 c, vec3 col, float a) {
  vec3 g = mix(pow(c, vec3(1.0 / 2.2)), pow(col, vec3(1.0 / 2.2)), clamp(a, 0.0, 1.0));
  return g * g * pow(g, vec3(0.2));
}

// The home page's limb darkening along the radius x (0 centre, 1 edge): hot centre → colour → 82% at the limb.
vec3 backgroundLimb(vec3 col, float x) {
  vec3 hot = col + (1.0 - col) * 0.35;
  if (x < 0.35) return mix(hot, col, x / 0.35);
  if (x < 0.55) return col * mix(1.0, 0.97, (x - 0.35) / 0.2);
  if (x < 0.85) return col * mix(0.97, 0.9, (x - 0.55) / 0.3);
  return col * mix(0.9, 0.82, clamp((x - 0.85) / 0.15, 0.0, 1.0));
}

// The home page's bloom falloff (its radial gradient's stops 1, .95, .7, .32, .1, 0 at 0, .35, .5, .7, .85, 1).
float backgroundBloom(float x) {
  return 1.0 - smoothstep(0.2, 1.0, x);
}

vec3 background(vec3 rd) {
  vec3 c = skyGradient(rd);
  // Display-space dither (±½ LSB), so the gradient doesn't band in 8 bits.
  float n = blueNoise(gl_FragCoord.xy) - 0.5;
  c = pow(max(pow(c, vec3(1.0 / 2.2)) + n / 255.0, 0.0), vec3(2.2));
  if (rd.y < 0.0) return c;
  float px = 2.0 * uTanHalfFov / max(uViewport.y, 1.0);

  // Stars.
  float starVis = uStarAlpha * smoothstep(0.0, 0.1, rd.y);
  if (starVis > 0.001) {
    vec4 s = backgroundStars(rd, px);
    c = backgroundOver(c, s.rgb / max(s.a, 1e-5), s.a * starVis);
  }

  // Moon: glow, earthshine, the lit part.
  float moonA = backgroundNight() * uMoonVisible;
  if (moonA > 0.001) {
    vec3 m = uMoonDir;
    float th = length(rd - m);
    float gr = th / BACKGROUND_MOON_GLOW_R;
    c = backgroundOver(c, BACKGROUND_MOON_GLOW, uMoonFraction * moonA * 0.16 * exp(-gr * gr * 0.9));
    if (th < BACKGROUND_MOON_R + 2.0 * px) {
      // Tangent axes: x toward the sun across the disc, y perpendicular.
      vec3 t = uSunDir - dot(uSunDir, m) * m;
      t = length(t) > 1e-4 ? normalize(t) : normalize(vec3(0.0, 1.0, 0.0) - m.y * m);
      vec3 b = cross(m, t);
      vec3 p = rd - m;
      vec2 q = vec2(dot(p, t), dot(p, b)) / BACKGROUND_MOON_R;
      float z = sqrt(max(0.0, 1.0 - dot(q, q)));
      float ca = clamp(2.0 * uMoonFraction - 1.0, -1.0, 1.0);
      float sa = sqrt(1.0 - ca * ca);
      float lit = smoothstep(-0.04, 0.04, z * ca + q.x * sa);
      float disc = 1.0 - smoothstep(BACKGROUND_MOON_R - 0.5 * px, BACKGROUND_MOON_R + 0.5 * px, th);
      float earth = 0.06;
      float a = 1.0 - (1.0 - earth) * (1.0 - 0.92 * lit);
      c = backgroundOver(c, BACKGROUND_MOON_COL, disc * moonA * a);
    }
  }

  // Sun: blooms (added), then the disc (over).
  if (uSunVisible > 0.001) {
    float th = length(rd - uSunDir);
    float tint = min(1.0, backgroundGlow()) * 0.6;
    vec3 bc = mix(uSunColor, uHorizonCol, tint);
    float breath = 1.0 + 0.04 * sin(uTime * 6.2832 / 9.0);
    vec3 x = th / (BACKGROUND_BLOOM_K * BACKGROUND_SUN_R * breath);
    float bloom = dot(BACKGROUND_BLOOM_W, vec3(backgroundBloom(x.x), backgroundBloom(x.y), backgroundBloom(x.z)));
    c += bc * bloom * uSunVisible;
    if (th < BACKGROUND_SUN_R + 2.0 * px) {
      float disc = 1.0 - smoothstep(BACKGROUND_SUN_R - 0.5 * px, BACKGROUND_SUN_R + 0.5 * px, th);
      vec3 d = backgroundLimb(uSunColor, min(1.0, th / BACKGROUND_SUN_R)) * BACKGROUND_SUN_GAIN;
      c = backgroundOver(c, d, disc * uSunVisible);
    }
  }
  return c;
}
`;
