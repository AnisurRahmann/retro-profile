import { describe, expect, it } from "vitest";
import { createCloudField } from "@/components/sky/cloud-field";
import {
  CELLS_PER_UNIT,
  EDGE,
  FOCAL,
  NOISE_SIZE,
  PLANE_SPEED,
  SHEET,
  SHEETS,
  STRATUS,
  V_MIN,
  cellData,
  cloudPlan,
  depthK,
  lod,
  noiseData,
  planePoint,
  planeWind,
  type SheetId,
} from "@/lib/sky/clouds";
import { WX_DEFAULTS } from "@/lib/sky/store";

// The home page's sky on a 1440×900 desktop, the fixed band on (the far hills' skyline is the clouds' horizon).
const VW = 1440;
const HZ = 780;
/** The sheet under a CSS pixel. */
const point = (sheet: SheetId, x: number, y: number) => planePoint(x, y, sheet, VW, HZ, 1);

describe("cloud sheets in perspective", () => {
  it("look straight up at the top of the sky and farther the lower they are, never closer to the horizon than V_MIN", () => {
    const top = point("low", 720, 0);
    expect(top.v).toBe(1);
    expect(top.s).toBe(0);
    expect(top.x).toBe(0);
    const low = point("low", 720, 500);
    expect(low.v).toBeCloseTo((HZ - 500) / HZ, 10);
    expect(low.s).toBeGreaterThan(0);
    // Under the horizon line the sheet is still finite (clamped), so nothing ever divides by zero.
    const under = point("low", 720, HZ + 400);
    expect(under.v).toBe(V_MIN);
    expect(Number.isFinite(under.s)).toBe(true);
  });

  it("reads a sheet the same way along both axes: a cloud keeps its proportions at every distance", () => {
    for (const y of [80, 240, 420, 640])
      for (const sheet of SHEETS) {
        const here = point(sheet, 700, y);
        const right = point(sheet, 701, y);
        const down = point(sheet, 700, y + 1);
        // One CSS px to the right is as far on the sheet as one CSS px up the screen.
        // (to half a percent: one pixel is a chord of a curve)
        expect((right.x - here.x) / (down.s - here.s)).toBeCloseTo(1, 2);
        // … and that is the footprint the octaves are chosen for.
        expect(here.fp / (right.x - here.x)).toBeCloseTo(1, 2);
      }
  });

  it("shrinks a cloud toward the horizon: the noise under one pixel grows with the distance", () => {
    const near = point("low", 720, 60);
    const far = point("low", 720, 700);
    expect(far.fp / near.fp).toBeGreaterThan(4);
    // HIGH is 5.6× higher, so the same pixel sees more of it at once.
    expect(point("high", 720, 300).fp / point("low", 720, 300).fp).toBeCloseTo((SHEET.high.h * SHEET.high.freq) / (SHEET.low.h * SHEET.low.freq), 6);
  });

  it("keeps each sheet's height: the same pixel sees a high sheet farther than a low one", () => {
    const v = (HZ - 300) / HZ;
    for (const sheet of SHEETS) {
      const z = SHEET[sheet].h / v;
      expect(point(sheet, 1440, 300).x).toBeCloseTo((0.5 * VW * z * SHEET[sheet].freq) / (FOCAL * VW), 6);
    }
    expect(depthK(VW, HZ)).toBeCloseTo(HZ / (FOCAL * VW), 12);
  });
});

