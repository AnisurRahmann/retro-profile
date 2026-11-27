/** The lab's URL state (owner T3, review params T9): defaults, clamping and the parse ↔ serialise round trip. */
import { describe, expect, expectTypeOf, it } from "vitest";
import { LAB_DEFAULTS, LAB_PRESETS, type LabState } from "@/components/sky/volumetric/types";
import {
  ACCUM_MAX,
  SCALE_RANGE,
  REVIEW_DEFAULTS,
  type LabStateResolved,
  parseLabState,
  presetState,
  serialiseLabState,
} from "@/lib/sky/volumetric/lab-state";

/** The complete default state: LAB_DEFAULTS plus the review params' defaults (they are optional on the type). */
const DEFAULTS = { ...LAB_DEFAULTS, ...REVIEW_DEFAULTS };
const roundTrip = (s: LabState) => parseLabState(serialiseLabState(s));
const parseOne = (query: string): Partial<LabStateResolved> =>
  Object.fromEntries(Object.entries(parseLabState(query)).filter(([k, v]) => v !== DEFAULTS[k as keyof LabState]));

describe("parseLabState", () => {
  it("defaults to state A from the brief", () => {
    expect(parseLabState("")).toEqual(DEFAULTS);
    expect(DEFAULTS).toEqual({ ...DEFAULTS, ...LAB_PRESETS.A });
  });

  it("reads every field", () => {
    const s = parseLabState(
      "?date=2026-12-21&t=16:45&cov=0.4&type=stratus&wind=10&from=300&precip=0.25&tier=auto" +
        "&sunAz=250&sunEl=3&cloudAtSun=edge&freeze=1&seed=7&view=190&debug=density" +
        "&scale=0.6&reproject=0&accum=64&out=layered",
    );
    expect(s).toEqual({
      ...DEFAULTS,
      date: "2026-12-21",
      t: "16:45",
      cov: 0.4,
      type: "stratus",
      wind: 10,
      from: 300,
      precip: 0.25,
      tier: "auto",
      sunAz: 250,
      sunEl: 3,
      cloudAtSun: "edge",
      freeze: true,
      seed: 7,
      view: 190,
      debug: "density",
      scale: 0.6,
      reproject: 0,
      accum: 64,
      out: "layered",
    });
  });

  it("clamps to the documented ranges", () => {
    const s = parseOne("cov=2&wind=99&from=400&precip=-1&sunAz=380&sunEl=-95&view=720");
    expect(s).toEqual({ cov: 1, wind: 60, from: 359, sunAz: 359, sunEl: -90, view: 359 });
    expect(parseOne("cov=-0.5&wind=-10")).toEqual({ cov: 0, wind: 0 });
    expect(parseLabState("?precip=-1").precip).toBe(0); // the clamp, not the default, wins
  });

  it("clamps the review params: scale 0.25–1, accum 0–256", () => {
    expect(parseOne("scale=2&accum=999")).toEqual({ scale: 1, accum: 256 });
    expect(parseOne("scale=0.1&accum=-40")).toEqual({ scale: 0.25 }); // accum clamps to 0, which is the default
    expect(parseOne("accum=-40")).toEqual({});
    expect(parseOne("scale=0.25&accum=256")).toEqual({ scale: 0.25, accum: 256 }); // the ends are in range
    expect(parseOne("scale=1")).toEqual({ scale: 1 });
    expect(parseLabState("?accum=300").accum).toBe(256); // clamped, not the default
    expect(SCALE_RANGE).toEqual({ min: 0.25, max: 1 });
    expect(ACCUM_MAX).toBe(256);
  });

  it("falls back to the default on malformed values", () => {
    expect(parseOne("cov=abc&wind=&type=nimbus&tier=fast")).toEqual({});
    expect(parseOne("t=9:07")).toEqual({}); // the clock format is strictly HH:MM
    expect(parseOne("t=25:99")).toEqual({});
    expect(parseOne("date=2026-02-30")).toEqual({}); // 2026 is not a leap year
    expect(parseOne("date=2026-13-01")).toEqual({});
    expect(parseOne("date=2026-2-3")).toEqual({});
    expect(parseOne("date=2024-02-29")).toEqual({ date: "2024-02-29" }); // a real leap day
    expect(parseOne("sunAz=&sunEl=&view=")).toEqual({});
  });

  it("falls back to the review params' defaults on malformed values", () => {
    expect(parseOne("scale=abc&out=both&reproject=true&accum=64 frames")).toEqual({});
    expect(parseOne("scale=")).toEqual({}); // empty is null: the tier's scale
    expect(parseOne("scale=NaN&accum=Infinity")).toEqual({});
  });

  it("accepts negative, fractional and boundary numbers", () => {
    expect(parseOne("sunEl=-12.5")).toEqual({ sunEl: -12.5 });
    expect(parseOne("precip=1.0001")).toEqual({ precip: 1 });
    expect(parseOne("from=270.5")).toEqual({ from: 270.5 }); // fractional bearings are in range
    expect(parseOne("from=359.9")).toEqual({ from: 359 });
    expect(parseOne("scale=0.375")).toEqual({ scale: 0.375 }); // scale stays fractional
  });

  it("seeds are integers", () => {
    expect(parseOne("seed=7.9")).toEqual({ seed: 7 });
    expect(parseOne("seed=-3")).toEqual({ seed: -3 });
    expect(parseOne("seed=1e9")).toEqual({ seed: 1e9 });
    expect(parseOne("seed=1e12")).toEqual({ seed: 0x7fff_ffff }); // clamped to int32
  });

  it("freeze is 0/1 only", () => {
    expect(parseOne("freeze=1")).toEqual({ freeze: true });
    expect(parseOne("freeze=0")).toEqual({});
    expect(parseOne("freeze=true")).toEqual({});
  });

  it("cloudAtSun takes 0, 1, edge and cover (M1 F1)", () => {
    expect(parseOne("cloudAtSun=0")).toEqual({});
    expect(parseOne("cloudAtSun=1")).toEqual({ cloudAtSun: "cover" });
    expect(parseOne("cloudAtSun=cover")).toEqual({ cloudAtSun: "cover" });
    expect(parseOne("cloudAtSun=edge")).toEqual({ cloudAtSun: "edge" });
    expect(parseOne("cloudAtSun=2")).toEqual({});
  });

  it("accum is an integer, truncated toward zero", () => {
    expect(parseOne("accum=64.9")).toEqual({ accum: 64 });
    expect(parseOne("accum=1e2")).toEqual({ accum: 100 });
  });

  it("reproject is 0 only when asked for; 1 is the default", () => {
    expect(parseOne("reproject=0")).toEqual({ reproject: 0 });
    expect(parseOne("reproject=1")).toEqual({});
    expect(parseOne("reproject=")).toEqual({});
    expect(parseOne("reproject=false&reproject=0")).toEqual({}); // URLSearchParams.get keeps the first value
    expect(parseOne("reproject=0&reproject=1")).toEqual({ reproject: 0 });
  });

  it("out is single or layered, single by default", () => {
    expect(parseOne("out=layered")).toEqual({ out: "layered" });
    expect(parseOne("out=single")).toEqual({});
    expect(parseOne("out=Layered")).toEqual({}); // case-sensitive, like the other enums
    expect(parseOne("out=")).toEqual({});
  });

  it("ignores unknown parameters", () => {
    expect(parseOne("?foo=bar&cov=0.5")).toEqual({ cov: 0.5 });
    expect(parseOne("?foo=bar")).toEqual({});
  });

  it("presetState is the acceptance URL of each state", () => {
    expect(presetState("A")).toEqual({ ...LAB_DEFAULTS, ...REVIEW_DEFAULTS, ...LAB_PRESETS.A });
    expect(presetState("B")).toEqual({ ...LAB_DEFAULTS, ...REVIEW_DEFAULTS, ...LAB_PRESETS.B });
    expect(presetState("C")).toEqual({ ...LAB_DEFAULTS, ...REVIEW_DEFAULTS, ...LAB_PRESETS.C });
    expect(presetState("B").cloudAtSun).toBe("edge");
    for (const p of ["A", "B", "C"] as const) expect(presetState(p)).toMatchObject(REVIEW_DEFAULTS);
  });

  it("always sets the review params (they are optional on the type only)", () => {
    expectTypeOf(parseLabState("")).toEqualTypeOf<LabStateResolved>();
    expectTypeOf(parseLabState("").scale).toEqualTypeOf<number | null>();
    expectTypeOf(parseLabState("").reproject).toEqualTypeOf<0 | 1>();
    expectTypeOf(presetState("A").out).toEqualTypeOf<"single" | "layered">();
    expect(Object.keys(parseLabState("?foo=1")).sort()).toEqual(Object.keys(DEFAULTS).sort());
  });
});

