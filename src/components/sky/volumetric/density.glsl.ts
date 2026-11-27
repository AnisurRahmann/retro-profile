/**
 * Cloud density (owner T4): per-type height gradient, SHAPE remapped by it, DETAIL erosion, × coverage.
 * Contract: GLSL_CONTRACT.density. After the Nubis / HZD density model (Schneider 2015, 2017): the shape's
 * Perlin-Worley is remapped by its Worley fbm, multiplied by the type's height gradient, remapped by coverage, then
 * eroded by the detail fbm (wispy at the base, billowy at the top).
 */
export const densityGlsl = /* glsl */ `
// One SHAPE tile spans this many km (Worley cells of ~2.5 km at its lowest frequency); one DETAIL tile, this many.
const float DENSITY_SHAPE_KM = 10.0;
// A stratus deck samples SHAPE at this tile instead (cells of ~0.8 km): seen from below, an overcast deck is a mosaic
// of thick cells and thinner lanes, not 10-km swells (which smear into streaks at grazing angles).
const float DENSITY_SHAPE_KM_STRATUS = 3.2;
// The stratus cells are sampled on axes turned by ~37° and mixed with this much of the 10-km field, so neither tile's
// period lines up into rows and spokes toward the horizon.
const float DENSITY_STRATUS_BIG = 0.2;
// Past LO km (ground distance) the stratus cells fade into the 10-km field, gone by HI: the fine tile repeats every
// 3.2 km, and far away its copies line up into rows toward the horizon (T10: the mips now handle the aliasing).
const float DENSITY_STRATUS_FAR_LO = 12.0;
const float DENSITY_STRATUS_FAR_HI = 35.0;
// T10: 0.6 → 0.32 km per DETAIL tile (the tile's period, inside the brief's 0.25–0.4 km; its fbm's cells are 160, 80
// and 40 m), the lobes of fair-weather cumulus.
const float DENSITY_DETAIL_KM = 0.32;
// Extinction σt (per km) of a fully dense sample. T10: 80 → 66, a mean free path of 15 m at density 1 (the brief's
// 15–40 m), and the density is no longer multiplied by the coverage, so a body's core reaches 1 (before: ≤ cov, an
// MFP of 33 m at best and 50–125 m in most of A's bodies).
const float DENSITY_SCALE = 66.0;
// Mip LOD (T10): log2(footprint / texel), with footprint = distance × the cloud target's pixel angle, times
// (1 / sin of the ray's elevation over the layer)^ANISO (0 = isotropic, the brief's formula).
const float DENSITY_LOD_ANISO = 0.0;
// As DETAIL's LOD runs from LO to HI levels (HI: the second-coarsest of the 32³ chain), its fbm fades to MEAN, the value
// its mips converge to (T1: the Worley fbm's median), so a far cloud keeps a near one's average erosion. Fading to no
// erosion instead (T8's fixed-km fade did) swells far clouds: B's edge cell then hid the low sun's whole disc.
const float DENSITY_DETAIL_MEAN = 0.45;
const float DENSITY_DETAIL_FADE_LO = 2.0;
const float DENSITY_DETAIL_FADE_HI = 4.0;
// The cumulus surface (T10): the eroded density d becomes d^POW (a core of 1 stays 1), so a body's rim rises to its σt
// within a few tens of metres and reads as a surface, not a translucent ramp (A's edge width 0.56× T8's).
// A stratus deck keeps d (POW 1).
const float DENSITY_EDGE_POW = 0.35;
// Below this eroded density a cumulus is clear air before the curve (d' = ((d − CUT) / (1 − CUT))^POW): without it,
// the curve lifts the faint fringe (0.01 → 0.36) and every cloud swells to the full extent of its field.
const float DENSITY_EDGE_CUT = 0.04;
// Wispy (fbm) erosion at the base → billowy (1 − fbm) at the top, over this height-fraction range.
const float DENSITY_BILLOW_LO = 0.05;
const float DENSITY_BILLOW_HI = 0.5;
// How far the detail fbm eats into the shape's edges: cumulus and cumulonimbus, and a stratus deck (gentler, so an
// overcast deck stays continuous).
const float DENSITY_EROSION = 0.7;
const float DENSITY_EROSION_STRATUS = 0.4;
// The detail field drifts and boils at this rate (km/s, apparent), on top of the wind.
const float DENSITY_DETAIL_DRIFT = 0.012;
// Tops lean downwind: the shape is sheared by this many km per km of height.
const float DENSITY_SHEAR = 0.35;
// Weather-map coverage below LO makes no cloud and reaches full strength at HI: the field's thin fringes otherwise
// leave a dust of tiny fragments between the clusters.
const float DENSITY_COV_FLOOR_LO = 0.07;
const float DENSITY_COV_FLOOR_HI = 0.22;
// The height profile is offset by the shape's low fbm (± half this, in height fraction), so bases aren't a ruler-flat
// line (they read as a slab edge-on at sunset).
const float DENSITY_BASE_RAGGED = 0.07;

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
  // Level 0 explicitly: the map has no mips, and this runs in the march's non-uniform loop (no derivatives).
  return textureLod(uWeather, uv, 0.0).rgb;
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

// The mip level for a footprint (km) on a texture whose texels are texelKm apart.
float densityLod(float footKm, float texelKm) {
  return log2(max(1.0, footKm / texelKm));
}

// One pixel's footprint (km) at p: distance × the pixel angle (vertical FOV / the cloud target's height; uResolution is
// the cloud target's in the march pass), stretched toward the horizon by DENSITY_LOD_ANISO.
float densityFootprint(vec3 p) {
  vec3 v = p - uCamPos;
  float dist = length(v);
  float pixel = 2.0 * atan(uTanHalfFov) / max(uResolution.y, 1.0);
  float sinEl = abs(dot(v / max(dist, 1e-6), normalize(p - vec3(0.0, -VOL_EARTH_R, 0.0))));
  return dist * pixel * pow(1.0 / max(sinEl, 0.02), DENSITY_LOD_ANISO);
}

// The SHAPE / DETAIL lookups (world km → texture uvw, with the wind already applied by the caller), at the LOD of the
// footprint foot (km) plus extra levels.
vec4 densityShape(vec3 q, float type, float groundKm, float foot, float extra) {
  vec4 big = textureLod(uShape, q / DENSITY_SHAPE_KM, densityLod(foot, DENSITY_SHAPE_KM / VOL_SHAPE_SIZE) + extra);
  float a = max(smoothstep(0.0, 0.5, type), smoothstep(DENSITY_STRATUS_FAR_LO, DENSITY_STRATUS_FAR_HI, groundKm));
  if (a >= 1.0) return big;
  vec3 r = vec3(q.x * 0.8 - q.z * 0.6, q.y, q.x * 0.6 + q.z * 0.8);
  float lodCells = densityLod(foot, DENSITY_SHAPE_KM_STRATUS / VOL_SHAPE_SIZE) + extra;
  vec4 cells = mix(textureLod(uShape, r / DENSITY_SHAPE_KM_STRATUS, lodCells), big, DENSITY_STRATUS_BIG);
  return mix(cells, big, a);
}

vec3 densityDetail(vec3 q, float lod) {
  return textureLod(uDetail, q / DENSITY_DETAIL_KM, lod).rgb;
}

// lod: 0 full detail, 1 shape only; above 1, shape only at (lod − 1) extra mip levels (the light march's last step).
// On top of it, the footprint's LOD fades the detail to its mean (T10; it replaces the march's fixed-km fade).
float cloudDensity(vec3 p, float lod) {
  float alt = densityAltitude(p);
  if (alt < VOL_CLOUD_BASE || alt > VOL_CB_TOP) return 0.0;
  vec3 w = weatherAt(p);
  float h = densityHeightFraction(alt, w.g);
  if (alt > densityTop(w.g)) return 0.0;

  // Coverage; a cumulonimbus spreads into an anvil near its top (coverage raised toward 1 there).
  float anvil = smoothstep(0.75, 1.0, w.g) * smoothstep(0.62, 0.85, h);
  float floorW = smoothstep(DENSITY_COV_FLOOR_LO, DENSITY_COV_FLOOR_HI, w.r);
  float cov = pow(w.r, mix(1.0, 0.25, anvil)) * floorW;
  if (cov < 0.01) return 0.0;

  // The field moves with the weather map (uv = xz / K − offset, so world features move by +offset·K), and the
  // tops lean downwind.
  vec2 wind = uWeatherOffset * VOL_WEATHER_MAP_KM;
  vec2 windDir = length(uWindVel) > 1e-8 ? normalize(uWindVel) : vec2(0.0);
  vec3 q = vec3(p.x - wind.x, alt, p.z - wind.y) - vec3(windDir.x, 0.0, windDir.y) * (alt - VOL_CLOUD_BASE) * DENSITY_SHEAR;

  float foot = densityFootprint(p);
  vec4 s = densityShape(q, w.g, length(p.xz), foot, max(lod - 1.0, 0.0));
  float lowFbm = s.g * 0.625 + s.b * 0.25 + s.a * 0.125;
  float base = remap(s.r, -(1.0 - lowFbm), 1.0, 0.0, 1.0);
  base *= densityGradient(clamp(h + (lowFbm - 0.5) * DENSITY_BASE_RAGGED, 0.0, 1.0), w.g);
  // Coverage remap: only the shape's peaks above (1 − cov) survive, so a sparse sky is small rounded cells.
  // T10: × the coverage floor only (it was × cov), so a body's core reaches 1 and DENSITY_SCALE is its σt.
  base = clamp(remap(base, 1.0 - cov, 1.0, 0.0, 1.0), 0.0, 1.0) * floorW;
  if (base <= 0.0) return 0.0;

  float lodDetail = densityLod(foot, DENSITY_DETAIL_KM / VOL_DETAIL_SIZE);
  float fade = max(min(lod, 1.0), smoothstep(DENSITY_DETAIL_FADE_LO, DENSITY_DETAIL_FADE_HI, lodDetail));
  float hiFbm = DENSITY_DETAIL_MEAN;
  if (fade < 1.0) {
    vec3 drift = vec3(windDir.x, 0.4, windDir.y) * uTime * DENSITY_DETAIL_DRIFT;
    vec3 dn = densityDetail(q - drift, lodDetail);
    hiFbm = mix(dn.r * 0.625 + dn.g * 0.25 + dn.b * 0.125, DENSITY_DETAIL_MEAN, fade);
  }
  // Wispy (the fbm) at the base, billowy (1 − fbm) toward the top, inside the standard erosion remap.
  float erode = mix(hiFbm, 1.0 - hiFbm, smoothstep(DENSITY_BILLOW_LO, DENSITY_BILLOW_HI, h));
  float amount = mix(DENSITY_EROSION_STRATUS, DENSITY_EROSION, smoothstep(0.1, 0.5, w.g));
  float d = clamp(remap(base, erode * amount, 1.0, 0.0, 1.0), 0.0, 1.0);
  float cu = smoothstep(0.1, 0.5, w.g);
  d = pow(clamp((d - DENSITY_EDGE_CUT * cu) / (1.0 - DENSITY_EDGE_CUT * cu), 0.0, 1.0), mix(1.0, DENSITY_EDGE_POW, cu));
  // Rain clouds are denser (the precipitation hook; lighting darkens their bases).
  return d * DENSITY_SCALE * (1.0 + w.b);
}
`;
