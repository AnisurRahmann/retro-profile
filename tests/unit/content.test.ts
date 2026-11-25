import { describe, expect, it } from "vitest";
import { content } from "@/content";
import * as site from "@/site";

describe("content", () => {
  it("has unique ids across projects, bench items and receipts", () => {
    const ids = [...content.shipped, ...content.building].map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    const rids = content.receipts.map((r) => r.id);
    expect(new Set(rids).size).toBe(rids.length);
    const slugs = content.caseStudies.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("links every caseStudy reference to a real case study", () => {
    const slugs = new Set(content.caseStudies.map((c) => c.slug));
    for (const p of content.shipped) if (p.caseStudy) expect(slugs.has(p.caseStudy), p.id).toBe(true);
    const ids = new Set(content.shipped.map((p) => p.id));
    for (const c of content.caseStudies) expect(ids.has(c.projectId), c.slug).toBe(true);
  });

  it("renders only valid https hrefs (or none)", () => {
    for (const p of site.allProjects) {
      if (p.href) expect(() => new URL(p.href!)).not.toThrow();
      if (p.href) expect(p.href.startsWith("https://")).toBe(true);
    }
    for (const r of site.receipts) if (r.href) expect(r.href.startsWith("https://")).toBe(true);
  });

  it("lets no [[placeholder]] reach the rendered props", () => {
    const rendered = {
      profile: site.profile,
      links: site.links,
      ui: site.ui,
      closer: site.closer,
      shipped: site.shipped,
      building: site.building,
      caseStudies: site.caseStudies,
      receipts: site.receipts,
      lifts: site.lifts,
    };
    expect(JSON.stringify(rendered)).not.toContain("[[");
  });

  it("hides items whose required field is unresolved and drops unresolved optional fields", () => {
    expect(site.receipts.find((r) => r.id === "r-lift")).toBeUndefined();
    expect(site.receipts.some((r) => r.kind === "human")).toBe(false);
    expect(site.shipped.find((p) => p.id === "lift")?.href).toBeUndefined();
    expect(site.caseStudies[0]?.period).toBeUndefined();
  });

  it("never mentions relocation, visas, salary or open-to-work in rendered copy", () => {
    const text = JSON.stringify({ ui: site.ui, profile: site.profile, closer: site.closer }).toLowerCase();
    for (const banned of ["relocat", "visa", "salary", "open to work", " uk "]) expect(text).not.toContain(banned);
  });
});
