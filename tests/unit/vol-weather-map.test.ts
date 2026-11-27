/** The weather map (owner T2): generator statistics, cells, determinism, and the wind scroll. */
import { describe, expect, it } from "vitest";
import {
  CLOUD_TYPE_VALUE,
  GEOMETRY,
  WEATHER_MAP_SIZE,
  type WeatherMapParams,
} from "@/components/sky/volumetric/types";
import { WIND_TIMELAPSE, createWeatherMap, generateWeatherMap, windVelocity } from "@/lib/sky/volumetric/weather-map";

const SIZE = WEATHER_MAP_SIZE;
const TEXELS = SIZE * SIZE;
const base: WeatherMapParams = {
  type: "cumulus",
  coverage: 0.38,
  precipitation: 0,
  windKmh: 15,
  windFromDeg: 270,
  seed: 1,
};
const over = (p: Partial<WeatherMapParams>): WeatherMapParams => ({ ...base, ...p });

const at = (m: Uint8Array, i: number): number => m[i]!;
const ch = (m: Uint8Array, c: 0 | 1 | 2 | 3, x: number, y: number) => at(m, (y * SIZE + x) * 4 + c);
const meanCoverage = (m: Uint8Array) => {
  let sum = 0;
  for (let i = 0; i < TEXELS; i++) sum += at(m, 4 * i);
  return sum / (TEXELS * 255);
};
const countIf = (m: Uint8Array, c: 0 | 1 | 2, pred: (v: number) => boolean) => {
  let n = 0;
  for (let i = 0; i < TEXELS; i++) if (pred(at(m, 4 * i + c))) n++;
  return n;
};
const sameBytes = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((v, i) => v === at(b, i));
const speedAt = (kmh: number) => ((kmh / 3600) * WIND_TIMELAPSE) / GEOMETRY.WEATHER_MAP_KM;
/** Connected components (4-neighbour, wrapping across the edges) of the texels matching pred. */
const components = (m: Uint8Array, pred: (i: number) => boolean) => {
  const seen = new Uint8Array(TEXELS);
  let count = 0;
  for (let start = 0; start < TEXELS; start++) {
    if (!pred(start) || seen[start]) continue;
    count++;
    seen[start] = 1;
    const stack = [start];
    while (stack.length) {
      const i = stack.pop()!;
      const x = i % SIZE;
      const y = (i / SIZE) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const j = (((y + dy + SIZE) % SIZE) * SIZE + ((x + dx + SIZE) % SIZE)) | 0;
        if (!seen[j] && pred(j)) {
          seen[j] = 1;
          stack.push(j);
        }
      }
    }
  }
  return count;
};

describe("generateWeatherMap: layout and channels", () => {
  it("writes a 128×128 RGBA8 map with A unused (255)", () => {
    const m = generateWeatherMap(base);
    expect(m.length).toBe(TEXELS * 4);
    for (let i = 0; i < TEXELS; i++) expect(at(m, 4 * i + 3)).toBe(255);
  });
  it("encodes the type channel per texel (stratus 0, cumulus 0.5)", () => {
    const cumulusByte = Math.round(CLOUD_TYPE_VALUE.cumulus * 255);
    const cu = generateWeatherMap(base);
    const st = generateWeatherMap(over({ type: "stratus", coverage: 0.95 }));
    for (let i = 0; i < TEXELS; i++) {
      expect(at(cu, 4 * i + 1)).toBe(cumulusByte);
      expect(at(st, 4 * i + 1)).toBe(0);
    }
  });
});

