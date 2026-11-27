/** The lab's URL state (owner T3): defaults, clamping and the parse ↔ serialise round trip. */
import { describe, expect, it } from "vitest";
import { LAB_DEFAULTS, LAB_PRESETS, type LabState } from "@/components/sky/volumetric/types";
import { parseLabState, presetState, serialiseLabState } from "@/lib/sky/volumetric/lab-state";

const roundTrip = (s: LabState) => parseLabState(serialiseLabState(s));
const parseOne = (query: string): Partial<LabState> => Object.fromEntries(Object.entries(parseLabState(query)).filter(([k, v]) => v !== LAB_DEFAULTS[k as keyof LabState]));

describe("parseLabState", () => {
  it("defaults to state A from the brief", () => {
    expect(parseLabState("")).toEqual(LAB_DEFAULTS);
    expect(LAB_DEFAULTS).toEqual({ ...LAB_DEFAULTS, ...LAB_PRESETS.A });
  });

  it("reads every field", () => {
    const s = parseLabState(
      "?date=2026-12-21&t=16:45&cov=0.4&type=stratus&wind=10&from=300&precip=0.25&tier=auto" +
        "&sunAz=250&sunEl=3&cloudAtSun=edge&freeze=1&seed=7&view=190&debug=density",
    );
    expect(s).toEqual({
      ...LAB_DEFAULTS,
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
    });
  });

  it("clamps to the documented ranges", () => {
    const s = parseOne("cov=2&wind=99&from=400&precip=-1&sunAz=380&sunEl=-95&view=720");
    expect(s).toEqual({ cov: 1, wind: 60, from: 359, sunAz: 359, sunEl: -90, view: 359 });
    expect(parseOne("cov=-0.5&wind=-10")).toEqual({ cov: 0, wind: 0 });
    expect(parseLabState("?precip=-1").precip).toBe(0); // the clamp, not the default, wins
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

  it("accepts negative, fractional and boundary numbers", () => {
    expect(parseOne("sunEl=-12.5")).toEqual({ sunEl: -12.5 });
    expect(parseOne("precip=1.0001")).toEqual({ precip: 1 });
    expect(parseOne("from=270.5")).toEqual({ from: 270.5 }); // fractional bearings are in range
    expect(parseOne("from=359.9")).toEqual({ from: 359 });
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

  it("ignores unknown parameters", () => {
    expect(parseOne("?foo=bar&cov=0.5")).toEqual({ cov: 0.5 });
  });

  it("presetState is the acceptance URL of each state", () => {
    expect(presetState("A")).toEqual({ ...LAB_DEFAULTS, ...LAB_PRESETS.A });
    expect(presetState("B")).toEqual({ ...LAB_DEFAULTS, ...LAB_PRESETS.B });
    expect(presetState("C")).toEqual({ ...LAB_DEFAULTS, ...LAB_PRESETS.C });
    expect(presetState("B").cloudAtSun).toBe("edge");
  });
});

describe("serialiseLabState", () => {
  it("writes every field, empty for null and 0/1 for booleans", () => {
    expect(serialiseLabState(LAB_DEFAULTS)).toBe(
      "date=2026-12-15&t=11%3A00&cov=0.38&type=cumulus&wind=15&from=270&precip=0" +
        "&tier=high&sunAz=&sunEl=&cloudAtSun=0&freeze=0&seed=1&view=&debug=",
    );
  });

  it("encodes cloudAtSun as 0/1/edge", () => {
    expect(serialiseLabState({ ...LAB_DEFAULTS, cloudAtSun: "cover" })).toContain("cloudAtSun=1");
    expect(serialiseLabState({ ...LAB_DEFAULTS, cloudAtSun: "edge" })).toContain("cloudAtSun=edge");
  });

  it("round-trips the defaults", () => {
    expect(roundTrip(LAB_DEFAULTS)).toEqual(LAB_DEFAULTS);
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
    };
    expect(roundTrip(s)).toEqual(s);
  });

  it("round-trips every preset", () => {
    for (const p of ["A", "B", "C"] as const) expect(roundTrip(presetState(p))).toEqual(presetState(p));
  });

  it("clamps on the way back through the URL", () => {
    expect(roundTrip({ ...LAB_DEFAULTS, cov: 2, wind: -5, from: 720, sunEl: 900, seed: 3.7 })).toEqual({
      ...LAB_DEFAULTS,
      cov: 1,
      wind: 0,
      from: 359,
      sunEl: 90,
      seed: 3,
    });
  });
});
