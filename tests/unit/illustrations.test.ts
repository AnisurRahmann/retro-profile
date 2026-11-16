import { describe, expect, it } from "vitest";
import { ciede2000, hexToRgb, rgbToLab } from "../../scripts/illustrations/color";
import { contactOverlay } from "../../scripts/illustrations/contact";
import { key } from "../../scripts/illustrations/key";
import { assetMeta, manifestModule, pathsModule } from "../../scripts/illustrations/manifest";
import { nameParts, partsMapSchema } from "../../scripts/illustrations/name";
import { optimise } from "../../scripts/illustrations/optimise";
import { snap, snapColour } from "../../scripts/illustrations/snap";
import { extract, split } from "../../scripts/illustrations/split";
import { countNodes, planLayers, trace, transformPath } from "../../scripts/illustrations/trace";
import { potraceTracer } from "../../scripts/illustrations/tracers";
import { PALETTE, PALETTE_NAMES, type PaletteName, type Raster } from "../../scripts/illustrations/types";
import { a02 } from "@/illustrations/generated/a02";
import { manifest } from "@/illustrations/generated/manifest";
import { illustrationManifestSchema, PALETTE_CLASSES } from "@/schema";

// ── fixture: a small sheet painted by hand ───────────────────

type Colour = readonly [number, number, number];
const MAGENTA: Colour = [255, 0, 255];
const IRON = hexToRgb(PALETTE.iron);
const RED = hexToRgb(PALETTE.red);
const BLUE = hexToRgb(PALETTE.blue);

function canvas(width: number, height: number, fill: Colour, noise = 0): Raster {
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    // deterministic compression-like noise
    const wobble = noise ? ((i * 7919) % (2 * noise + 1)) - noise : 0;
    data[i * 4] = Math.min(255, Math.max(0, fill[0] + wobble));
    data[i * 4 + 1] = Math.min(255, Math.max(0, fill[1] + Math.abs(wobble)));
    data[i * 4 + 2] = Math.min(255, Math.max(0, fill[2] + wobble));
    data[i * 4 + 3] = 255;
  }
  return { width, height, data };
}

function rect(raster: Raster, x: number, y: number, w: number, h: number, colour: Colour): void {
  for (let row = y; row < y + h; row += 1) {
    for (let col = x; col < x + w; col += 1) {
      const i = (row * raster.width + col) * 4;
      raster.data[i] = colour[0];
      raster.data[i + 1] = colour[1];
      raster.data[i + 2] = colour[2];
    }
  }
}

const mix = (a: Colour, b: Colour, t: number): Colour => [a[0] * (1 - t) + b[0] * t, a[1] * (1 - t) + b[1] * t, a[2] * (1 - t) + b[2] * t];

/** 100 x 60 sheet: a red part and a blue part with iron outlines, an anti-aliased ring round the first, and one speck. */
function sheet(): Raster {
  const raster = canvas(100, 60, MAGENTA, 6);
  rect(raster, 59, 9, 32, 32, mix(MAGENTA, IRON, 0.5)); // blended edge ring
  rect(raster, 60, 10, 30, 30, IRON);
  rect(raster, 64, 14, 22, 22, RED);
  rect(raster, 10, 12, 30, 30, IRON);
  rect(raster, 14, 16, 22, 22, BLUE);
  rect(raster, 50, 50, 1, 1, IRON); // speck
  return raster;
}

const alphaAt = (raster: Raster, x: number, y: number) => raster.data[(y * raster.width + x) * 4 + 3]!;

describe("colour maths", () => {
  it("matches the CIEDE2000 reference pairs", () => {
    expect(ciede2000([50, 2.6772, -79.7751], [50, 0, -82.7485])).toBeCloseTo(2.0425, 3);
    expect(ciede2000([50, 2.5, 0], [73, 25, -18])).toBeCloseTo(27.1492, 3);
    expect(ciede2000([60.2574, -34.0099, 36.2677], [60.4626, -34.1751, 39.4387])).toBeCloseTo(1.2644, 3);
  });

  it("converts sRGB white to L 100", () => {
    const [l, a, b] = rgbToLab([255, 255, 255]);
    expect(l).toBeCloseTo(100, 1);
    expect(Math.abs(a) + Math.abs(b)).toBeLessThan(0.1);
  });
});

