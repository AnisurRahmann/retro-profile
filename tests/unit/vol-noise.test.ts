/**
 * The noise (owner T1; docs/volumetric/BRIEF.md §5 "Noise"): the CPU reference tiles in x, y and z and stays in 0..1,
 * its hash is sound, the recipes keep to what the GLSL packs, the generated GLSL follows the recipes, BLUE is blue
 * noise, and the slice viewer's layout holds together. The GPU's texels were compared with this reference out of band
 * (handoffs/T1.md): 0.5/255 apart, the 8-bit rounding.
 */
import { describe, expect, it } from "vitest";
import { mulberry32 } from "@/lib/sky/random";
import {
  BLUE_SIZE,
  FBM_AMPS,
  PERLIN_SPAN,
  SLICE_TILES,
  SLICE_VIEW_MAIN,
  WORLEY_GAIN,
  blueNoise,
  type Octave,
  detailAt,
  detailFragment,
  detailRecipe,
  hashCell,
  invertedWorley,
  maxFrequency,
  perlin,
  perlinFbm01,
  shapeAt,
  shapeFragment,
  shapeRecipe,
  sliceLayout,
  worley,
  worleyChannel,
} from "@/lib/sky/volumetric/noise";

/** The brief's bar is 1e-3; the reference runs the same arithmetic on both faces, so it does far better. */
const FACE_TOLERANCE = 1e-9;

type V3 = [number, number, number];

/** Points with coordinate `axis` fixed at `at`, the other two on an 18×18 grid. */
function face(axis: number, at: number): V3[] {
  const out: V3[] = [];
  for (let a = 0; a < 18; a++)
    for (let b = 0; b < 18; b++) {
      const p: V3 = [0, 0, 0];
      p[axis] = at;
      p[(axis + 1) % 3] = (a + 0.37) / 18;
      p[(axis + 2) % 3] = (b + 0.61) / 18;
      out.push(p);
    }
  return out;
}

/** The channels of a texture at a point of the tile. */
const textures = {
  "SHAPE 64³": (p: V3): number[] => shapeAt(p[0], p[1], p[2], 64),
  "SHAPE 128³": (p: V3): number[] => shapeAt(p[0], p[1], p[2], 128),
  DETAIL: (p: V3): number[] => detailAt(p[0], p[1], p[2]),
} satisfies Record<string, (p: V3) => number[]>;

const VOLUME = 14;
const volumes = new Map<string, number[][]>();
/** Every channel of a texture over a VOLUME³ grid of the tile (texel centres), computed once. */
function volume(name: keyof typeof textures): number[][] {
  let v = volumes.get(name);
  if (!v) {
    v = [];
    for (let z = 0; z < VOLUME; z++)
      for (let y = 0; y < VOLUME; y++)
        for (let x = 0; x < VOLUME; x++)
          textures[name]([(x + 0.5) / VOLUME, (y + 0.5) / VOLUME, (z + 0.5) / VOLUME]).forEach(
            (c, i) => (v![i] ??= []).push(c),
          );
    volumes.set(name, v);
  }
  return v;
}

const sorted = (v: number[]): number[] => [...v].sort((a, b) => a - b);
const quantile = (s: number[], q: number): number =>
  s[Math.min(s.length - 1, Math.floor(q * s.length))]!;
const strip = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

