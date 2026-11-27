/**
 * Cloud lighting (owner T4): light march, Beer–Lambert + powder, dual-lobe HG, ambient, aerial perspective.
 * Contract: GLSL_CONTRACT.lighting. After Schneider 2015/2017 (beer-powder, the light-march cone of rising steps)
 * and Hillaire 2016 (dual-lobe phase, the multiple-scattering octaves, energy-conserving integration in march).
 *
 * Radiance is in the same linear units as the sky gradient (uZenith, uHorizonCol ≈ 0..1), so the sun's
 * illuminance is a constant multiple of uSunColor (LIGHTING_SUN).
 */
export const lightingGlsl = /* glsl */ `
const float LIGHTING_PI = 3.14159265;
// Sun and moon illuminance relative to the gradient's colours.
const float LIGHTING_SUN = 16.0;
const float LIGHTING_MOON = 0.9;
// Ambient (sky dome) strength on the tops and the bases.
const float LIGHTING_AMBIENT_TOP = 0.95;
const float LIGHTING_AMBIENT_BASE = 0.55;
// The light march: 6 steps (VOL_LIGHT_STEPS), the first this long, each LIGHTING_GROWTH × the one before. T10: 70 m
// × 1.75 → 40 m × 2 (40, 80, …, 1280 m: 2.5 km in all), so the first steps resolve the lobes a surface is made of.
const float LIGHTING_STEP0 = 0.04;
const float LIGHTING_GROWTH = 2.0;
// The light path's extinction relative to the view path's. T10: 0.65 → 1 (the octaves now carry the light deeper).
const float LIGHTING_ABSORB = 1.0;
// Multiple-scattering octaves (Wrenninge 2013, as Hillaire 2016 uses): octave i scatters σs·aⁱ, sees the light path's
// σt·bⁱ and the phase's g·cⁱ; their in-scattering sums. T10: a, b, c = 0.3, 0.45, 0.6 → 0.5, 0.35, 0.5 (b below the
// brief's starting 0.5: the deeper octaves reach into a backlit body, which T10's denser σt otherwise left flat).
const float LIGHTING_MS_A = 0.5;
const float LIGHTING_MS_B = 0.35;
const float LIGHTING_MS_C = 0.5;
// Ambient occlusion (T10): the ambient dims by exp(−σ · D), with D the optical depth of the cloud straight above,
// estimated from the density at +100 m and +400 m (with detail: a lobe's crevice sits under more cloud than its top).
// D = ρ(+0.1 km)·0.25 km + ρ(+0.4 km)·0.35 km, in the march's optical-depth units.
const float LIGHTING_AO_SIGMA = 0.14;
// Powder (dark, unlit-looking edges where light enters) and how fast it saturates with local extinction (km).
const float LIGHTING_POWDER_KM = 0.09;
// Diffuse transmission through thick cloud (two-stream: T ≈ 1 / (1 + ¾·τ·(1 − g))), beyond what Beer–Lambert keeps.
// T10: 0.22 → 0.5, the brightness the denser σt took from cumulus bodies, given back through scattering; it falls as
// 1/τ, so a thinner lobe of a backlit body is lighter than a thicker one.
const float LIGHTING_DIFFUSE = 0.5;
// A stratus deck is close to the two-stream model's infinite slab (light can't leak out of its sides), so it keeps far
// more of the diffuse light: an overcast sky at midday is luminous grey, not storm-dark. Blended by the map's type.
const float LIGHTING_DIFFUSE_STRATUS = 1.0;
const float LIGHTING_DIFFUSE_NEUTRAL = 0.5;
const float LIGHTING_DIFFUSE_G = 0.8;
// Aerial perspective: e-folding distance (km) of the haze between the camera and the clouds.
const float LIGHTING_HAZE_KM = 32.0;
// Under an overcast deck the haze is lit by the deck, not by a blue sky: it greys toward this × the horizon's
// luminance as the coverage rises from LO to HI.
const float LIGHTING_OVERCAST_HAZE = 0.85;
const float LIGHTING_OVERCAST_LO = 0.6;
const float LIGHTING_OVERCAST_HI = 0.95;
// The bases see the whole lower sky dome, not only its horizon band: this much of the zenith colour mixes in.
const float LIGHTING_BASE_ZENITH = 0.7;
// Precipitation darkens the base by up to this much.
const float LIGHTING_PRECIP_DARK = 0.65;

float lightingHG(float c, float g) {
  float g2 = g * g;
  return (1.0 - g2) / (4.0 * LIGHTING_PI * pow(max(1.0 + g2 - 2.0 * g * c, 1e-4), 1.5));
}

float cloudPhase(float cosTheta) {
  return mix(lightingHG(cosTheta, 0.8), lightingHG(cosTheta, -0.2), 0.5);
}

// Optical depth from p toward the light: VOL_LIGHT_STEPS steps, each longer than the last; every step with detail
// (density fades it out by its footprint) except the last, which reads SHAPE only, two mip levels coarser.
float lightingOpticalDepth(vec3 p, vec3 l) {
  float tau = 0.0;
  float ds = LIGHTING_STEP0;
  float t = 0.0;
  for (int i = 0; i < VOL_LIGHT_STEPS; i++) {
    vec3 q = p + l * (t + ds * 0.5);
    tau += cloudDensity(q, i < VOL_LIGHT_STEPS - 1 ? 0.0 : 3.0) * ds;
    t += ds;
    ds *= LIGHTING_GROWTH;
  }
  return tau * LIGHTING_ABSORB;
}

// Direct light through tau: the multiple-scattering octaves' sum of Beer–Lambert and phase.
vec3 lightingDirect(float tau, float cosTheta, vec3 colour) {
  float a = 1.0;
  float b = 1.0;
  float c = 1.0;
  float sum = 0.0;
  for (int k = 0; k < 3; k++) {
    float g = c;
    sum += a * exp(-tau * b) * mix(lightingHG(cosTheta, 0.8 * g), lightingHG(cosTheta, -0.2 * g), 0.5);
    a *= LIGHTING_MS_A;
    b *= LIGHTING_MS_B;
    c *= LIGHTING_MS_C;
  }
  return colour * sum;
}

vec3 cloudRadiance(vec3 p, vec3 rd, float density) {
  vec3 w = weatherAt(p);
  float h = heightFraction(p);

  // The key light: the sun by day, the moon at night (whichever is brighter here).
  float sunW = uSunVisible;
  float moonW = uMoonVisible * uMoonFraction * (1.0 - uSunVisible);
  vec3 l = sunW >= moonW * (LIGHTING_MOON / LIGHTING_SUN) ? uSunDir : uMoonDir;
  vec3 lightCol = sunW >= moonW * (LIGHTING_MOON / LIGHTING_SUN)
    ? uSunColor * sunW * LIGHTING_SUN
    : vec3(0.75, 0.82, 1.0) * moonW * LIGHTING_MOON;

  float cosTheta = dot(rd, l);
  float tau = lightingOpticalDepth(p, l);
  // Powder: a sample just inside the surface toward the light has had little in-scattering yet. Strongest looking
  // away from the light, gone looking into it (where the forward lobe's silver lining dominates).
  float powder = 1.0 - exp(-density * LIGHTING_POWDER_KM * 2.0);
  powder = mix(powder, 1.0, smoothstep(-0.3, 0.9, cosTheta));
  vec3 direct = lightingDirect(tau, cosTheta, lightCol) * mix(0.35, 1.0, powder);
  // Light that diffused through the body: falls off as 1/τ, not exponentially, so thick decks stay luminous.
  float diffuseT = 1.0 / (1.0 + 0.75 * tau * (1.0 - LIGHTING_DIFFUSE_G));
  float diffuse = mix(LIGHTING_DIFFUSE_STRATUS, LIGHTING_DIFFUSE, smoothstep(0.0, 0.5, w.g));
  // Deep inside the body the light has also mixed with skylight, so its tint is half neutral.
  vec3 diffuseCol = mix(lightCol, vec3(dot(lightCol, vec3(0.2126, 0.7152, 0.0722))), LIGHTING_DIFFUSE_NEUTRAL);
  direct += diffuseCol * max(diffuseT - exp(-tau), 0.0) * (0.25 / LIGHTING_PI) * diffuse;

  // Ambient from the sky: horizon colour on the bases, zenith colour on the tops, dimmed by the cloud above (T10: AO
  // from two samples straight up, replacing × mix(0.55, 1, h) × (0.4 + 0.6·e^(−0.02·density))).
  vec3 sky = mix(mix(uHorizonCol, uZenith, LIGHTING_BASE_ZENITH) * LIGHTING_AMBIENT_BASE, uZenith * LIGHTING_AMBIENT_TOP + uMid * 0.25, h);
  vec3 up = normalize(p - vec3(0.0, -VOL_EARTH_R, 0.0));
  float above = cloudDensity(p + up * 0.1, 0.0) * 0.25 + cloudDensity(p + up * 0.4, 0.0) * 0.35;
  vec3 ambient = sky * exp(-LIGHTING_AO_SIGMA * above);
  ambient += vec3(0.75, 0.82, 1.0) * moonW * 0.03;

  // The precipitation hook: rain shafts and wet bases darken.
  float wet = 1.0 - LIGHTING_PRECIP_DARK * w.b * (1.0 - h);
  return (direct + ambient) * wet;
}

vec4 applyAerial(vec4 cloud, vec3 rd, float dist) {
  if (dist <= 0.0) return cloud;
  float f = 1.0 - exp(-dist / LIGHTING_HAZE_KM);
  // Haze in front of the cloud fills its covered fraction with the sky's colour in that direction.
  vec3 air = skyGradient(rd);
  float overcast = smoothstep(LIGHTING_OVERCAST_LO, LIGHTING_OVERCAST_HI, uCoverage);
  air = mix(air, vec3(dot(air, vec3(0.2126, 0.7152, 0.0722)) * LIGHTING_OVERCAST_HAZE), overcast);
  vec3 haze = air * (1.0 - cloud.a);
  return vec4(mix(cloud.rgb, haze, f), cloud.a);
}
`;
