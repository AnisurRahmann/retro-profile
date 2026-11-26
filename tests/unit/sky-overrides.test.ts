/**
 * The sky overrides in a production build (v5.1 T9): ?sky= and ?wx= are honoured only with NEXT_PUBLIC_SKY_DEBUG=1 or
 * when the URL also has preview=1, and then the page carries the fixed "preview 16:45" badge.
 *
 * The store reads the build's flags when it loads, so each case loads it again as that build would bundle it.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { firstPaintScript } from "@/lib/sky/first-paint";
import { dhakaDate, formatHM } from "@/lib/sky/time";

type Flags = Partial<Record<"NODE_ENV" | "NEXT_PUBLIC_SKY_DEBUG" | "NEXT_PUBLIC_E2E", string>>;

/** The sky store, loaded as a build with these flags bundles it. */
async function built(flags: Flags) {
  vi.resetModules();
  vi.stubEnv("NODE_ENV", flags.NODE_ENV ?? "development");
  vi.stubEnv("NEXT_PUBLIC_SKY_DEBUG", flags.NEXT_PUBLIC_SKY_DEBUG ?? "");
  vi.stubEnv("NEXT_PUBLIC_E2E", flags.NEXT_PUBLIC_E2E ?? "");
  return import("@/lib/sky/store");
}
afterEach(() => vi.unstubAllEnvs());

const PRODUCTION: Flags = { NODE_ENV: "production" };
const OVERRIDES = "?sky=2026-11-26T16:45&wx=rain";
const NONE = { timeOverride: null, wxOverride: null };
const PREVIEW = "preview {time}";

/** Runs a first-paint script as the page would: returns the gradient it set and html's data attributes. */
const run = (src: string, search = "", now = dhakaDate(2026, 12, 15, 12 * 60).getTime()) => {
  const props: Record<string, string> = {};
  const html = { style: { setProperty: (k: string, v: string) => (props[k] = v) }, dataset: {} as Record<string, string> };
  const RealDate = Date;
  class FakeDate extends RealDate {
    static override now = () => now;
  }
  new Function("document", "location", "Date", src)({ documentElement: html }, { search }, FakeDate);
  return { props, dataset: html.dataset };
};

describe("the sky overrides in a production build without the flag", () => {
  it("ignores ?sky= and ?wx=", async () => {
    const s = await built(PRODUCTION);
    expect(s.parseOverrides(OVERRIDES)).toEqual(NONE);
    expect(s.parseOverrides("?sky=2026-11-26T16:45")).toEqual(NONE);
    expect(s.parseOverrides("?wx=rain")).toEqual(NONE);
  });

  it("applies them with &preview=1, and the badge names the time", async () => {
    const s = await built(PRODUCTION);
    const o = s.parseOverrides(`${OVERRIDES}&preview=1`);
    expect(o.timeOverride && s.skyTime({ ...s.skyStore.get(), ...o }).getUTCHours()).toBe(10);
    expect(o.wxOverride?.condition).toBe("rain");
    const snap = { ...s.skyStore.get(), ...o };
    expect(s.previewBadge(snap, PREVIEW)).toBe("preview 16:45");
    // While the sun is dragged, the badge follows the time the sky is drawn for.
    expect(s.previewBadge({ ...snap, preview: 17 * 60 + 20 }, PREVIEW)).toBe("preview 17:20");
    // No override, no badge.
    expect(s.previewBadge({ ...snap, ...NONE }, PREVIEW)).toBeNull();
  });

  it("takes preview=1 only as that exact value", async () => {
    const s = await built(PRODUCTION);
    for (const q of [
      "?preview=0&sky=2026-11-26T16:45",
      "?preview=true&sky=2026-11-26T16:45",
      "?previews=1&sky=2026-11-26T16:45",
      // The first value is the one, as URLSearchParams reads it (and the first-paint script, below).
      "?preview=0&preview=1&sky=2026-11-26T16:45",
    ])
      expect(s.parseOverrides(q), q).toEqual(NONE);
    expect(s.parseOverrides("/?sky=2026-11-26T16:45#preview=1")).toEqual(NONE);
  });

  it("with only the weather overridden, the badge gives the current time", async () => {
    const s = await built(PRODUCTION);
    const o = s.parseOverrides("?wx=rain&preview=1");
    expect(o.timeOverride).toBeNull();
    const snap = { ...s.skyStore.get(), ...o };
    expect(s.previewBadge(snap, PREVIEW)).toBe(`preview ${formatHM(new Date())}`);
  });
});

describe("where the overrides need no key", () => {
  it("a production build with NEXT_PUBLIC_SKY_DEBUG=1 applies and marks them", async () => {
    const s = await built({ ...PRODUCTION, NEXT_PUBLIC_SKY_DEBUG: "1" });
    const o = s.parseOverrides(OVERRIDES);
    expect(o.wxOverride?.condition).toBe("rain");
    expect(s.previewBadge({ ...s.skyStore.get(), ...o }, PREVIEW)).toBe("preview 16:45");
  });

  it("the test build applies them and never marks them", async () => {
    const s = await built({ ...PRODUCTION, NEXT_PUBLIC_E2E: "1" });
    const o = s.parseOverrides(OVERRIDES);
    expect(o.wxOverride?.condition).toBe("rain");
    expect(s.previewBadge({ ...s.skyStore.get(), ...o }, PREVIEW)).toBeNull();
  });

  it("development applies them and does not mark them", async () => {
    const s = await built({ NODE_ENV: "development" });
    const o = s.parseOverrides(OVERRIDES);
    expect(o.wxOverride?.condition).toBe("rain");
    expect(s.previewBadge({ ...s.skyStore.get(), ...o }, PREVIEW)).toBeNull();
  });
});