describe("noise tiles in x, y and z", () => {
  it.each(
    Object.entries(textures).flatMap(([name, sample]) =>
      [0, 1, 2].map((axis) => [name, axis, sample] as const),
    ),
  )("%s: the faces at axis %i's 0 and 1 match (the brief: within 1e-3)", (_name, axis, sample) => {
    const a = face(axis, 0).map(sample);
    const b = face(axis, 1).map(sample);
    expect(a).toHaveLength(324);
    a.forEach((va, i) =>
      va.forEach((v, c) => expect(Math.abs(v - b[i]![c]!)).toBeLessThan(FACE_TOLERANCE)),
    );
  });

  it("the raw functions repeat over the tile, from inside it and from far outside", () => {
    const rand = mulberry32(7);
    for (const fn of [perlin, worley, invertedWorley]) {
      const freq = 2 ** (1 + Math.floor(rand() * 5));
      const seed = Math.floor(rand() * 2000);
      const [x, y, z] = [rand(), rand(), rand()];
      const at = fn(x, y, z, freq, seed);
      for (const k of [1, -3, 7]) {
        expect(fn(x + k, y, z, freq, seed)).toBeCloseTo(at, 9);
        expect(fn(x, y - k, z, freq, seed)).toBeCloseTo(at, 9);
        expect(fn(x, y, z + k, freq, seed)).toBeCloseTo(at, 9);
      }
    }
  });

  it("the fbm layers repeat too, across the lattice's wrap on a negative cell", () => {
    const [g] = shapeRecipe(64).worley;
    expect(worleyChannel(1.02, 0.5, -0.02, g)).toBeCloseTo(worleyChannel(0.02, 0.5, 0.98, g), 9);
    const octaves = shapeRecipe(64).perlin;
    expect(perlinFbm01(-0.02, 1.02, 0.5, octaves)).toBeCloseTo(
      perlinFbm01(0.98, 0.02, 0.5, octaves),
      9,
    );
  });
});

describe("noise stays in 0..1, and uses the range", () => {
  for (const name of Object.keys(textures) as (keyof typeof textures)[])
    it(`${name}: every channel of a ${VOLUME}³ volume is in 0..1 and spans most of it`, () => {
      for (const channel of volume(name)) {
        expect(channel).toHaveLength(VOLUME ** 3);
        expect(Math.min(...channel)).toBeGreaterThanOrEqual(0);
        expect(Math.max(...channel)).toBeLessThanOrEqual(1);
        // 2..98% covers at least 0.4: no channel is a flat or narrow band.
        const s = sorted(channel);
        expect(quantile(s, 0.98) - quantile(s, 0.02)).toBeGreaterThanOrEqual(0.4);
      }
    });

  it("SHAPE's R is mostly clear air with puffs up to 1 (the eroding remap)", () => {
    const r = volume("SHAPE 64³")[0]!;
    const zeros = r.filter((v) => v === 0).length / r.length;
    expect(zeros).toBeGreaterThan(0.3);
    expect(zeros).toBeLessThan(0.65);
    expect(Math.max(...r)).toBeGreaterThan(0.8);
  });

  it("SHAPE's Worley fbm channels span the range (2–5% at 0, a thin top tail reaching 1)", () => {
    for (const channel of volume("SHAPE 64³").slice(1)) {
      const s = sorted(channel);
      expect(s.filter((v) => v === 0).length / s.length).toBeGreaterThan(0.005);
      expect(s.filter((v) => v === 0).length / s.length).toBeLessThan(0.08);
      expect(quantile(s, 0.05)).toBeLessThan(0.15);
      expect(quantile(s, 0.5)).toBeGreaterThan(0.35);
      expect(quantile(s, 0.5)).toBeLessThan(0.55);
      expect(quantile(s, 0.95)).toBeGreaterThan(0.75);
      expect(Math.max(...s)).toBeGreaterThan(0.95);
    }
  });

  it("perlin keeps to its bound on a dense lattice, and the Perlin fbm has the spread PERLIN_SPAN assumes", () => {
    let peak = 0;
    let zeros = 0;
    let n = 0;
    for (let i = 0; i < 40; i++)
      for (let j = 0; j < 40; j++)
        for (let k = 0; k < 40; k += 3) {
          const [x, y, z] = [i / 40, j / 40, k / 40];
          peak = Math.max(peak, Math.abs(perlin(x, y, z, 4, 0x100)));
          if (perlinFbm01(x, y, z, shapeRecipe(64).perlin) === 0) zeros++;
          n++;
        }
    expect(peak).toBeGreaterThan(0.6);
    expect(peak).toBeLessThan(Math.sqrt(3) / 2);
    // An fbm of octaves at 4, 8, 16 spreads about 0.17 either side of 0, so over a span of 0.6 a few % sits at 0.
    expect(zeros / n).toBeGreaterThan(0.01);
    expect(zeros / n).toBeLessThan(0.1);
  });
});