describe("generateWeatherMap: determinism", () => {
  it("returns identical bytes for identical params (any seed)", () => {
    for (const seed of [1, 7]) {
      const p = over({ seed });
      expect(sameBytes(generateWeatherMap(p), generateWeatherMap({ ...p }))).toBe(true);
    }
  });
  it("changes the pattern with the seed", () => {
    const a = generateWeatherMap(base);
    const b = generateWeatherMap(over({ seed: 2 }));
    let diff = 0;
    for (let i = 0; i < TEXELS; i++) if (at(a, 4 * i) !== at(b, 4 * i)) diff++;
    expect(diff).toBeGreaterThan(1000);
  });
  it("ignores the wind (the wind only scrolls; the field is the seed's)", () => {
    expect(sameBytes(generateWeatherMap(over({ windKmh: 5 })), generateWeatherMap(over({ windKmh: 50 })))).toBe(true);
  });
  it("raises coverage per texel when the param rises (same pattern, higher threshold)", () => {
    const low = generateWeatherMap(over({ coverage: 0.2 }));
    const mid = generateWeatherMap(over({ coverage: 0.38 }));
    const high = generateWeatherMap(over({ coverage: 0.6 }));
    for (let i = 0; i < TEXELS; i++) {
      expect(at(mid, 4 * i)).toBeGreaterThanOrEqual(at(low, 4 * i));
      expect(at(high, 4 * i)).toBeGreaterThanOrEqual(at(mid, 4 * i));
    }
  });
});

describe("generateWeatherMap: coverage statistics", () => {
  it("cumulus at 0.38: the mean coverage stays within 0.30–0.46 (seeds 1–5)", () => {
    const out = [];
    for (const seed of [1, 2, 3, 4, 5]) {
      const mean = meanCoverage(generateWeatherMap(over({ seed })));
      if (mean < 0.3 || mean > 0.46) out.push(`seed ${seed}: ${mean}`);
    }
    expect(out).toEqual([]);
  });
  it("stratus at 0.95: the mean coverage is at least 0.9 (seeds 1–5)", () => {
    const out = [];
    for (const seed of [1, 2, 3, 4, 5]) {
      const mean = meanCoverage(generateWeatherMap(over({ type: "stratus", coverage: 0.95, seed })));
      if (mean < 0.9) out.push(`seed ${seed}: ${mean}`);
    }
    expect(out).toEqual([]);
  });
  it("cumulus is patchy: clear gaps and dense clusters, never uniform", () => {
    const m = generateWeatherMap(base);
    expect(countIf(m, 0, (v) => v <= 5) / TEXELS).toBeGreaterThan(0.12);
    expect(countIf(m, 0, (v) => v >= 128) / TEXELS).toBeGreaterThan(0.15);
    const max = Math.max(...Array.from({ length: TEXELS }, (_, i) => at(m, 4 * i)));
    expect(max).toBeGreaterThanOrEqual(180);
  });
  it("stratus is a smooth near-uniform deck with no holes", () => {
    const m = generateWeatherMap(over({ type: "stratus", coverage: 0.95 }));
    expect(countIf(m, 0, (v) => v < 160)).toBe(0);
    const mean = meanCoverage(m);
    let near = 0;
    for (let i = 0; i < TEXELS; i++) if (Math.abs(at(m, 4 * i) / 255 - mean) <= 0.2) near++;
    expect(near / TEXELS).toBeGreaterThan(0.95);
  });
  it("the mean tracks the coverage param across the range", () => {
    let prev = 0;
    for (const cov of [0.1, 0.2, 0.38, 0.6, 0.95]) {
      const mean = meanCoverage(generateWeatherMap(over({ coverage: cov })));
      expect(mean).toBeGreaterThan(prev);
      expect(Math.abs(mean - cov)).toBeLessThan(0.15);
      prev = mean;
    }
  });
  it("tiles with no seam: the wrap edge is as smooth as the interior", () => {
    for (const p of [over({ type: "stratus", coverage: 0.3 }), base]) {
      const m = generateWeatherMap(p);
      let seamU = 0;
      let innerU = 0;
      let seamV = 0;
      let innerV = 0;
      for (let y = 0; y < SIZE; y++) {
        seamU += Math.abs(ch(m, 0, SIZE - 1, y) - ch(m, 0, 0, y));
        innerU += Math.abs(ch(m, 0, 63, y) - ch(m, 0, 64, y));
      }
      for (let x = 0; x < SIZE; x++) {
        seamV += Math.abs(ch(m, 0, x, SIZE - 1) - ch(m, 0, x, 0));
        innerV += Math.abs(ch(m, 0, x, 63) - ch(m, 0, x, 64));
      }
      expect(seamU).toBeLessThanOrEqual(innerU + SIZE);
      expect(seamV).toBeLessThanOrEqual(innerV + SIZE);
    }
  });
});

