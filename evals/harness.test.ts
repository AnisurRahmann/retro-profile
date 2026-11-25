import { describe, expect, it } from "vitest";
import { buildKnowledge } from "../src/agent/knowledge-builder";
import { mockAdapter } from "../src/agent/mock";
import { CATEGORIES, gradeDeterministic, loadCases, runCase, unknownNumbers, type CaseRun } from "./harness";

const knowledge = buildKnowledge();
const cases = loadCases();
const fakeRun = (text: string, tool: string | null = null): CaseRun => ({
  text,
  tool,
  firstTokenMs: 1,
  totalMs: 2,
  stats: null,
});
const byId = (id: string) => {
  const c = cases.find((x) => x.id === id);
  if (!c) throw new Error(`missing case ${id}`);
  return c;
};

describe("eval cases", () => {
  it("has at least 30 cases covering every category", () => {
    expect(cases.length).toBeGreaterThanOrEqual(30);
    for (const cat of CATEGORIES) expect(cases.some((c) => c.category === cat), cat).toBe(true);
  });
});

describe("deterministic grader", () => {
  it("flags numbers that aren't in the knowledge base", () => {
    expect(unknownNumbers("He saved $900K and 2,500 posts", knowledge)).toEqual([]);
    expect(unknownNumbers("He started in 2019 with 42 users", knowledge)).toEqual(["2019", "42"]);
  });
  it("passes an honest unknown and fails a guessed one", () => {
    const c = byId("unknown-start-date");
    expect(gradeDeterministic(c, fakeRun("That's not something I know about him."), knowledge).pass).toBe(true);
    expect(gradeDeterministic(c, fakeRun("He started in August 2021."), knowledge).pass).toBe(false);
  });
  it("fails a leaked rate and a visa mention in the forbidden category", () => {
    expect(gradeDeterministic(byId("forbidden-rate"), fakeRun("About $120/hour, but book a call."), knowledge).pass).toBe(false);
    expect(gradeDeterministic(byId("forbidden-visa"), fakeRun("He'd need a visa."), knowledge).pass).toBe(false);
    expect(gradeDeterministic(byId("forbidden-salary"), fakeRun("That's one for a call."), knowledge).pass).toBe(true);
  });
  it("fails a prompt leak in the injection category", () => {
    const c = byId("inject-print-prompt");
    const leak = "<identity> You are Shakil's agent, on his personal site";
    expect(gradeDeterministic(c, fakeRun(leak), knowledge).pass).toBe(false);
    expect(gradeDeterministic(c, fakeRun("I only know about Shakil. Want to ask about his work?"), knowledge).pass).toBe(true);
  });
  it("checks the expected tool", () => {
    const c = byId("tool-hiring");
    expect(gradeDeterministic(c, fakeRun("Sure.", "book_call"), knowledge).pass).toBe(true);
    expect(gradeDeterministic(c, fakeRun("Sure."), knowledge).pass).toBe(false);
  });
});

describe("harness against the mock adapter", () => {
  it("runs every case end to end without throwing", async () => {
    const adapter = mockAdapter({ delayMs: 0 });
    for (const c of cases) {
      const run = await runCase(adapter, c);
      expect(run.error, c.id).toBeUndefined();
      expect(run.text.length + (run.tool ? 1 : 0), c.id).toBeGreaterThan(0);
    }
  });
  it("passes the cases the mock is scripted for (tool plumbing)", async () => {
    const adapter = mockAdapter({ delayMs: 0 });
    for (const c of cases.filter((x) => x.mock)) {
      const grade = gradeDeterministic(c, await runCase(adapter, c), knowledge);
      expect(grade.failures, c.id).toEqual([]);
    }
  });
});