describe("the hash is sound on the lattice it is used on", () => {
  const N = 32;
  const seeds = [
    ...shapeRecipe(128).perlin.map((o) => o.seed),
    shapeRecipe(128).pwWorley.seed,
    ...shapeRecipe(128)
      .worley.flat()
      .map((o) => o.seed),
    ...detailRecipe()
      .flat()
      .map((o) => o.seed),
  ];

  it.each(seeds)(
    "seed %i: feature points are uniform in their cells and independent of their neighbours",
    (seed) => {
      const uniform = 1 / 12;
      const sum = [0, 0, 0];
      const sq = [0, 0, 0];
      /** Correlation sums: by axis stepped, per offset component. */
      const lag = Array.from({ length: 9 }, () => 0);
      const cross = [0, 0, 0];
      const ones = new Array<number>(32).fill(0);
      const hashes = new Set<number>();
      const off = (h: number, c: number): number => ((h >>> (10 * c)) & 1023) / 1024 - 0.5;
      for (let z = 0; z < N; z++)
        for (let y = 0; y < N; y++)
          for (let x = 0; x < N; x++) {
            const h = hashCell(x, y, z, seed);
            hashes.add(h);
            for (let b = 0; b < 32; b++) ones[b]! += (h >>> b) & 1;
            const o = [off(h, 0), off(h, 1), off(h, 2)];
            [
              [(x + 1) % N, y, z],
              [x, (y + 1) % N, z],
              [x, y, (z + 1) % N],
            ].forEach((g, axis) => {
              const h2 = hashCell(g[0]!, g[1]!, g[2]!, seed);
              for (let c = 0; c < 3; c++) lag[axis * 3 + c]! += o[c]! * off(h2, c);
            });
            for (let c = 0; c < 3; c++) {
              sum[c]! += o[c]!;
              sq[c]! += o[c]! ** 2;
            }
            cross[0]! += o[0]! * o[1]!;
            cross[1]! += o[0]! * o[2]!;
            cross[2]! += o[1]! * o[2]!;
          }
      const n = N ** 3;
      expect(hashes.size).toBe(n);
      for (let c = 0; c < 3; c++) {
        expect(Math.abs(sum[c]! / n)).toBeLessThan(0.01);
        expect(Math.abs(sq[c]! / n - uniform)).toBeLessThan(0.004);
      }
      for (const x of lag) expect(Math.abs(x / n / uniform)).toBeLessThan(0.05);
      for (const x of cross) expect(Math.abs(x / n / uniform)).toBeLessThan(0.05);
      for (const b of ones) expect(Math.abs(b / n - 0.5)).toBeLessThan(0.02);
    },
  );

  it("Perlin's 12 gradients come up equally often", () => {
    const count = new Array<number>(12).fill(0);
    for (let i = 0; i < 4096; i++)
      count[((hashCell(i & 63, (i >> 6) & 63, i >> 12, 0x100) & 255) * 12) >>> 8]!++;
    for (const c of count) expect(Math.abs(c / 4096 - 1 / 12)).toBeLessThan(0.012);
  });

  it("Worley's F1 has the spread a jittered grid gives (no lattice showing through)", () => {
    const rand = mulberry32(11);
    for (const [freq, seed] of [
      [4, 0x200],
      [32, 0x502],
    ] as const) {
      let s = 0;
      let sq = 0;
      const n = 4000;
      for (let i = 0; i < n; i++) {
        const f1 = worley(rand(), rand(), rand(), freq, seed);
        s += f1;
        sq += f1 * f1;
      }
      const mean = s / n;
      expect(mean).toBeGreaterThan(0.48);
      expect(mean).toBeLessThan(0.56);
      const sd = Math.sqrt(sq / n - mean * mean);
      expect(sd).toBeGreaterThan(0.15);
      expect(sd).toBeLessThan(0.19);
    }
  });
});

