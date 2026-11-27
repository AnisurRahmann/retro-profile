/**
 * The GLSL half of the noise (owner T1): one fragment source per texture, written out straight from the recipes (no
 * loops over tables), with the CPU reference's arithmetic (reference.ts) in float and uint.
 *
 * Two shapes below are measured choices (SHAPE at 128³ on an Apple M2 through Chrome's ANGLE Metal, GPU time to
 * completion):
 * - Straight-line code against a loop over a uniform octave table: 22 ms against 37 ms.
 * - Worley's loops keep constant bounds, so the compiler unrolls them. Bounds it cannot unroll (a uniform) took 41 ms.
 *
 * Every frequency is a power of two, so the lattice wraps with a mask, and nothing here uses an integer remainder:
 * GPUs have no integer divider (the same shader with `% freq` was 2.6× slower).
 */
import { PERLIN_SPAN, WORLEY_GAIN, detailRecipe, shapeRecipe, type Octave } from "./recipes";
import { WORLEY_EPS } from "./reference";

const f = (n: number): string => (Number.isInteger(n) ? `${n}.0` : String(n));

/** The full-screen triangle of the lab (assemble.ts's VERTEX_SHADER): gl_VertexID only, vUv in [0, 1]² (y up). */
export const NOISE_VERTEX = `#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
`;

const HELPERS = `#version 300 es
precision highp float;
precision highp int;

in vec2 vUv;
out vec4 outColor;

// The slice being rendered: p = (vUv, (uSlice + 0.5) / uSize) is a point of the tile.
uniform float uSlice;
uniform float uSize;

const float PERLIN_SPAN = ${f(PERLIN_SPAN)};
const float WORLEY_GAIN = ${f(WORLEY_GAIN)};
const float WORLEY_EPS = ${f(WORLEY_EPS)};

// reference.ts hashCell: a cell below 32 on every axis and a seed below 2^17 packed into one word, then MurmurHash3's
// finaliser (public domain): two xorshift-multiply rounds. The products wrap at 2^32.
uint hashCell(uvec3 c, uint seed) {
  uint h = ((c.z << 10u) | (c.y << 5u) | c.x) ^ (seed << 15u);
  h ^= h >> 16u;
  h *= 0x85ebca6bu;
  h ^= h >> 13u;
  h *= 0xc2b2ae35u;
  return h ^ (h >> 16u);
}

// Perlin's 12 edge gradients, each as likely: eight hash bits pick one through a multiply and a shift (4 of them come
// up 22 times in 256, the rest 21). Two of the bits are the signs, the third pair the zero axis, as a swizzle.
vec3 perlinGrad(uint h) {
  uint m = ((h & 255u) * 12u) >> 8u;
  uint axis = m >> 2u;
  vec3 g = vec3(1.0 - 2.0 * float((m >> 1u) & 1u), 1.0 - 2.0 * float(m & 1u), 0.0);
  return axis == 0u ? g.zxy : (axis == 1u ? g.xzy : g);
}

// The lattice cell at corner d (in {0, 1}³) of cell c, wrapped at the frequency: a mask. Cells stay floats to here,
// and are whole and non-negative, so the conversion to uint is exact.
uvec3 perlinCell(vec3 c, vec3 d, uint mask) {
  return uvec3(c + d) & mask;
}

float perlinCorner(uvec3 cell, uint seed, vec3 f, vec3 d) {
  return dot(perlinGrad(hashCell(cell, seed)), f - d);
}

float perlin(vec3 p, float freq, uint seed) {
  vec3 q = p * freq;
  vec3 c = floor(q);
  vec3 fr = q - c;
  vec3 u = fr * fr * fr * (fr * (fr * 6.0 - 15.0) + 10.0);
  uint mask = uint(freq) - 1u;
  float x00 = mix(perlinCorner(perlinCell(c, vec3(0.0, 0.0, 0.0), mask), seed, fr, vec3(0.0, 0.0, 0.0)), perlinCorner(perlinCell(c, vec3(1.0, 0.0, 0.0), mask), seed, fr, vec3(1.0, 0.0, 0.0)), u.x);
  float x10 = mix(perlinCorner(perlinCell(c, vec3(0.0, 1.0, 0.0), mask), seed, fr, vec3(0.0, 1.0, 0.0)), perlinCorner(perlinCell(c, vec3(1.0, 1.0, 0.0), mask), seed, fr, vec3(1.0, 1.0, 0.0)), u.x);
  float x01 = mix(perlinCorner(perlinCell(c, vec3(0.0, 0.0, 1.0), mask), seed, fr, vec3(0.0, 0.0, 1.0)), perlinCorner(perlinCell(c, vec3(1.0, 0.0, 1.0), mask), seed, fr, vec3(1.0, 0.0, 1.0)), u.x);
  float x11 = mix(perlinCorner(perlinCell(c, vec3(0.0, 1.0, 1.0), mask), seed, fr, vec3(0.0, 1.0, 1.0)), perlinCorner(perlinCell(c, vec3(1.0, 1.0, 1.0), mask), seed, fr, vec3(1.0, 1.0, 1.0)), u.x);
  return mix(mix(x00, x10, u.y), mix(x01, x11, u.y), u.z);
}

// Worley F1 in cells: the nearest feature point among the 3x3x3 cells around p (exact whenever F1 < 1). Ten hash bits
// per axis place the point in its cell.
float worley(vec3 p, float freq, uint seed) {
  vec3 q = p * freq;
  vec3 c = floor(q);
  uint mask = uint(freq) - 1u;
  float best = 1e9;
  for (int z = -1; z <= 1; z++) {
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        ivec3 g = ivec3(c) + ivec3(x, y, z);
        // Masked while it may still be −1 (a cell across the tile's edge): an int mask is the wrap on every driver.
        uint h = hashCell(uvec3(g & ivec3(mask)), seed);
        vec3 d = vec3(g) + vec3(h & 1023u, (h >> 10u) & 1023u, (h >> 20u) & 1023u) * (1.0 / 1024.0) - q;
        best = min(best, dot(d, d));
      }
    }
  }
  return sqrt(best);
}

float invertedWorley(vec3 p, float freq, uint seed) {
  return clamp(1.0 - worley(p, freq, seed), 0.0, 1.0);
}

`;