describe("a. key", () => {
  it("removes noisy magenta, keeps the parts and softens the blended edge", () => {
    const { image, background } = key(sheet());
    expect(background).toBeGreaterThan(0.6);
    expect(alphaAt(image, 2, 2)).toBe(0);
    expect(alphaAt(image, 75, 25)).toBe(255);
    expect(alphaAt(image, 25, 25)).toBe(255);
    const edge = alphaAt(image, 59, 20);
    expect(edge).toBeGreaterThan(0);
    expect(edge).toBeLessThan(255);
  });

  it("despills the edge toward the outline colour", () => {
    const { image } = key(sheet());
    const i = (20 * 100 + 59) * 4;
    // the source pixel is half magenta: after despill, red and blue no longer tower over green
    expect(image.data[i]! - image.data[i + 1]!).toBeLessThan(40);
    expect(image.data[i + 2]! - image.data[i + 1]!).toBeLessThan(40);
  });

  it("fails loudly when there is too little or too much background", () => {
    expect(() => key(canvas(40, 40, MAGENTA))).toThrow(/100\.0% of the canvas is background/);
    expect(() => key(canvas(40, 40, RED))).toThrow(/0\.0% of the canvas is background/);
  });
});

describe("b. split", () => {
  it("finds the parts in reading order and drops specks", () => {
    const { components, dropped } = split(key(sheet()).image);
    expect(components).toHaveLength(2);
    expect(dropped).toBe(1);
    expect(components[0]!.box.x).toBeLessThan(components[1]!.box.x);
    expect(components.map((component) => component.index)).toEqual([0, 1]);
  });

  it("joins diagonal neighbours (8-connectivity) and orders rows before columns", () => {
    const raster = canvas(40, 40, MAGENTA);
    rect(raster, 22, 2, 6, 6, IRON); // top right
    rect(raster, 28, 8, 6, 6, IRON); // touches the first at a corner only
    rect(raster, 4, 26, 8, 8, IRON); // bottom left
    const { components } = split(key(raster, { minBackground: 0, maxBackground: 1 }).image);
    expect(components).toHaveLength(2);
    expect(components[0]!.area).toBe(72);
    expect(components[1]!.box).toEqual({ x: 4, y: 26, w: 8, h: 8 });
  });

  it("extracts one part with padding and nothing of its neighbours", () => {
    const keyed = key(sheet()).image;
    const { labels, components } = split(keyed);
    const { raster, box } = extract(keyed, labels, [components[0]!]);
    expect(box).toEqual({ x: 8, y: 10, w: 34, h: 34 });
    expect(alphaAt(raster, 17, 17)).toBe(255);
    expect(alphaAt(raster, 0, 0)).toBe(0);
  });

  it("draws every index on the contact sheet", () => {
    const { components } = split(key(sheet()).image);
    const overlay = contactOverlay(100, 60, components);
    expect(overlay).toContain(">0</text>");
    expect(overlay).toContain(">1</text>");
  });
});

