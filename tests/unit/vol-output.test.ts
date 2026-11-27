/** The lab's output modes (T11): out=single | layered, read from the URL until T9's LabState.out lands. */
import { describe, expect, it } from "vitest";
import { layeredSize, readOutput, S_OUT_RANGE, SINGLE_OUTPUT } from "@/components/sky/volumetric/targets";

describe("readOutput", () => {
  it("defaults to the single composite", () => {
    expect(readOutput("")).toEqual(SINGLE_OUTPUT);
    expect(readOutput("?out=single&sout=0.5")).toEqual(SINGLE_OUTPUT);
    expect(readOutput("?out=nonsense")).toEqual(SINGLE_OUTPUT);
  });

  it("reads the layered output, with the lifted alpha on by default", () => {
    expect(readOutput("?out=layered")).toEqual({ mode: "layered", sOut: null, lift: true, clampViz: false, hold: false });
    expect(readOutput("?out=layered&sout=0.5&lift=0&clampviz=1&hold=1")).toEqual({ mode: "layered", sOut: 0.5, lift: false, clampViz: true, hold: true });
  });

  it("keeps hold in single mode (T7's option 1)", () => {
    expect(readOutput("?hold=1")).toEqual({ ...SINGLE_OUTPUT, hold: true });
  });

  it("clamps s_out to its range and ignores junk", () => {
    expect(readOutput("?out=layered&sout=5").sOut).toBe(S_OUT_RANGE[1]);
    expect(readOutput("?out=layered&sout=0.01").sOut).toBe(S_OUT_RANGE[0]);
    expect(readOutput("?out=layered&sout=abc").sOut).toBeNull();
    expect(readOutput("?out=layered&sout=").sOut).toBeNull();
  });
});

describe("layeredSize", () => {
  it("scales the drawing buffer and never goes below 1 px", () => {
    expect(layeredSize(3840, 2160, 0.35)).toEqual([1344, 756]);
    expect(layeredSize(1125, 2436, 0.5)).toEqual([563, 1218]);
    expect(layeredSize(1, 1, 0.2)).toEqual([1, 1]);
  });
});