describe("wind on the cloud planes", () => {
  const k = depthK(VW, HZ);

  it("blows away from where it comes from: a west wind to screen-left, an east wind to screen-right", () => {
    expect(planeWind(15, 270, "low", k)[0]).toBeLessThan(0); // the viewer faces south, so east is left
    expect(planeWind(15, 270, "low", k)[1]).toBeCloseTo(0, 12);
    expect(planeWind(15, 90, "low", k)[0]).toBeGreaterThan(0);
  });

  it("has a north wind recede and a south wind come on, straight ahead", () => {
    const north = planeWind(15, 0, "low", k);
    const south = planeWind(15, 180, "low", k);
    expect(north[0]).toBeCloseTo(0, 12);
    expect(north[1]).toBeGreaterThan(0); // depth is read away from the viewer
    expect(south[0]).toBeCloseTo(0, 12);
    expect(south[1]).toBeLessThan(0);
    expect(north[1]).toBeCloseTo(-south[1], 12);
  });

  it("moves the sheets at their own speeds: LOW 1, MID 0.6, HIGH 0.3, SCUD 1.6", () => {
    const base = PLANE_SPEED * 15;
    for (const sheet of SHEETS) {
      const [x] = planeWind(15, 270, sheet, k);
      expect(x).toBeCloseTo(-base * SHEET[sheet].speed, 12);
    }
    // The offset is integrated on the CPU, never wrapped: the rotated octaves, the warp and the Worley cells share
    // no period, so a wrap would jump the field. The fastest sheet (SCUD at 40 km/h) plays for 40 hours before a
    // float32 stops placing it to a texel of the 256-wide noise; LOW and HIGH for days.
    const scud = Math.abs(planeWind(40, 270, "scud", k)[0]) * SHEET.scud.freq;
    expect(2 ** 15 / scud).toBeGreaterThan(40 * 3600);
    const low = Math.abs(planeWind(40, 270, "low", k)[0]) * SHEET.low.freq;
    expect(2 ** 15 / low).toBeGreaterThan(4 * 24 * 3600);
  });

  it("never stops in calm air (a 6 km/h floor) and grows with the wind", () => {
    expect(planeWind(0, 270, "low", k)[0]).toBe(planeWind(6, 270, "low", k)[0]);
    expect(planeWind(30, 270, "low", k)[0]).toBeCloseTo(2 * planeWind(15, 270, "low", k)[0], 12);
  });
});

describe("what a condition draws", () => {
  const at = (condition: Parameters<typeof cloudPlan>[0]) => cloudPlan(condition, WX_DEFAULTS[condition].cloudCover, WX_DEFAULTS[condition].cloudCover);

  it("gives each condition its coverage of HIGH, MID, LOW and SCUD", () => {
    expect(at("clear").cover).toEqual([0.15, 0, 0, 0]);
    expect(at("partly").cover).toEqual([0.25, 0.25, 0.45, 0]);
    expect(at("overcast").cover).toEqual([0, 0.6, 0.98, 0]);
    expect(at("drizzle").cover).toEqual([0, 0, 0.9, 0]);
    for (const c of ["rain", "heavy-rain", "thunder"] as const) {
      expect(at(c).cover.slice(0, 3)).toEqual([0, 0, 1]);
      expect(at(c).cover[3]).toBeGreaterThan(0); // scud under every rain deck
    }
    expect(at("fog").cover).toEqual([0, 0, 0, 0]);
  });

  it("follows the real cloud cover from the condition's own", () => {
    const typical = WX_DEFAULTS.overcast.cloudCover;
    expect(cloudPlan("overcast", typical * 0.5, typical).cover[1]).toBeCloseTo(0.3, 10);
    expect(cloudPlan("partly", 1, typical).cover[2]).toBeLessThanOrEqual(1);
    // A clear sky stays clear however humid the hour is.
    expect(cloudPlan("clear", 1, WX_DEFAULTS.clear.cloudCover).cover[2]).toBe(0);
  });

  it("shapes the LOW sheet: puffy cumulus, a flat stratus deck, towering cumulonimbus", () => {
    expect(at("partly").billow).toBe(0.6);
    expect(at("thunder")).toMatchObject({ billow: 1, warp: 1 });
    for (const c of ["overcast", "drizzle"] as const) expect(at(c)).toMatchObject({ billow: 0.2, stratus: 1, warp: 0.6 });
    expect(at("partly").stratus).toBe(0);
  });

  it("keeps every sheet's most opaque alpha and the stratus deck's opacity above a cumulus edge's", () => {
    expect(SHEET.high.alpha).toBeLessThanOrEqual(0.35);
    expect(SHEET.mid.alpha).toBeLessThanOrEqual(0.6);
    expect(SHEET.low.alpha).toBeLessThanOrEqual(0.95);
    expect(STRATUS.opaque).toBeGreaterThan(0.8);
    expect(STRATUS.floor).toBeLessThan(STRATUS.opaque);
    expect(STRATUS.edge).toBeGreaterThan(EDGE);
  });
});

