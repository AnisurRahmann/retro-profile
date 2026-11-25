import { describe, expect, it } from "vitest";
import { buildKnowledge } from "@/agent/knowledge-builder";
import { mockAdapter } from "@/agent/mock";
import type { ModelAdapter } from "@/agent/model";
import { createEventParser, encodeEvent, type ChatEvent } from "@/agent/protocol";
import { chatRequestSchema, trimHistory, type ChatMessage } from "@/agent/request";
import { runTurn } from "@/agent/run";
import { buildSystem, RULES } from "@/agent/system";
import { executeTool, PROJECT_IDS, tools } from "@/agent/tools";
import { links } from "@/site";

describe("protocol", () => {
  it("round-trips events through the encoder and an incremental parser", () => {
    const events: ChatEvent[] = [
      { type: "text", delta: "Hello\nworld {\"x\": 1}" },
      { type: "tool", name: "book_call", result: { kind: "book_call", url: links.calendar } },
      { type: "error", code: "rate_limited" },
      { type: "done" },
    ];
    const wire = events.map(encodeEvent).join("");
    const got: ChatEvent[] = [];
    const parser = createEventParser((e) => got.push(e));
    for (let i = 0; i < wire.length; i += 7) parser.push(wire.slice(i, i + 7)); // split mid-line
    parser.end();
    expect(got).toEqual(events);
  });

  it("skips malformed and unknown lines", () => {
    const got: ChatEvent[] = [];
    const parser = createEventParser((e) => got.push(e));
    parser.push('not json\n{"type":"weird"}\n{"type":"done"}');
    parser.end();
    expect(got).toEqual([{ type: "done" }]);
  });
});

describe("request validation", () => {
  const m = (role: "user" | "assistant", content = "hi"): ChatMessage => ({ role, content });
  it("accepts alternating roles starting and ending with user", () => {
    expect(chatRequestSchema.safeParse({ messages: [m("user"), m("assistant"), m("user")] }).success).toBe(true);
  });
  it("rejects non-alternating, assistant-last, too long, too many", () => {
    expect(chatRequestSchema.safeParse({ messages: [m("user"), m("user")] }).success).toBe(false);
    expect(chatRequestSchema.safeParse({ messages: [m("user"), m("assistant")] }).success).toBe(false);
    expect(chatRequestSchema.safeParse({ messages: [m("user", "x".repeat(2001))] }).success).toBe(false);
    const many = Array.from({ length: 31 }, (_, i) => m(i % 2 ? "assistant" : "user"));
    expect(chatRequestSchema.safeParse({ messages: many }).success).toBe(false);
  });
  it("trims to the last 12 messages starting on a user turn", () => {
    const many = Array.from({ length: 25 }, (_, i) => m(i % 2 ? "assistant" : "user", String(i)));
    const trimmed = trimHistory(many);
    expect(trimmed.length).toBeLessThanOrEqual(12);
    expect(trimmed[0]!.role).toBe("user");
    expect(trimmed.at(-1)!.content).toBe("24");
  });
});

describe("tools", () => {
  it("book_call returns the calendar link", () => {
    expect(executeTool("book_call", {}).result).toEqual({ kind: "book_call", url: links.calendar });
  });
  it("show_project resolves projects and case study slugs, and errors on unknown ids without throwing", () => {
    const r = executeTool("show_project", { id: "support-agent" }).result;
    expect(r.kind === "show_project" && r.project.id).toBe("gerald-support-agent");
    expect(executeTool("show_project", { id: "nope" }).result.kind).toBe("error");
    expect(executeTool("show_project", { id: 5 }).result.kind).toBe("error");
  });
  it("leave_intro only asks the UI for a form", () => {
    expect(executeTool("leave_intro", { topic: "x" }).result).toEqual({ kind: "leave_intro", form: true, topic: "x" });
    expect(executeTool("leave_intro", { topic: "x".repeat(201) }).result.kind).toBe("error");
  });
  it("show_project's enum lists every project and case study id", () => {
    const schema = tools.find((t) => t.name === "show_project")!.input_schema as { properties: { id: { enum: string[] } } };
    expect(schema.properties.id.enum).toEqual(PROJECT_IDS);
    expect(PROJECT_IDS).toContain("callback-ai");
    expect(PROJECT_IDS).toContain("plaid");
  });
});

describe("knowledge and system prompt", () => {
  it("fits comfortably in the system prompt (fails over ~15k tokens)", () => {
    const chars = buildSystem()[0]!.text.length;
    expect(chars / 4).toBeLessThan(15_000);
  });
  it("is deterministic (prompt-cache stable) and carries a cache breakpoint", () => {
    expect(buildSystem()).toEqual(buildSystem());
    expect(buildSystem()[0]!.cache_control).toEqual({ type: "ephemeral" });
  });
  it("contains no placeholders and no forbidden topics", () => {
    const k = buildKnowledge();
    expect(k).not.toContain("[[");
    for (const banned of ["visa", "relocat", "salary", "UK"]) expect(k).not.toContain(banned);
    expect(RULES).toContain("Shakil's agent");
  });
});

describe("runTurn", () => {
  const collect = async (adapter: ModelAdapter, text: string) => {
    const events: ChatEvent[] = [];
    const stats = await runTurn({ adapter, history: [{ role: "user", content: text }], emit: (e) => events.push(e) });
    return { events, stats };
  };

  it("streams text and emits one tool event for hiring intent", async () => {
    const { events, stats } = await collect(mockAdapter({ delayMs: 0 }), "I'm hiring an AI engineer");
    expect(events.filter((e) => e.type === "text").length).toBeGreaterThan(3);
    expect(events.filter((e) => e.type === "tool")).toHaveLength(1);
    expect(stats.toolName).toBe("book_call");
    expect(stats.modelCalls).toBeLessThanOrEqual(2);
  });

  it("makes at most two model calls and forces no tools on the second", async () => {
    const choices: string[] = [];
    const adapter: ModelAdapter = {
      name: "always-tool",
      async call(req) {
        choices.push(req.toolChoice);
        return {
          content: [{ type: "tool_use", id: `t${choices.length}`, name: "book_call", input: {}, caller: { type: "direct" } }] as never,
          stopReason: "tool_use",
          usage: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0 },
        };
      },
    };
    const { stats } = await collect(adapter, "hi");
    expect(choices).toEqual(["auto", "none"]);
    expect(stats.modelCalls).toBe(2);
  });

  it("never runs a tool when the turn was cut off at max_tokens", async () => {
    const adapter: ModelAdapter = {
      name: "truncated",
      async call() {
        return {
          content: [{ type: "tool_use", id: "t", name: "book_call", input: {} }] as never,
          stopReason: "max_tokens",
          usage: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0 },
        };
      },
    };
    const { events } = await collect(adapter, "hi");
    expect(events.some((e) => e.type === "tool")).toBe(false);
  });
});
