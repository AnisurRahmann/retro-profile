import { describe, expect, it } from "vitest";
import {
  blocks,
  buses,
  caseStudies,
  contentProblems,
  flights,
  goals,
  metrics,
  misses,
  projects,
  scenarios,
  statuses,
} from "@/content";
import { GYM_DAYS, GYM_RULES, REST_DAY_COUNT, TRAINING_DAY_COUNT } from "@/gym";
import { chartModel, countByStatus, counts, goalCurrent, projectsByBus } from "@/lib/derive";
import { allNotes } from "@/lib/notes";
import { BUS_IDS, STATUS_IDS } from "@/schema";

describe("projects", () => {
  it("has 27 projects with unique, well-formed ids", () => {
    expect(projects).toHaveLength(27);
    expect(new Set(projects.map((project) => project.id)).size).toBe(27);
    for (const project of projects) expect(project.id).toMatch(/^P-\d{2}$/);
  });

  it("resolves every connectsTo", () => {
    const ids = new Set(projects.map((project) => project.id));
    for (const project of projects) for (const target of project.connectsTo) expect(ids.has(target)).toBe(true);
  });

  it("uses only valid buses and statuses", () => {
    for (const project of projects) {
      expect(BUS_IDS).toContain(project.bus);
      expect(STATUS_IDS).toContain(project.status);
    }
  });

  it("puts every project on exactly one of six pegs", () => {
    const pegs = projectsByBus();
    expect(pegs).toHaveLength(6);
    expect(pegs.map((peg) => peg.projects.length)).toEqual([4, 6, 8, 4, 3, 2]);
    expect(pegs.flatMap((peg) => peg.projects)).toHaveLength(projects.length);
  });

  it("never invents a link", () => {
    for (const project of projects) if (project.link) expect(project.link.href).toMatch(/^https:\/\/github\.com\/AnisurRahmann\//);
    expect(projects.filter((project) => project.link).map((project) => project.id)).toEqual(["P-11", "P-12"]);
  });
});

describe("counters are derived from data", () => {
  it("matches the arrays", () => {
    expect(counts.projects).toBe(projects.length);
    expect(counts.metrics).toBe(metrics.length);
    expect(counts.blocks).toBe(blocks.length);
    expect(counts.scenarios).toBe(scenarios.length);
    expect(counts.goals).toBe(goals.length);
    expect(counts.misses).toBe(misses.length);
    expect(STATUS_IDS.reduce((sum, status) => sum + countByStatus(status), 0)).toBe(projects.length);
    expect(counts.shipped).toBe(projects.filter((project) => project.status === "shipped").length);
  });

  it("derives goal current state from the linked project or from a count", () => {
    const last = goals[goals.length - 1];
    expect(last && goalCurrent(last)).toBe(`${countByStatus("specd")} projects specified`);
    for (const goal of goals) expect(goalCurrent(goal).length).toBeGreaterThan(0);
  });
});

describe("content shape", () => {
  it("has no cross-reference problems", () => {
    expect(contentProblems()).toEqual([]);
  });

  it("has six PRs, five blocks, five case studies, nine flights", () => {
    expect(metrics).toHaveLength(6);
    expect(blocks).toHaveLength(5);
    expect(caseStudies).toHaveLength(5);
    expect(flights.map((flight) => flight.n)).toEqual(["00", "01", "02", "03", "04", "05", "06", "07", "08"]);
  });

  it("gives every Your Call scenario exactly one actual option and one case study", () => {
    expect(scenarios).toHaveLength(5);
    for (const scenario of scenarios) {
      expect(scenario.options.filter((option) => option.actual)).toHaveLength(1);
      expect(caseStudies.some((study) => study.id === scenario.caseStudyId)).toBe(true);
    }
    expect(new Set(scenarios.map((scenario) => scenario.caseStudyId)).size).toBe(5);
  });

  it("pairs every status and flight with a plain-language label", () => {
    for (const status of statuses) expect(status.plain.length).toBeGreaterThan(0);
    for (const flight of flights) expect(flight.plain.length).toBeGreaterThan(0);
    expect(statuses.map((status) => status.id)).toEqual([...STATUS_IDS, "failed"]);
  });

  it("keeps the six plate colours from the spec", () => {
    expect(buses.map((bus) => bus.color)).toEqual(["#D62828", "#1D4E89", "#F2B705", "#2A9D5C", "#FFFFFF", "#17181A"]);
  });

  it("has one open-ended block and a sane chart", () => {
    expect(blocks.filter((block) => block.end === null)).toHaveLength(1);
    const chart = chartModel(new Date("2026-11-13T00:00:00Z"));
    expect(chart.rows).toHaveLength(5);
    for (const row of chart.rows) {
      expect(row.left).toBeGreaterThanOrEqual(0);
      expect(row.left + row.width).toBeLessThanOrEqual(100.01);
      expect(row.width).toBeGreaterThan(0);
    }
  });
});

describe("gym", () => {
  it("runs Friday to Thursday with five training days and two rest days", () => {
    expect(GYM_DAYS.map((day) => day.id)).toEqual(["friday", "saturday", "sunday", "monday", "tuesday", "wednesday", "thursday"]);
    expect(TRAINING_DAY_COUNT).toBe(5);
    expect(REST_DAY_COUNT).toBe(2);
    expect(GYM_DAYS.filter((day) => !day.rest).map((day) => day.num)).toEqual(["01", "02", "03", "04", "05"]);
  });

  it("has the exercise counts from the source split and seven rules", () => {
    expect(GYM_DAYS.map((day) => day.exercises.length)).toEqual([10, 8, 0, 7, 8, 9, 0]);
    expect(GYM_RULES).toHaveLength(7);
    for (const day of GYM_DAYS.filter((entry) => entry.rest)) expect(day.restLine).toBe("Zero sets. Zero reps. Recover hard.");
  });
});

describe("notes", () => {
  it("migrates all seven posts with chapters", () => {
    const notes = allNotes();
    expect(notes).toHaveLength(7);
    expect(new Set(notes.map((note) => note.slug)).size).toBe(7);
    for (const note of notes) {
      expect(note.chapters.some((chapter) => chapter.kind === "body")).toBe(true);
      expect(note.chapters.some((chapter) => chapter.kind === "quote")).toBe(true);
    }
  });
});
