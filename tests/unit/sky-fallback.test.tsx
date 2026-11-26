/**
 * The first-paint fallback (src/components/sky/SkyFallback.tsx, v5.1 T8): server-rendered markup built from the
 * landscape's own world and path data, so it sits where the canvas will draw.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BAND_UNITS,
  L4_UNITS,
  SkyFallbackBand,
  SkyFallbackStage,
  SkyFallbackStars,
  starShadows,
} from "@/components/sky/SkyFallback";
import { POSTCARD_VW, STAGE_SCENE_PX, stageMarkK } from "@/lib/sky/landscape/anchors";
import { buildFillers, buildStageScene, buildWorld } from "@/lib/sky/landscape/world";
import { keaneBridge } from "@/lib/sky/landscape/shapes";
import { LAND_L1, LAND_L4, STAR_COOL, STAR_WARM } from "@/lib/sky/palette";

const count = (html: string, re: RegExp) => (html.match(re) ?? []).length;

describe("the fillers' world", () => {
  it("is the generic fillers alone: no landmark, the same on every call", () => {
    const w = buildFillers(BAND_UNITS + 30);
    expect(w.marks).toEqual([]);
    expect(w.layers.L1).toEqual([]);
    expect(w.layers.L3.length).toBeGreaterThan(0);
    expect(buildFillers(BAND_UNITS + 30)).toEqual(w);
  });

  it("starts as the fixed band's world does: the shade trees and the near foreground are the canvas's", () => {
    // No airport here, so the near layer is never cleared; the band's landmarks only skip the town's bank (L3).
    const live = buildWorld([], 1440, 900, 2221, 162, "gutter");
    const w = buildFillers(BAND_UNITS + 30);
    for (const layer of ["L2", "L4"] as const) {
      const n = Math.min(live.layers[layer].length, w.layers[layer].length);
      expect(n).toBeGreaterThan(5);
      expect(live.layers[layer].slice(0, n)).toEqual(w.layers[layer].slice(0, n));
    }
  });
});

describe("the star field", () => {
  const shadows = starShadows();

  it("is about 60 dots from a fixed seed, the same every build", () => {
    const n = shadows.split(",").length;
    expect(n).toBeGreaterThanOrEqual(58);
    expect(n).toBeLessThanOrEqual(62);
    expect(starShadows()).toBe(shadows);
  });

  it("keeps clear of the hero: below the phone's text block or above it, and out of the desktop hero's box", () => {
    for (const shadow of shadows.split(",")) {
      const m = shadow.match(/^([\d.]+)vw ([\d.]+)vh /)!;
      const x = +m[1]!;
      const y = +m[2]!;
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(100);
      expect(y === 0 || y >= 34 || y < 9).toBe(true);
      if (x > 21 && x < 79) expect(y < 34.5 || y > 62).toBe(true);
      // 1px or 2px dots, in the palette's star colours with an alpha.
      expect(shadow).toMatch(/ 0 (0|\.5)px #[0-9a-f]{8}$/);
    }
    expect(shadows).toContain(STAR_COOL.slice(1).toLowerCase());
    expect(shadows).toContain(STAR_WARM.slice(1).toLowerCase());
  });

  it("is one element carrying the whole list", () => {
    const html = renderToStaticMarkup(<SkyFallbackStars />);
    expect(html).toMatch(/^<div aria-hidden="true" class="sky-fallback-stars" data-sky-fallback="stars" style="box-shadow:[^"]*"><\/div>$/);
    expect(html).not.toContain("<canvas");
    expect(html).not.toContain("<script");
  });
});

describe("the stage scene fallback (phones)", () => {
  const html = renderToStaticMarkup(<SkyFallbackStage />);
  const has = (needle: string) => expect(html.includes(needle), `missing: ${needle.slice(0, 70)}`).toBe(true);

  it("has the layers in the canvas's order, the river, and the ground fade; one well-formed defs block", () => {
    const order = ["<defs>", "sky-fb-stage-glow-m", "sky-fb-stage-fade\" maskUnits", "</defs>", "<rect data-glow", '<g data-layer="L1">', '<g data-layer="L2">', "data-river", "data-bank", "data-glint", '<g data-layer="L3">', '<g data-layer="L4">'];
    const at = order.map((o) => html.indexOf(o));
    for (const i of at) expect(i, "not found").toBeGreaterThanOrEqual(0);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    expect(count(html, /<defs>/g)).toBe(1);
    expect(count(html, /<\/defs>/g)).toBe(1);
    has('mask="url(#sky-fb-stage-fade)"');
  });

  it("is drawn at 2 px per unit for the widest phone, and Keane Bridge is its own SVG, centred", () => {
    const world = buildStageScene(POSTCARD_VW - 1, STAGE_SCENE_PX);
    expect(world.s).toBe(2);
    has(`viewBox="0 0 ${(POSTCARD_VW - 1) / 2 + 4} 124" preserveAspectRatio="xMinYMax slice"`);
    const bridge = keaneBridge();
    const k = stageMarkK(STAGE_SCENE_PX);
    const w = +((bridge.x1 - bridge.x0) * k + 2).toFixed(1);
    has(`class="sky-fallback-bridge" viewBox="${-w / 2} 0 ${w} 100" style="width:${w * 2}px;height:${STAGE_SCENE_PX}px;margin-left:${-w}px"`);
    has(`transform="translate(-96 -14) scale(1.2)"`);
    // The bridge's deck and trusses, once each (it is left out of the fixed SVG).
    expect(count(html, /<path d="M0 64h160v3h-160Z/g)).toBe(1);
    expect(count(html, /stroke-width="0.75"/g)).toBe(1);
    // No clock tower (as in the canvas's phone scene), and nothing from far off screen.
    expect(html.includes("M-7 66h14v4h-14Z"), "clock tower").toBe(false);
    for (const m of html.matchAll(/transform="translate\((-?[\d.]+) /g)) expect(+m[1]!, "off-screen shape").toBeLessThan(360);
  });

  it("carries the landscape's base colours for the CSS to mix, and no time of day", () => {
    has(`--land-l1:${LAND_L1}`);
    has(`--land-l4:${LAND_L4}`);
    expect(html.includes("oklab(") || html.includes("oklch(") || html.includes("rgb("), "a colour of its own").toBe(false);
  });
});

describe("the band fallback (desktop)", () => {
  const html = renderToStaticMarkup(<SkyFallbackBand />);
  const has = (needle: string) => expect(html.includes(needle), `missing: ${needle.slice(0, 70)}`).toBe(true);
  const band = html.slice(0, html.indexOf('class="sky-fallback-landmarks"'));

  it("covers the first 1400 units with the hills, the river and the near bank", () => {
    has(`viewBox="0 0 ${BAND_UNITS} 100"`);
    expect(count(html, /<g data-layer="L[124]"><path( data-ground)? d="M0 101L/g)).toBe(3);
    has("data-river");
    has("</defs>");
  });

  it("carries the shade trees and the near foreground up to L4_UNITS, and nothing on the town's bank", () => {
    // Tea gardens' shade trees (L2).
    const l2 = band.slice(band.indexOf('data-layer="L2"'), band.indexOf("data-river"));
    expect(count(l2, /transform="translate\(/g)).toBeGreaterThan(5);
    // Palms, bamboo, lamp posts, low walls (L4): none from where the canvas may clear the layer for the airport.
    const xs = [...band.slice(band.indexOf('data-layer="L4"')).matchAll(/transform="translate\((-?[\d.]+) /g)].map(
      (m) => +m[1]!,
    );
    expect(xs.length).toBeGreaterThan(5);
    for (const x of xs) expect(x + 26).toBeLessThan(L4_UNITS);
    // Riverside trees and houses (L3) are left out: the canvas skips them around the landmarks.
    const l3 = band.slice(band.indexOf('data-layer="L3"'), band.indexOf('data-layer="L4"'));
    expect(l3.includes("transform=")).toBe(false);
  });

  it("gives the stroke to stroke paths only, so filled shapes are as thick as the canvas's", () => {
    // The layer group carries the stroke colour for the shapes' stroke paths; every filled path and rect must opt out.
    for (const m of html.matchAll(/<(path|rect) [^>]*stroke-width[^>]*>/g)) expect(m[0]).toContain('fill="none"');
    const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
    expect(css).toMatch(/\.sky-fallback :is\(path, rect\):not\(\[fill="none"\]\) \{\s*stroke: none;/);
  });

  it("puts Ali Amjad's Clock on the right gutter's centre with Keane Bridge reaching left", () => {
    has('class="sky-fallback-landmarks" data-sky-fallback-landmarks="" viewBox="-202 0 210 100"');
    has('transform="translate(-185 0)"');
    // The clock face is punched out to the tea gardens.
    expect(count(html, /data-cut/g)).toBe(2);
  });
});