describe("the first-paint script", () => {
  const production = firstPaintScript(false, true, PREVIEW);
  const flagged = firstPaintScript(true, true, PREVIEW);

  it("a production build without the flag paints ?sky= only with &preview=1, and marks it", () => {
    const noon = dhakaDate(2026, 12, 15, 12 * 60).getTime();
    const plain = run(production, "?sky=2026-12-15T02:00", noon);
    expect(plain.dataset.sky, "no key: the real sky (midday)").toBe("day");
    expect(plain.dataset.skyPreview).toBeUndefined();
    const preview = run(production, "?sky=2026-12-15T02:00&preview=1", noon);
    expect(preview.dataset.sky).toBe("night");
    expect(preview.dataset.skyPreview).toBe("preview 02:00");
    // The same paint as a build that needs no key.
    expect(preview.props).toEqual(run(flagged, "?sky=2026-12-15T02:00", noon).props);
    expect(run(production, "?sky=2026-12-15T02:00&preview=0", noon).dataset.sky).toBe("day");
    // The first preview value is the one, as the client reads it.
    expect(run(production, "?preview=0&preview=1&sky=2026-12-15T02:00", noon).dataset.sky).toBe("day");
    expect(run(production, "?preview=1&preview=0&sky=2026-12-15T02:00", noon).dataset.skyPreview).toBe("preview 02:00");
    expect(run(production, "?preview=1", noon).dataset.skyPreview).toBeUndefined();
    // Without ?sky= the gradient is the only thing it sets, as before.
    expect(Object.keys(run(production, "", noon).props).sort()).toEqual(["--sky-horizon", "--sky-mid", "--sky-zenith"]);
  });

  it("marks the time the way the client does (two digits, Dhaka wall time)", () => {
    expect(run(production, "?preview=1&sky=2026-12-15T09:05", 0).dataset.skyPreview).toBe("preview 09:05");
  });

  it("development and the test build honour ?sky= without marking the page", () => {
    const noon = dhakaDate(2026, 12, 15, 12 * 60).getTime();
    for (const src of [firstPaintScript(true), firstPaintScript(true, true)])
      expect(run(src, "?sky=2026-12-15T02:00", noon).dataset).toEqual({ sky: "night" });
  });

  it("stays under 1.5 kB in every build", () => {
    for (const src of [firstPaintScript(true), firstPaintScript(true, true), production, flagged])
      expect(src.length).toBeLessThan(1500);
  });
});

describe("the badge", () => {
  it("is drawn from the attribute, fixed at the bottom left, in the mono font", () => {
    const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
    const rule = css.match(/html\[data-sky-preview\]::after \{([^}]*)\}/)?.[1];
    expect(rule).toBeTruthy();
    expect(rule).toMatch(/content: attr\(data-sky-preview\);/);
    expect(rule).toMatch(/position: fixed;/);
    expect(rule).toMatch(/left: 12px;/);
    expect(rule).toMatch(/bottom: /);
    expect(rule).toMatch(/font-family: var\(--font-mono\);/);
  });

  it("says what the content file says", async () => {
    const { ui } = await import("@/site");
    expect(ui.sky.preview).toBe(PREVIEW);
  });
});

describe("the sky's debug flag in a release build", () => {
  // A constant of the module that uses it is folded away in a release build; an imported one, or a parameter, is not,
  // and the code it guards ships (v5.1: it put the renderer over its budget). So the renderer and the atmosphere
  // repeat the store's definition, and next.config.ts gives the two variables a value to fold. They must not drift.
  const flag =
    /process\.env\.NODE_ENV\s*!==\s*"production"\s*\|\|\s*process\.env\.NEXT_PUBLIC_SKY_DEBUG\s*===\s*"1"\s*\|\|\s*process\.env\.NEXT_PUBLIC_E2E\s*===\s*"1"/;

  it.each(["src/lib/sky/store.ts", "src/components/sky/SkyRenderer.tsx", "src/components/sky/atmosphere.ts"])(
    "means the same in %s",
    (f) => {
      expect(readFileSync(join(process.cwd(), f), "utf8"), f).toMatch(flag);
    },
  );

  it("has a value to fold: next.config.ts defines both variables for the bundle", () => {
    const config = readFileSync(join(process.cwd(), "next.config.ts"), "utf8");
    expect(config).toMatch(/NEXT_PUBLIC_E2E: process\.env\.NEXT_PUBLIC_E2E \?\? ""/);
    expect(config).toMatch(/NEXT_PUBLIC_SKY_DEBUG: process\.env\.NEXT_PUBLIC_SKY_DEBUG \?\? ""/);
  });
});