describe("generateWeatherMap: cumulonimbus cells", () => {
  it("stamps 1–2 dense cumulonimbus cells (type ≥ 0.9 with high coverage)", () => {
    const out = [];
    for (const seed of [1, 2, 3, 4]) {
      const m = generateWeatherMap(over({ type: "cumulonimbus", seed }));
      const cellTexels = countIf(m, 1, (v) => v >= 230);
      if (cellTexels < 80 || cellTexels > 8000) out.push(`seed ${seed}: ${cellTexels} cell texels`);
      let strong = 0;
      for (let i = 0; i < TEXELS; i++) {
        // G ≥ 0.9 means the type blend ≥ 0.8, i.e. the cell's strength is ≥ ~0.47 there.
        if (at(m, 4 * i + 1) >= 230 && at(m, 4 * i) < 118) out.push(`seed ${seed}: weak cell texel`);
        if (at(m, 4 * i) >= 250) strong++;
      }
      if (strong < 1) out.push(`seed ${seed}: no strong core`);
      const blobs = components(m, (i) => at(m, 4 * i + 1) >= 230);
      if (blobs < 1 || blobs > 2) out.push(`seed ${seed}: ${blobs} cells`);
    }
    expect(out).toEqual([]);
  });
  it("a fair-weather cumulus map has no dense cores and no cumulonimbus type", () => {
    const m = generateWeatherMap(base);
    expect(countIf(m, 0, (v) => v >= 230)).toBe(0);
    expect(countIf(m, 1, (v) => v >= 230)).toBe(0);
  });
});

describe("generateWeatherMap: precipitation", () => {
  it("follows the params: zero precipitation writes zero everywhere", () => {
    const m = generateWeatherMap(base);
    for (let i = 0; i < TEXELS; i++) expect(at(m, 4 * i + 2)).toBe(0);
  });
  it("never exceeds the param and reaches it under the densest coverage", () => {
    const p = 0.55;
    const m = generateWeatherMap(over({ type: "stratus", coverage: 0.95, precipitation: p }));
    const cap = Math.round(p * 255);
    let max = 0;
    for (let i = 0; i < TEXELS; i++) max = Math.max(max, at(m, 4 * i + 2));
    expect(max).toBe(cap);
  });
  it("is concentrated under high coverage: rain only where the field is dense", () => {
    const m = generateWeatherMap(over({ precipitation: 0.55 }));
    for (let i = 0; i < TEXELS; i++) {
      if (at(m, 4 * i + 2) >= 1) expect(at(m, 4 * i)).toBeGreaterThanOrEqual(115);
    }
    expect(countIf(m, 2, (v) => v >= 1)).toBeGreaterThan(0);
  });
  it("falls at full strength inside cumulonimbus cells", () => {
    const p = 0.55;
    const cap = Math.round(p * 255);
    const out = [];
    for (const seed of [1, 2, 3, 4]) {
      const m = generateWeatherMap(over({ type: "cumulonimbus", precipitation: p, seed }));
      let full = 0;
      for (let i = 0; i < TEXELS; i++) if (at(m, 4 * i) >= 250 && at(m, 4 * i + 2) === cap) full++;
      if (full < 1) out.push(`seed ${seed}: no fully-raining core`);
    }
    expect(out).toEqual([]);
  });
});