describe("level of detail and the noise textures", () => {
  it("drops an octave once its wavelength is under about two pixels", () => {
    expect(lod(0)).toBe(1);
    expect(lod(0.3)).toBeCloseTo(0.75, 12);
    expect(lod(0.6)).toBe(0);
    expect(lod(0.3, 1)).toBe(0); // the second octave, twice as fine, is gone at the same footprint
  });

  it("seeds both textures: the same sky on every load, and one that tiles", () => {
    const a = noiseData();
    const b = noiseData();
    expect(a).toBe(b);
    expect(a).toHaveLength(NOISE_SIZE * NOISE_SIZE * 4);
    expect(new Set(a).size).toBeGreaterThan(200);
    const cells = cellData();
    expect(cells).toHaveLength(NOISE_SIZE * NOISE_SIZE * 4);
    // The vector to a cell's centre never reaches the next cell over (|v| < 1), and its mean is the centre.
    let mean = 0;
    for (let i = 1; i < cells.length; i += 4) mean += Math.abs(cells[i]! / 255 - 0.5);
    expect(mean / (cells.length / 4)).toBeLessThan(0.25);
    for (let i = 1; i < cells.length; i += 4) {
      expect(Math.abs(cells[i]! / 255 - 0.5)).toBeLessThan(0.5);
      expect(Math.abs(cells[i + 1]! / 255 - 0.5)).toBeLessThan(0.5);
    }
    // Enough cells to the noise unit for a puffy edge.
    expect(CELLS_PER_UNIT.low).toBeGreaterThan(CELLS_PER_UNIT.mid * 0.9);
  });
});

describe("the CPU cloud field", () => {
  const field = createCloudField();
  field.resize(VW, 900);
  const sheets = Object.fromEntries(SHEETS.map((s) => [s, { x: 0, z: 0, evo: 0 }])) as Record<SheetId, { x: number; z: number; evo: number }>;
  const update = (cover: number, stratus = 0, shift = 0) =>
    field.update({
      sheets: { high: sheets.high, mid: sheets.mid, scud: sheets.scud, low: { x: shift * 37.31, z: shift * 61.77, evo: 0 } },
      cover: { high: 0, mid: 0, low: cover, scud: 0 },
      billow: stratus ? 0.2 : 0.6,
      warp: 0.6,
      stratus,
      fog: 0,
      wind: [1, 0],
      vw: VW,
      cloudHz: HZ,
      px: 0.5,
    });
  /**
   * The share of the open sky (above the haze band) under cloud, averaged over where the wind has left the sheet:
   * one viewport holds only a few dozen cumulus, so one view of it can be a tenth off either way.
   */
  const coverOver = (cover: number, stratus = 0, least = false) => {
    let n = 0;
    let under = 0;
    let low = 1;
    for (let v = 0; v < 16; v++) {
      update(cover, stratus, v);
      for (let i = 0; i < 400; i++) {
        // A low-discrepancy scatter over the open sky, so it isn't on a lattice.
        const x = (((i * 0.6180339887) % 1) * VW);
        const y = (((i * 0.7548776662) % 1) * HZ * 0.9);
        const d = field.at(x, y) / SHEET.low.alpha;
        n++;
        if (d > 0.5) under++;
        if (d > 0) low = Math.min(low, d);
      }
    }
    return least ? low : under / n;
  };

  it("means what its coverage says: 45% of a partly sky is under cumulus", () => {
    const cover = coverOver(0.45);
    expect(cover).toBeGreaterThan(0.4);
    expect(cover).toBeLessThan(0.5);
    expect(coverOver(0.2)).toBeLessThan(cover);
    expect(coverOver(0.8)).toBeGreaterThan(cover);
  });

  it("keeps the stratus deck opaque where it is thin (no blue sky through it)", () => {
    expect(coverOver(0.98, 1)).toBeGreaterThan(0.95);
    expect(coverOver(0.98, 1, true)).toBeGreaterThanOrEqual(STRATUS.opaque - 1e-6);
    expect(coverOver(0.98, 0, true)).toBeLessThan(STRATUS.opaque * 0.5);
  });

  it("carries no cloud under the horizon line and none at zero coverage", () => {
    update(0);
    expect(field.at(700, 300)).toBe(0);
    update(0.45);
    expect(field.at(700, HZ + 20)).toBe(0);
    expect(field.tau(700, HZ + 20)).toBe(0);
  });
});