describe("c. name", () => {
  const components = split(key(sheet()).image).components;
  const base = { asset: "a99", source: "a99-test.png" };

  it("names, ignores and groups components", () => {
    const named = nameParts(components, partsMapSchema.parse({ ...base, components: 2, parts: { "0": { name: "blue", pivot: [0.5, 1], z: 2 }, "1": { ignore: "spare" } } }));
    expect(named.map((part) => part.name)).toEqual(["blue"]);
    const grouped = nameParts(components, partsMapSchema.parse({ ...base, components: 2, parts: { "0": { name: "pair", pivot: [0, 0], z: 1 }, "1": { name: "pair", pivot: [0, 0], z: 1 } } }));
    expect(grouped).toHaveLength(1);
    expect(grouped[0]!.components).toHaveLength(2);
  });

  it("stops when the sheet and the map disagree", () => {
    expect(() => nameParts(components, partsMapSchema.parse({ ...base, components: 3, parts: {} }))).toThrow(/split into 2 components, the map expects 3/);
    expect(() => nameParts(components, partsMapSchema.parse({ ...base, components: 2, parts: { "0": { ignore: "x" } } }))).toThrow(/Unmapped components: \[1\]/);
  });

  it("rejects a map with unknown fields", () => {
    expect(() => partsMapSchema.parse({ ...base, components: 1, parts: { "0": { name: "x", pivot: [0, 0], z: 1, extra: true } } })).toThrow();
  });
});

describe("e. snap", () => {
  it("maps drifted colours to the nearest palette colour", () => {
    expect(snapColour(200, 50, 45).cls).toBe("red");
    expect(snapColour(36, 37, 40).cls).toBe("iron");
    expect(snapColour(240, 238, 230).cls).toBe("chalk");
    expect(snapColour(...(hexToRgb(PALETTE.skin) as [number, number, number])).distance).toBeCloseTo(0, 5);
  });

  it("classifies a keyed part and dissolves blended rims", () => {
    const keyed = key(sheet()).image;
    const { labels, components } = split(keyed);
    const { raster } = extract(keyed, labels, [components[1]!]);
    const { classes, far } = snap(raster);
    const present = new Set([...classes].filter((value) => value !== 0).map((value) => PALETTE_NAMES[value - 1]));
    expect([...present].sort()).toEqual(["iron", "red"]);
    expect(far).toEqual([]);
  });

  it("reports a colour that is far from the whole palette instead of hiding it", () => {
    const raster = canvas(40, 40, [255, 105, 180]); // hot pink: not a palette colour
    const { far } = snap(raster);
    expect(far).toHaveLength(1);
    expect(far[0]!.share).toBeGreaterThan(0.5);
    expect(far[0]!.distance).toBeGreaterThan(22);
  });
});

describe("d. trace", () => {
  const classOf = (name: PaletteName) => PALETTE_NAMES.indexOf(name) + 1;
  function classMap(): { classes: Uint8Array; size: number } {
    const size = 60;
    const classes = new Uint8Array(size * size);
    for (let y = 6; y < 54; y += 1) for (let x = 6; x < 54; x += 1) classes[y * size + x] = classOf("iron");
    for (let y = 12; y < 48; y += 1) for (let x = 12; x < 48; x += 1) classes[y * size + x] = classOf("red");
    for (let y = 24; y < 36; y += 1) for (let x = 24; x < 36; x += 1) classes[y * size + x] = classOf("chalk");
    return { classes, size };
  }

  it("stacks the outline silhouette first, then fills from large to small", () => {
    const { classes, size } = classMap();
    const layers = planLayers(classes, size, size, { minArea: 10 });
    expect(layers.map((layer) => layer.cls)).toEqual(["iron", "red", "chalk"]);
    // the silhouette is the whole part, so the outline is one closed shape under the fills
    expect(layers[0]!.mask.reduce((sum, value) => sum + value, 0)).toBe(48 * 48);
    // the red fill runs under the chalk fill on top of it: no seam between the two
    expect(layers[1]!.mask[24 * size + 24]).toBe(1);
    expect(layers[1]!.mask[30 * size + 30]).toBe(0);
  });

  it("vectorises the layers with potrace", async () => {
    const { classes, size } = classMap();
    const layers = await trace(classes, size, size, potraceTracer, { minArea: 10 });
    expect(layers).toHaveLength(3);
    for (const layer of layers) {
      expect(layer.d).toMatch(/^M/);
      expect(countNodes(layer.d)).toBeGreaterThan(3);
    }
  });

  it("rescales path data and refuses commands it does not know", () => {
    expect(transformPath("M 30 60 C 3 6, 9 12, 15 18 L 0 0 Z", 1 / 3)).toBe("M 10 20 C 1 2 3 4 5 6 L 0 0 Z");
    expect(transformPath("M0 0L3 3", 2, 1, 2)).toBe("M 2 4 L 8 10");
    expect(() => transformPath("M 0 0 a 1 1 0 0 0 2 2", 1)).toThrow(/unsupported/);
  });
});