describe("generateWeatherMap: forcedCell", () => {
  it("plants a dense cumulus cell (coverage ≥ 0.95, type 0.5) at its centre", () => {
    const cell = { u: 80.5 / SIZE, v: 33.5 / SIZE, radius: 0.08 };
    const cu = generateWeatherMap(over({ forcedCell: cell }));
    const st = generateWeatherMap(over({ type: "stratus", coverage: 0.95, forcedCell: cell }));
    expect(ch(cu, 0, 80, 33)).toBe(255);
    expect(ch(st, 0, 80, 33)).toBe(255);
    expect(ch(st, 1, 80, 33)).toBe(Math.round(CLOUD_TYPE_VALUE.cumulus * 255));
    const generic = generateWeatherMap(over({ forcedCell: { u: 0.3, v: 0.62, radius: 0.1 } }));
    expect(ch(generic, 0, 38, 79)).toBeGreaterThanOrEqual(242);
  });
  it("wraps across the map edges (toroidal distance)", () => {
    const plain = generateWeatherMap(over({ seed: 1 }));
    // The clearest texel in the top rows, which only the wrapped lobe of a cell at v = 0.98 can
    // reach: its straight-line distance from the centre is over 0.9 of the map.
    let target = 0;
    for (let i = 0; i < 3 * SIZE; i++) if (at(plain, 4 * i) < at(plain, 4 * target)) target = i;
    expect(at(plain, 4 * target)).toBeLessThanOrEqual(30);
    const u = ((target % SIZE) + 0.5) / SIZE;
    const m = generateWeatherMap(over({ seed: 1, forcedCell: { u, v: 0.98, radius: 0.12 } }));
    expect(ch(m, 0, target % SIZE, (target / SIZE) | 0)).toBeGreaterThanOrEqual(150);
  });
  it("leaves the far side of the map untouched", () => {
    const plain = generateWeatherMap(base);
    const m = generateWeatherMap(over({ forcedCell: { u: 0.02, v: 0.98, radius: 0.12 } }));
    for (let i = 0; i < TEXELS; i++) {
      const x = i % SIZE;
      const y = (i / SIZE) | 0;
      if (x >= 40 && x <= 88 && y >= 40 && y <= 88) expect(at(m, 4 * i)).toBe(at(plain, 4 * i));
    }
  });
  it("treats radius 0 as a point cell (one texel, no NaN bleed)", () => {
    const plain = generateWeatherMap(base);
    const m = generateWeatherMap(over({ forcedCell: { u: 80.5 / SIZE, v: 33.5 / SIZE, radius: 0 } }));
    for (let i = 0; i < TEXELS; i++) {
      const same =
        at(m, 4 * i) === at(plain, 4 * i) &&
        at(m, 4 * i + 1) === at(plain, 4 * i + 1) &&
        at(m, 4 * i + 2) === at(plain, 4 * i + 2);
      if (i === 33 * SIZE + 80) expect(at(m, 4 * i)).toBe(255);
      else expect(same).toBe(true);
    }
  });
});

describe("windVelocity", () => {
  it("from 270 (a west wind) moves the field toward +u (east)", () => {
    const [u, v] = windVelocity(15, 270);
    expect(u).toBeCloseTo(speedAt(15), 9);
    expect(v).toBeCloseTo(0, 9);
  });
  it("maps the other cardinal bearings to their directions", () => {
    expect(windVelocity(15, 90)[0]).toBeCloseTo(-speedAt(15), 9);
    expect(windVelocity(15, 90)[1]).toBeCloseTo(0, 9);
    expect(windVelocity(15, 0)[1]).toBeCloseTo(-speedAt(15), 9);
    expect(windVelocity(15, 180)[1]).toBeCloseTo(speedAt(15), 9);
  });
  it("scales with the wind speed (documented constant included)", () => {
    const [u15] = windVelocity(15, 270);
    const [u30] = windVelocity(30, 270);
    expect(u30).toBeCloseTo(2 * u15, 9);
    expect(WIND_TIMELAPSE).toBeGreaterThan(0);
  });
});