describe("the recipes keep to what the GLSL packs", () => {
  const fbms = (): readonly (readonly Octave[])[] => [
    shapeRecipe(64).perlin,
    shapeRecipe(128).perlin,
    ...shapeRecipe(64).worley,
    ...shapeRecipe(128).worley,
    ...detailRecipe(),
  ];
  const freqs = (o: readonly Octave[]): number[] => o.map((x) => x.freq);

  it("every frequency is a power of two (the lattice wraps with a mask) of at most 32", () => {
    for (const o of fbms().flat()) {
      expect(Number.isInteger(Math.log2(o.freq))).toBe(true);
      expect(o.freq).toBeLessThanOrEqual(32);
    }
    expect(freqs(shapeRecipe(64).perlin)).toEqual([4, 8, 16]);
    expect(freqs(shapeRecipe(128).perlin)).toEqual([4, 8, 16, 32]);
    expect(shapeRecipe(64).worley.map(freqs)).toEqual([
      [2, 4, 8],
      [4, 8, 16],
      [8, 16],
    ]);
    expect(shapeRecipe(128).worley.map(freqs)).toEqual([
      [2, 4, 8],
      [4, 8, 16],
      [8, 16, 32],
    ]);
    expect(detailRecipe().map(freqs)).toEqual([[2, 4, 8], [4, 8], [8]]);
  });

  it("no octave goes past 4 texels per cell in its texture", () => {
    expect(
      Math.max(
        ...shapeRecipe(64)
          .worley.flat()
          .map((o) => o.freq),
        ...shapeRecipe(64).perlin.map((o) => o.freq),
      ),
    ).toBeLessThanOrEqual(maxFrequency(64));
    expect(
      Math.max(
        ...shapeRecipe(128)
          .worley.flat()
          .map((o) => o.freq),
        ...shapeRecipe(128).perlin.map((o) => o.freq),
      ),
    ).toBeLessThanOrEqual(maxFrequency(128));
    expect(
      Math.max(
        ...detailRecipe()
          .flat()
          .map((o) => o.freq),
      ),
    ).toBeLessThanOrEqual(maxFrequency(32));
  });

  it("every seed fits the hash's 17 bits, every channel's weights sum to 1, and 64³ holds the 128³ octaves it resolves", () => {
    for (const o of fbms().flat()) expect(o.seed).toBeLessThan(2 ** 17);
    for (const o of [shapeRecipe(64).pwWorley, shapeRecipe(128).pwWorley])
      expect(o.seed).toBeLessThan(2 ** 17);
    for (const c of fbms()) expect(c.reduce((s, o) => s + o.amp, 0)).toBeCloseTo(1, 12);
    // Each 64³ channel is its 128³ channel without the octaves past 16.
    const small = shapeRecipe(64).worley;
    const large = shapeRecipe(128).worley;
    const sameStart = (a: readonly Octave[], b: readonly Octave[]): void => {
      expect(a.map((o) => o.seed)).toEqual(b.map((o) => o.seed).slice(0, a.length));
      expect(a.map((o) => o.freq)).toEqual(b.map((o) => o.freq).filter((f) => f <= 16));
    };
    sameStart(small[0], large[0]);
    sameStart(small[1], large[1]);
    sameStart(small[2], large[2]);
    expect(shapeRecipe(64).perlin.map((o) => o.seed)).toEqual(
      shapeRecipe(128)
        .perlin.map((o) => o.seed)
        .slice(0, 3),
    );
    expect(FBM_AMPS.reduce((a, b) => a + b, 0)).toBe(1);
  });
});