describe("f. optimise", () => {
  it("keeps classes and the viewBox, strips ids, rounds to one decimal", () => {
    const part = optimise(
      [
        { cls: "iron", d: "M 0 0 L 20.123 0 L 20.123 10.456 L 0 10.456 Z" },
        { cls: "red", d: "M 2.02 2.02 L 18.07 2.02 L 18.07 8.04 L 2.02 8.04 Z" },
      ],
      21,
      11,
    );
    expect(part.viewBox).toBe("0 0 21 11");
    expect(part.svg).toContain('viewBox="0 0 21 11"');
    expect(part.svg).not.toMatch(/\bid=|<style|fill="#/);
    expect(part.paths.map(([cls]) => cls)).toEqual(["i-iron", "i-red"]);
    for (const [, d] of part.paths) expect(d).not.toMatch(/\.\d{2,}/);
    expect(part.bytes).toBe(Buffer.byteLength(part.svg));
  });
});

describe("g. manifest", () => {
  const part = { name: "plate", viewBox: "0 0 10 10", width: 10, height: 10, origin: [3, 4] as [number, number], pivot: [0.5, 0.5] as [number, number], z: 1, bytes: 40 };

  it("writes modules the schema accepts", () => {
    const meta = assetMeta("a99", "a99-test.png", "svg", [part], ["<svg/>"]);
    expect(meta.bytes).toBe(6);
    const source = manifestModule([meta]);
    const json = JSON.parse(source.slice(source.indexOf("parse(") + 6, source.lastIndexOf(")")));
    expect(illustrationManifestSchema.parse(json).a99!.parts[0]!.name).toBe("plate");
    expect(pathsModule("a99", [{ name: "plate", paths: [["i-red", "M0 0"]] }])).toContain('"plate": [\n    ["i-red", "M0 0"],');
  });

  it("the schema rejects a broken manifest", () => {
    expect(() => illustrationManifestSchema.parse({ a99: { id: "a99", source: "x", format: "svg", bytes: 1, gzipBytes: 1, parts: [] } })).toThrow();
    expect(() => illustrationManifestSchema.parse({ a99: { id: "a99", source: "x", format: "svg", bytes: 1, gzipBytes: 1, parts: [{ ...part, viewBox: "1 1 10 10" }] } })).toThrow();
  });

  it("the committed manifest has the rack and the character, inside the size budget", () => {
    expect(Object.keys(manifest).sort()).toEqual(["a01b", "a02"]);
    const rack = manifest.a02!;
    expect(rack.parts).toHaveLength(17);
    for (const colour of ["red", "blue", "yellow", "green", "chalk", "iron"]) {
      expect(rack.parts.some((entry) => entry.name === `plate-side-${colour}`)).toBe(true);
    }
    expect(manifest.a01b!.parts.map((entry) => entry.name)).toEqual(expect.arrayContaining(["pose-idle", "pose-wave", "pose-chalk", "puff-a", "puff-b"]));
    for (const asset of Object.values(manifest)) {
      expect(asset.format).toBe("svg");
      expect(asset.gzipBytes).toBeLessThan(40 * 1024);
    }
    const total = Object.values(manifest).reduce((sum, asset) => sum + asset.gzipBytes, 0);
    expect(total).toBeLessThan(250 * 1024);
  });

  it("every committed path uses a palette class and nothing else", () => {
    for (const [name, layers] of Object.entries(a02)) {
      expect(layers.length, name).toBeGreaterThan(0);
      expect(layers[0]![0], name).toBe("i-iron");
      for (const [cls] of layers) expect(PALETTE_CLASSES).toContain(cls);
    }
  });
});