/** The Perlin fbm of these octaves: their weighted sum, in the reference's order. */
const perlinFbm = (octaves: readonly Octave[]): string =>
  octaves.map((o) => `${f(o.amp)} * perlin(p, ${f(o.freq)}, ${o.seed}u)`).join(" + ");

/** A Worley fbm channel: the fbm, contrast-stretched over 0..1. */
const worleyChannel = (octaves: readonly Octave[]): string =>
  `clamp(0.5 + ((${octaves.map((o) => `${f(o.amp)} * invertedWorley(p, ${f(o.freq)}, ${o.seed}u)`).join(" + ")}) - 0.5) * WORLEY_GAIN, 0.0, 1.0)`;

const MAIN_HEAD = `void main() {
  vec3 p = vec3(vUv, (uSlice + 0.5) / uSize);
`;

const shapeSources = new Map<64 | 128, string>();
/** SHAPE's fragment source for a size: R Perlin-Worley, G, B, A the Worley fbm channels. */
export function shapeFragment(shapeSize: 64 | 128): string {
  let src = shapeSources.get(shapeSize);
  if (!src) {
    const r = shapeRecipe(shapeSize);
    const [g, b, a] = r.worley;
    shapeSources.set(
      shapeSize,
      (src =
        HELPERS +
        MAIN_HEAD +
        `  float pf = clamp(0.5 + (${perlinFbm(r.perlin)}) / PERLIN_SPAN, 0.0, 1.0);
  float w = max(invertedWorley(p, ${f(r.pwWorley.freq)}, ${r.pwWorley.seed}u), WORLEY_EPS);
  outColor = vec4(clamp((pf + w - 1.0) / w, 0.0, 1.0), ${worleyChannel(g)}, ${worleyChannel(b)}, ${worleyChannel(a)});
}
`),
    );
  }
  return src;
}

let detailSource: string | null = null;
/** DETAIL's fragment source: R, G, B the Worley fbm channels. */
export function detailFragment(): string {
  if (!detailSource) {
    const [r, g, b] = detailRecipe();
    detailSource =
      HELPERS +
      MAIN_HEAD +
      `  outColor = vec4(${worleyChannel(r)}, ${worleyChannel(g)}, ${worleyChannel(b)}, 1.0);\n}\n`;
  }
  return detailSource;
}

/** Mip levels of a cube texture of `size` texels (level 0 down to 1³), for texStorage3D and generateMipmap. */
export const mipLevels = (size: number): number => Math.log2(size) + 1;

/**
 * The ?debug=noise view's main (assembled with the lab's header and modules by DebugContext.program). Eight square
 * tiles at uNzTiles[i] = (x0, y0, x1, y1) in uv (y up): SHAPE's R, G, B, A at slice uNzZ, DETAIL's R, G, B at uNzZ,
 * then BLUE. Texel values are shown raw (no encoding).
 */
export const SLICE_VIEW_MAIN = /* glsl */ `
uniform vec4 uNzTiles[8];
uniform float uNzZ;
uniform vec3 uNzInk;

void main() {
  for (int i = 0; i < 8; i++) {
    vec4 t = uNzTiles[i];
    vec2 size = t.zw - t.xy;
    if (size.x <= 0.0 || size.y <= 0.0 || vUv.x < t.x || vUv.y < t.y || vUv.x >= t.z || vUv.y >= t.w) continue;
    vec2 uv = (vUv - t.xy) / size;
    float v;
    if (i < 4) {
      vec4 s = texture(uShape, vec3(uv, uNzZ));
      v = i == 0 ? s.r : (i == 1 ? s.g : (i == 2 ? s.b : s.a));
    } else if (i < 7) {
      vec4 d = texture(uDetail, vec3(uv, uNzZ));
      v = i == 4 ? d.r : (i == 5 ? d.g : d.b);
    } else {
      v = texture(uBlue, uv).r;
    }
    outColor = vec4(vec3(v), 1.0);
    return;
  }
  outColor = vec4(uNzInk, 1.0);
}
`;
