import { describe, expect, it } from "vitest";
import { content, links, meta, ui } from "@/content";
import { BUS_IDS, contentSchema, STATUS_IDS } from "@/content.schema";
import { formatCount, period, statusCounts, wirePairs } from "@/lib/derive";
import { integrityProblems } from "@/lib/validate";

const everything = JSON.stringify({ content, links, meta, ui });

describe("content", () => {
  it("passes the zod schema", () => {
    const parsed = contentSchema.safeParse(content);
    expect(parsed.success ? [] : parsed.error.issues).toEqual([]);
  });

  it("passes cross-reference integrity checks", () => {
    expect(integrityProblems(content)).toEqual([]);
  });

  it("has unique project ids", () => {
    const ids = content.projects.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBe(27);
  });

  it("resolves every connectsTo id, and mirrors it", () => {
    const byId = new Map(content.projects.map((p) => [p.id, p]));
    for (const p of content.projects) {
      for (const target of p.connectsTo) {
        expect(byId.has(target), `${p.id} -> ${target}`).toBe(true);
        expect(byId.get(target)?.connectsTo, `${target} -> ${p.id}`).toContain(p.id);
      }
    }
  });

  it("gives every project a valid bus and status", () => {
    for (const p of content.projects) {
      expect(BUS_IDS).toContain(p.bus);
      expect(STATUS_IDS).toContain(p.status);
    }
    expect(content.buses.map((b) => b.id)).toEqual([...BUS_IDS]);
    expect(content.statuses.map((s) => s.id)).toEqual([...STATUS_IDS]);
  });

  it("derives status counters from data", () => {
    const counts = statusCounts(content.projects);
    for (const s of STATUS_IDS) {
      expect(counts[s]).toBe(content.projects.filter((p) => p.status === s).length);
    }
    expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(content.projects.length);
    const fewer = statusCounts(content.projects.slice(1));
    expect(Object.values(fewer).reduce((a, b) => a + b, 0)).toBe(content.projects.length - 1);
  });

  it("derives one wire per connected pair", () => {
    const pairs = wirePairs(content.projects);
    const ends = content.projects.reduce((n, p) => n + p.connectsTo.length, 0);
    expect(pairs.length).toBe(ends / 2);
    expect(new Set(pairs.map((w) => `${w.a}|${w.b}`)).size).toBe(pairs.length);
  });

  it("attaches every goal to a project or a named target", () => {
    const ids = new Set(content.projects.map((p) => p.id));
    for (const g of content.goals.items) {
      expect(g.projectIds.length > 0 || Boolean(g.attachesTo), g.id).toBe(true);
      for (const pid of g.projectIds) expect(ids.has(pid), `${g.id} -> ${pid}`).toBe(true);
    }
  });

  it("never ships a placeholder, emoji or banned topic", () => {
    expect(everything).not.toMatch(/\[\[|\]\]/);
    expect(everything).not.toMatch(/lorem ipsum/i);
    expect(everything).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(everything).not.toMatch(/relocat|visa\b|salary|open to work|job hunt/i);
  });

  it("only links to https or mailto", () => {
    const hrefs = [
      ...Object.values(links).map((l) => l.href),
      ...content.projects.flatMap((p) => (p.link ? [p.link.href] : [])),
    ];
    for (const href of hrefs) expect(href).toMatch(/^(https:\/\/|mailto:)/);
  });

  it("rejects bad content", () => {
    const broken = structuredClone(content);
    (broken.projects[0] as { status: string }).status = "DONE";
    expect(contentSchema.safeParse(broken).success).toBe(false);

    const dangling = structuredClone(content);
    dangling.projects[0]?.connectsTo.push("P-99");
    expect(integrityProblems(dangling).length).toBeGreaterThan(0);

    const placeholder = structuredClone(content);
    (placeholder.projects[0] as { name: string }).name = "[[name]]";
    expect(contentSchema.safeParse(placeholder).success).toBe(false);
  });
});

describe("formatting", () => {
  it("formats counts", () => {
    expect(formatCount({ prefix: "", value: 2500, suffix: "+", group: true })).toBe("2,500+");
    expect(formatCount({ prefix: "−", value: 75, suffix: "%", group: false })).toBe("−75%");
    expect(formatCount({ prefix: "$", value: 1, suffix: "M+", group: false }, 0.4)).toBe("$0M+");
  });
  it("renders an open period without inventing an end date", () => {
    expect(period("Aug 2022", null, "From", "to")).toBe("From Aug 2022");
    expect(period("2024", "2025", "From", "to")).toBe("2024 to 2025");
  });
});