describe("createWeatherMap: the WebGL wrapper", () => {
  type Recorded = { op: string; args: unknown[] };
  const mockGl = () => {
    const calls: Recorded[] = [];
    const gl = {
      TEXTURE_2D: 0x0de1,
      RGBA8: 0x8058,
      RGBA: 0x1908,
      UNSIGNED_BYTE: 0x1401,
      TEXTURE_MIN_FILTER: 0x2801,
      TEXTURE_MAG_FILTER: 0x2800,
      LINEAR: 0x2601,
      TEXTURE_WRAP_S: 0x2802,
      TEXTURE_WRAP_T: 0x2803,
      REPEAT: 0x2901,
      UNPACK_ALIGNMENT: 0x0cf5,
      createTexture: () => ({}) as WebGLTexture,
      deleteTexture: () => undefined,
      bindTexture: () => undefined,
      pixelStorei: () => undefined,
      texImage2D: (...args: unknown[]) => calls.push({ op: "texImage2D", args }),
      texParameteri: (...args: unknown[]) => calls.push({ op: "texParameteri", args }),
    };
    return { gl: gl as unknown as WebGL2RenderingContext, calls, uploads: () => calls.filter((c) => c.op === "texImage2D") };
  };

  it("uploads once as a 128×128 RGBA8 texture with LINEAR filtering and REPEAT wrap", () => {
    const { gl, calls, uploads } = mockGl();
    createWeatherMap(gl, base);
    expect(uploads()).toHaveLength(1);
    const [, , internal, w, h, , format, type] = uploads()[0]!.args as number[];
    expect(internal).toBe(gl.RGBA8);
    expect(w).toBe(WEATHER_MAP_SIZE);
    expect(h).toBe(WEATHER_MAP_SIZE);
    expect(format).toBe(gl.RGBA);
    expect(type).toBe(gl.UNSIGNED_BYTE);
    const params = calls.filter((c) => c.op === "texParameteri").map((c) => `${c.args[1]}=${c.args[2]}`);
    for (const expected of [`${gl.TEXTURE_MIN_FILTER}=${gl.LINEAR}`, `${gl.TEXTURE_MAG_FILTER}=${gl.LINEAR}`, `${gl.TEXTURE_WRAP_S}=${gl.REPEAT}`, `${gl.TEXTURE_WRAP_T}=${gl.REPEAT}`]) {
      expect(params).toContain(expected);
    }
  });
  it("uploads the generator's exact bytes", () => {
    const { gl, uploads } = mockGl();
    createWeatherMap(gl, base);
    const data = uploads()[0]!.args[8] as Uint8Array;
    expect(sameBytes(data, generateWeatherMap(base))).toBe(true);
  });
  it("regenerates only when a field param changes; the wind only scrolls", () => {
    const { gl, uploads } = mockGl();
    const map = createWeatherMap(gl, base);
    expect(uploads()).toHaveLength(1);
    map.setParams({ ...base });
    expect(uploads()).toHaveLength(1);
    map.setParams(over({ coverage: 0.6 }));
    expect(uploads()).toHaveLength(2);
    map.setParams(over({ coverage: 0.6, windKmh: 30 }));
    expect(uploads()).toHaveLength(2);
    expect(map.velocity[0]).toBeCloseTo(speedAt(30), 9);
    map.setParams(over({ coverage: 0.6, forcedCell: { u: 0.5, v: 0.5, radius: 0.1 } }));
    expect(uploads()).toHaveLength(3);
    map.setParams(over({ coverage: 0.6, seed: 2 }));
    expect(uploads()).toHaveLength(4);
  });
  it("starts at offset 0 and advances with the wind, wrapping into [0, 1)", () => {
    const { gl } = mockGl();
    const map = createWeatherMap(gl, base);
    expect(map.offset).toEqual([0, 0]);
    map.update(0);
    expect(map.offset).toEqual([0, 0]);
    map.update(1);
    expect(map.offset[0]).toBeCloseTo(speedAt(15), 9);
    expect(map.offset[1]).toBeCloseTo(0, 9);
    map.update(100000);
    expect(map.offset[0]).toBeGreaterThanOrEqual(0);
    expect(map.offset[0]).toBeLessThan(1);
    expect(map.offset[1]).toBeGreaterThanOrEqual(0);
    expect(map.offset[1]).toBeLessThan(1);
  });
  it("moves toward +u for a west wind and toward −v for a north wind", () => {
    const { gl } = mockGl();
    const west = createWeatherMap(gl, base);
    west.update(1);
    expect(west.offset[0]).toBeGreaterThan(0);
    expect(west.offset[1]).toBeCloseTo(0, 9);
    const north = createWeatherMap(gl, over({ windFromDeg: 0 }));
    north.update(1);
    expect(north.offset[1]).toBeCloseTo(1 - speedAt(15), 9);
    expect(north.offset[0]).toBeCloseTo(0, 9);
  });
});