describe("serialiseLabState", () => {
  it("writes every field, empty for null and 0/1 for booleans", () => {
    expect(serialiseLabState(DEFAULTS)).toBe(
      "date=2026-12-15&t=11%3A00&cov=0.38&type=cumulus&wind=15&from=270&precip=0" +
        "&tier=high&sunAz=&sunEl=&cloudAtSun=0&freeze=0&seed=1&view=&debug=" +
        "&scale=&reproject=1&accum=0&out=single",
    );
  });

  it("writes a literal without the review params exactly like the defaults", () => {
    // LAB_DEFAULTS predates them, so the fields may be absent: that serialises as the default.
    expect(serialiseLabState(LAB_DEFAULTS)).toBe(serialiseLabState(DEFAULTS));
  });

  it("encodes cloudAtSun as 0/1/edge", () => {
    expect(serialiseLabState({ ...DEFAULTS, cloudAtSun: "cover" })).toContain("cloudAtSun=1");
    expect(serialiseLabState({ ...DEFAULTS, cloudAtSun: "edge" })).toContain("cloudAtSun=edge");
  });

  it("encodes the review params", () => {
    expect(serialiseLabState({ ...DEFAULTS, scale: 1, reproject: 0, accum: 64, out: "layered" })).toContain(
      "&scale=1&reproject=0&accum=64&out=layered",
    );
    expect(serialiseLabState({ ...DEFAULTS, scale: null })).toContain("&scale=&reproject=1&accum=0&out=single");
  });

  it("round-trips the defaults", () => {
    expect(roundTrip(DEFAULTS)).toEqual(DEFAULTS);
    expect(roundTrip(LAB_DEFAULTS)).toEqual(DEFAULTS);
  });

  it("round-trips a fully-set state", () => {
    const s: LabState = {
      date: "2027-01-02",
      t: "06:05",
      cov: 0,
      type: "cumulonimbus",
      wind: 60,
      from: 359,
      precip: 1,
      tier: "auto",
      sunAz: 359,
      sunEl: -90,
      cloudAtSun: "cover",
      freeze: true,
      seed: -12,
      view: 0,
      debug: "transmittance",
      scale: 0.25,
      reproject: 0,
      accum: 256,
      out: "layered",
    };
    expect(roundTrip(s)).toEqual(s);
  });

  it("round-trips every preset", () => {
    for (const p of ["A", "B", "C"] as const) expect(roundTrip(presetState(p))).toEqual(presetState(p));
  });

  it("round-trips the review params at every end of their ranges", () => {
    for (const scale of [null, 0.25, 0.3, 0.5, 1]) {
      for (const reproject of [0, 1] as const) {
        for (const accum of [0, 1, 64, 256]) {
          for (const out of ["single", "layered"] as const) {
            const s: LabStateResolved = { ...presetState("A"), scale, reproject, accum, out };
            expect(roundTrip(s)).toEqual(s);
          }
        }
      }
    }
  });

  it("clamps on the way back through the URL", () => {
    expect(roundTrip({ ...LAB_DEFAULTS, cov: 2, wind: -5, from: 720, sunEl: 900, seed: 3.7 })).toEqual({
      ...DEFAULTS,
      cov: 1,
      wind: 0,
      from: 359,
      sunEl: 90,
      seed: 3,
    });
    expect(roundTrip({ ...DEFAULTS, scale: 4, accum: 1e3 })).toEqual({ ...DEFAULTS, scale: 1, accum: 256 });
    expect(roundTrip({ ...DEFAULTS, scale: 0.01, accum: 2.9 })).toEqual({ ...DEFAULTS, scale: 0.25, accum: 2 });
  });
});
