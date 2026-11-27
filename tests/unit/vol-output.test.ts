/** The lab's output (T11; from LabState since M2): outputFor, sameOutput and the layered canvas size. */
import { describe, expect, it } from "vitest";
import { layeredSize, outputFor, sameOutput, SINGLE_OUTPUT } from "@/components/sky/volumetric/targets";
import { LAB_DEFAULTS, type LabState } from "@/components/sky/volumetric/types";

const at = (p: Partial<LabState>): LabState => ({ ...LAB_DEFAULTS, ...p });

describe("outputFor", () => {
  it("defaults to the layered output with the lifted alpha (T11's recommendation)", () => {
    expect(outputFor(LAB_DEFAULTS)).toEqual({ mode: "layered", scale: null, sOut: null, lift: true, clampViz: false, hold: false });
  });

  it("reads the single output, which ignores the layered switches", () => {
    expect(outputFor(at({ out: "single" }))).toEqual(SINGLE_OUTPUT);
    expect(outputFor(at({ out: "single", sout: 0.5, lift: 0, clampviz: 1 }))).toEqual(SINGLE_OUTPUT);
  });

  it("carries every layered switch", () => {
    expect(outputFor(at({ sout: 0.5, lift: 0, clampviz: 1, hold: 1 }))).toEqual({
      mode: "layered",
      scale: null,
      sOut: 0.5,
      lift: false,
      clampViz: true,
      hold: true,
    });
  });

  it("keeps hold and the review scale in either mode", () => {
    expect(outputFor(at({ out: "single", hold: 1 }))).toEqual({ ...SINGLE_OUTPUT, hold: true });
    expect(outputFor(at({ scale: 1 })).scale).toBe(1);
    expect(outputFor(at({ out: "single", scale: 0.5 })).scale).toBe(0.5);
  });

  it("draws a reference render (accum > 0) with the single output", () => {
    expect(outputFor(at({ accum: 64, scale: 1 }))).toEqual({ ...SINGLE_OUTPUT, scale: 1 });
  });
});

describe("sameOutput", () => {
  it("is true only when one pipeline serves both", () => {
    const a = outputFor(LAB_DEFAULTS);
    expect(sameOutput(a, outputFor(LAB_DEFAULTS))).toBe(true);
    expect(sameOutput(a, outputFor(at({ sout: 0.5 })))).toBe(false);
    expect(sameOutput(a, outputFor(at({ scale: 0.5 })))).toBe(false);
    expect(sameOutput(a, outputFor(at({ hold: 1 })))).toBe(false);
    expect(sameOutput(a, outputFor(at({ out: "single" })))).toBe(false);
    expect(sameOutput(a, outputFor(at({ cov: 0.9, t: "16:45" })))).toBe(true); // the scene is the pipeline's input
  });
});

describe("layeredSize", () => {
  it("scales the drawing buffer and never goes below 1 px", () => {
    expect(layeredSize(3840, 2160, 0.35)).toEqual([1344, 756]);
    expect(layeredSize(1125, 2436, 0.5)).toEqual([563, 1218]);
    expect(layeredSize(1, 1, 0.2)).toEqual([1, 1]);
  });
});
