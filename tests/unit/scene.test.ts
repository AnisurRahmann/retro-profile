import { describe, expect, it } from "vitest";
import { buses, flights } from "@/content";
import { characterLayout, PLATE_COLOURS, rackLayout } from "@/illustrations/compose";
import { hasArt, SCENE, SCENE_ROUTES, sceneProblems, stations } from "@/scene";
import { stationSchema } from "@/schema";
import { hexToRgb } from "../../scripts/illustrations/color";
import { snapColour } from "../../scripts/illustrations/snap";

describe("scene", () => {
  it("has twelve stations and no problems", () => {
    expect(stations).toHaveLength(12);
    expect(sceneProblems()).toEqual([]);
  });

  it("points every station at a real route or anchor", () => {
    const anchors = new Set(flights.map((flight) => flight.id));
    for (const station of stations) {
      if (!station.href) continue;
      const [route, anchor] = station.href.split("#");
      expect(SCENE_ROUTES, station.id).toContain(route);
      if (anchor) {
        expect(route, station.id).toBe("/log/");
        expect(anchors.has(anchor), `${station.id} -> #${anchor}`).toBe(true);
      }
      // internal page links end with a slash
      expect(route!.endsWith("/"), station.id).toBe(true);
    }
  });

  it("has exactly one control without a link, the lamp", () => {
    expect(stations.filter((station) => !station.href).map((station) => station.id)).toEqual(["lamp"]);
  });

  it("covers the seven log sections, the gym page and the notes", () => {
    const targets = stations.map((station) => station.href);
    for (const id of ["pr-board", "training-blocks", "load-the-bar", "training-rules", "next-block", "no-lift", "spot-me"]) {
      expect(targets).toContain(`/log/#${id}`);
    }
    expect(targets).toContain("/gym/");
    expect(targets).toContain("/notes/");
  });

  it("keeps every station inside the 1600 x 900 scene", () => {
    for (const station of stations) {
      expect(station.x + station.w, station.id).toBeLessThanOrEqual(SCENE.width);
      expect(station.y + station.h, station.id).toBeLessThanOrEqual(SCENE.height);
    }
  });

  it("gives traced objects a footprint with the object's own proportions", () => {
    const layouts: Record<string, { width: number; height: number }> = { rack: rackLayout(), character: characterLayout() };
    const traced = stations.filter(hasArt);
    expect(traced.map((station) => station.id).sort()).toEqual(["character", "rack"]);
    for (const station of traced) {
      const layout = layouts[station.id]!;
      expect(station.w / station.h, station.id).toBeCloseTo(layout.width / layout.height, 1);
    }
  });

  it("rejects a station that points off the site or misses a label", () => {
    const base = { id: "x", asset: "a03", x: 0, y: 0, w: 10, h: 10, scale: 1, z: 1, label: "L", plain: "p", section: null };
    expect(() => stationSchema.parse({ ...base, href: "https://example.com/" })).toThrow();
    expect(() => stationSchema.parse({ ...base, href: "/gym" })).toThrow();
    expect(() => stationSchema.parse({ ...base, href: "/gym/", label: "" })).toThrow();
    expect(stationSchema.parse({ ...base, href: "/log/#pr-board" }).href).toBe("/log/#pr-board");
  });
});

describe("rack", () => {
  const layout = rackLayout();

  it("loads six plates a side, in category order from the inside out", () => {
    expect(layout.plates).toHaveLength(12);
    for (const side of ["l", "r"] as const) {
      const plates = layout.plates.filter((plate) => plate.side === side);
      expect(plates.map((plate) => plate.colour)).toEqual([...PLATE_COLOURS]);
      // inside out: each plate sits further from the centre than the one before
      const distance = plates.map((plate) => Math.abs(plate.x + 14 - layout.width / 2));
      expect([...distance].sort((a, b) => a - b)).toEqual(distance);
    }
  });

  it("uses plate colours that are the six category colours and nothing else", () => {
    expect(buses).toHaveLength(PLATE_COLOURS.length);
    buses.forEach((bus, index) => {
      const [r, g, b] = hexToRgb(bus.color);
      expect(snapColour(r, g, b).cls, bus.name).toBe(PLATE_COLOURS[index]);
    });
  });
});
