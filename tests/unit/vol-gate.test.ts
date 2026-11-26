/** /lab/clouds exists only in dev and test builds, or with NEXT_PUBLIC_SKY_DEBUG=1 (owner T0). */
import { describe, expect, it } from "vitest";
import { LAB_ENABLED, labEnabled } from "@/lib/sky/volumetric/gate";

describe("lab gate", () => {
  it("is open in development and in tests", () => {
    expect(labEnabled({ nodeEnv: "development" })).toBe(true);
    expect(labEnabled({ nodeEnv: "test" })).toBe(true);
    expect(LAB_ENABLED).toBe(true);
  });
  it("is closed in a production build", () => {
    expect(labEnabled({ nodeEnv: "production" })).toBe(false);
    expect(labEnabled({ nodeEnv: "production", e2e: "", debug: "" })).toBe(false);
    expect(labEnabled({ nodeEnv: "production", debug: "0" })).toBe(false);
  });
  it("opens in a production build made for e2e or with the sky debug flag", () => {
    expect(labEnabled({ nodeEnv: "production", e2e: "1" })).toBe(true);
    expect(labEnabled({ nodeEnv: "production", debug: "1" })).toBe(true);
  });
});