describe("the GLSL is written from the recipes", () => {
  /** Every `fn(p, freq, seed)` in the source, as "freq:seed", in order. */
  const calls = (src: string, fn: string): string[] =>
    [...src.matchAll(new RegExp(`\\b${fn}\\(p, (\\d+)\\.0, (\\d+)u\\)`, "g"))].map(
      (m) => `${m[1]}:${m[2]}`,
    );
  const id = (o: Octave): string => `${o.freq}:${o.seed}`;
  /** A number as the generator writes it in GLSL: a float literal. */
  const glsl = (n: number): string => (Number.isInteger(n) ? `${n}.0` : String(n));

  it.each([64, 128] as const)(
    "SHAPE %i³ calls Perlin and Worley exactly as its recipe says",
    (size) => {
      const r = shapeRecipe(size);
      const src = strip(shapeFragment(size));
      expect(calls(src, "perlin")).toEqual(r.perlin.map(id));
      expect(calls(src, "invertedWorley")).toEqual([r.pwWorley, ...r.worley.flat()].map(id));
      const main = src.slice(src.indexOf("void main()"));
      // Each octave carries its recipe's weight, frequency and seed, verbatim.
      for (const o of r.perlin)
        expect(main).toContain(`${glsl(o.amp)} * perlin(p, ${glsl(o.freq)}, ${o.seed}u)`);
      for (const o of r.worley.flat())
        expect(main).toContain(`${glsl(o.amp)} * invertedWorley(p, ${glsl(o.freq)}, ${o.seed}u)`);
      // R remaps the Perlin fbm by the Worley (w), and G, B, A go stretched to the output.
      expect(main).toContain(
        `float w = max(invertedWorley(p, ${r.pwWorley.freq}.0, ${r.pwWorley.seed}u), WORLEY_EPS);`,
      );
      expect(main).toContain(") / PERLIN_SPAN, 0.0, 1.0);");
      expect(main).toContain("outColor = vec4(clamp((pf + w - 1.0) / w, 0.0, 1.0), ");
      for (const piece of ["clamp(0.5 + ((", ") - 0.5) * WORLEY_GAIN, 0.0, 1.0)"])
        expect(main.split(piece).length).toBe(1 + r.worley.length);
      expect(src).toContain(`const float PERLIN_SPAN = ${glsl(PERLIN_SPAN)};`);
      expect(src).toContain(`const float WORLEY_GAIN = ${glsl(WORLEY_GAIN)};`);
    },
  );

  it("DETAIL calls Worley exactly as its recipe says; the sources are built once", () => {
    const main = strip(detailFragment()).split("void main()")[1]!;
    expect(calls(main, "invertedWorley")).toEqual(detailRecipe().flat().map(id));
    for (const o of detailRecipe().flat())
      expect(main).toContain(`${glsl(o.amp)} * invertedWorley(p, ${glsl(o.freq)}, ${o.seed}u)`);
    expect(main.split("clamp(0.5 + ((").length).toBe(4);
    expect(main.split(") - 0.5) * WORLEY_GAIN, 0.0, 1.0)").length).toBe(4);
    expect(detailFragment()).toBe(detailFragment());
    expect(shapeFragment(128)).toBe(shapeFragment(128));
    expect(shapeFragment(64)).not.toBe(shapeFragment(128));
  });

  it.each([
    ["SHAPE 64³", shapeFragment(64)],
    ["SHAPE 128³", shapeFragment(128)],
    ["DETAIL", detailFragment()],
  ])("%s is well-formed, with no integer remainder (GPUs have no divider)", (_name, src) => {
    const s = strip(src);
    expect(s.startsWith("#version 300 es\n")).toBe(true);
    expect(s.match(/#version/g)?.length).toBe(1);
    expect(s.split("{").length).toBe(s.split("}").length);
    expect(s.split("(").length).toBe(s.split(")").length);
    expect(s).not.toMatch(/%/);
    expect(s.match(/\bvoid\s+main\s*\(/g)?.length).toBe(1);
  });

  it("the slice viewer's main is well-formed and samples the three textures", () => {
    const s = strip(SLICE_VIEW_MAIN);
    expect(s.split("{").length).toBe(s.split("}").length);
    expect(s.split("(").length).toBe(s.split(")").length);
    for (const name of ["uShape", "uDetail", "uBlue"]) expect(s).toContain(`texture(${name},`);
    expect(SLICE_TILES).toHaveLength(8);
  });
});

describe("BLUE is blue noise", () => {
  const d = blueNoise();
  const N = BLUE_SIZE;
  const M = N * N;
  /** Population variance of 0..255: the power a white-noise field has at every frequency is M times it. */
  const white = 255 ** 2 / 12;
  const mean = d.reduce((a, b) => a + b, 0) / M;

  it("is seeded and memoised: the same bytes every time", () => {
    expect(blueNoise()).toBe(d);
    expect(d).toHaveLength(M);
  });

  it("is 0..255 with 16 texels each", () => {
    const hist = new Map<number, number>();
    for (const v of d) hist.set(v, (hist.get(v) ?? 0) + 1);
    expect(hist.size).toBe(256);
    for (const n of hist.values()) expect(n).toBe(M / 256);
  });

  it("has almost no power at the lowest frequencies (the signature of blue noise)", () => {
    let power = 0;
    for (const [kx, ky] of [
      [1, 0],
      [0, 1],
      [1, 1],
      [1, -1],
    ]) {
      let re = 0;
      let im = 0;
      for (let y = 0; y < N; y++)
        for (let x = 0; x < N; x++) {
          const a = (-2 * Math.PI * ((kx! * x) / N + (ky! * y) / N)) as number;
          re += (d[y * N + x]! - mean) * Math.cos(a);
          im += (d[y * N + x]! - mean) * Math.sin(a);
        }
      power += re * re + im * im;
    }
    // White noise would be at 1; the lowest ring of this field measures about 0.05.
    expect(power / (4 * M) / white).toBeLessThan(0.15);
  });

  it("changes faster between neighbours than white noise, and averages out flatter in 2×2 blocks", () => {
    let diff = 0;
    let block = 0;
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        const v = d[y * N + x]!;
        diff += (v - d[y * N + ((x + 1) % N)]!) ** 2 + (v - d[((y + 1) % N) * N + x]!) ** 2;
      }
    for (let y = 0; y < N; y += 2)
      for (let x = 0; x < N; x += 2) {
        const m =
          (d[y * N + x]! + d[y * N + x + 1]! + d[(y + 1) * N + x]! + d[(y + 1) * N + x + 1]!) / 4;
        block += (m - mean) ** 2;
      }
    expect(diff / (2 * M)).toBeGreaterThan(1.1 * 2 * white);
    expect(block / (M / 4)).toBeLessThan(0.75 * (white / 4));
  });

  it("is periodic: the differences across the seam are as large as anywhere else", () => {
    let seam = 0;
    let inner = 0;
    for (let i = 0; i < M; i++) {
      const x = i % N;
      const y = (i / N) | 0;
      seam += (d[i]! - d[y * N + ((x + 1) % N)]!) ** 2 + (d[i]! - d[((y + 1) % N) * N + x]!) ** 2;
      if (x < N - 1) inner += (d[i]! - d[i + 1]!) ** 2;
      if (y < N - 1) inner += (d[i]! - d[i + N]!) ** 2;
    }
    const ratio = seam / (2 * M) / (inner / (2 * M - 2 * N));
    expect(ratio).toBeGreaterThan(0.8);
    expect(ratio).toBeLessThan(1.25);
  });
});

describe("the slice viewer's layout", () => {
  it.each([
    [1440, 900, 1],
    [2880, 1800, 2],
    [750, 1624, 2],
    [375, 812, 1],
  ] as const)(
    "at a %i×%i buffer, scale %i: eight square tiles in reading order, apart, inside the frame",
    (width, height, scale) => {
      const l = sliceLayout(width, height, scale);
      const columns = width / scale >= 708 ? 4 : 2;
      l.tiles.forEach((t, i) => {
        expect(t.size).toBeGreaterThan(100 * scale);
        expect(t.x).toBeGreaterThanOrEqual(0);
        expect(t.y - l.caption).toBeGreaterThanOrEqual(0);
        expect(t.x + t.size).toBeLessThanOrEqual(width);
        expect(t.y + t.size).toBeLessThanOrEqual(height - l.caption);
        // In its column, to the right of the tile before it, under the row above's gap.
        expect(t.x).toBe(l.tiles[i % columns]!.x);
        if (i % columns !== 0)
          expect(t.x).toBeGreaterThan(l.tiles[i - 1]!.x + l.tiles[i - 1]!.size);
        if (i >= columns)
          expect(t.y).toBeGreaterThan(l.tiles[i - columns]!.y + l.tiles[i - columns]!.size);
        // The shader's rect (float32, it goes to the GPU) is the same tile with y up.
        expect(l.uv[i * 4]).toBeCloseTo(t.x / width, 6);
        expect(l.uv[i * 4 + 2]).toBeCloseTo((t.x + t.size) / width, 6);
        expect(l.uv[i * 4 + 1]).toBeCloseTo(1 - (t.y + t.size) / height, 6);
        expect(l.uv[i * 4 + 3]).toBeCloseTo(1 - t.y / height, 6);
      });
    },
  );

  it("gives empty tiles when there is no room for a 24 px one", () => {
    expect(sliceLayout(40, 40, 1).tiles.every((t) => t.size === 0)).toBe(true);
  });
});
