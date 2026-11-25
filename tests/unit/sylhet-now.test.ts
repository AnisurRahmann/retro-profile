import { describe, expect, it } from "vitest";
// WEATHER_MOCK=1 comes from vitest.config.ts: no network.
import { mockAdapter } from "@/agent/mock";
import type { ModelAdapter } from "@/agent/model";
import type { ChatEvent } from "@/agent/protocol";
import { runTurn } from "@/agent/run";
import { executeDataTool, sylhetNow } from "@/agent/sylhet-now";
import { RULES } from "@/agent/system";
import { DATA_TOOLS, tools } from "@/agent/tools";
import { dhakaDate } from "@/lib/sky/time";

const at = dhakaDate(2026, 12, 15, 2 * 60 + 10); // 02:10 in Sylhet

describe("sylhet_now", () => {
  it("is a no-input data tool", () => {
    const t = tools.find((x) => x.name === "sylhet_now")!;
    expect(t.input_schema).toEqual({ type: "object", properties: {}, additionalProperties: false });
    expect(DATA_TOOLS.has("sylhet_now")).toBe(true);
  });

  it("returns Asia/Dhaka time, a weather line and night", async () => {
    const r = await sylhetNow(at);
    expect(r).toEqual({ time: "02:10", weatherSummary: "21°C, foggy", isNight: true });
    expect((await sylhetNow(dhakaDate(2026, 12, 15, 12 * 60))).isNight).toBe(false);
    expect(JSON.parse((await executeDataTool("sylhet_now", {}, () => at)).forModel).time).toBe("02:10");
    expect((await executeDataTool("nope", {})).isError).toBe(true);
  });

  it("always makes the second call after a data tool, even if the model spoke first, and emits no card", async () => {
    const events: ChatEvent[] = [];
    const stats = await runTurn({
      adapter: mockAdapter({ delayMs: 0 }),
      history: [{ role: "user", content: "Is he awake?" }],
      emit: (e) => events.push(e),
      now: () => at,
    });
    expect(stats.toolName).toBe("sylhet_now");
    expect(stats.modelCalls).toBe(2);
    expect(stats.text).toContain("It's 02:10 in Sylhet right now.");
    expect(events.some((e) => e.type === "tool")).toBe(false);

    let calls = 0;
    const chatty: ModelAdapter = {
      name: "chatty",
      async call(req, onText) {
        calls++;
        if (calls === 1) {
          onText("Let me check.");
          return {
            content: [
              { type: "text", text: "Let me check.", citations: null },
              { type: "tool_use", id: "t1", name: "sylhet_now", input: {} },
            ] as never,
            stopReason: "tool_use",
            usage: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0 },
          };
        }
        expect(req.toolChoice).toBe("none");
        onText("It's 02:10 in Sylhet.");
        return { content: [], stopReason: "end_turn", usage: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0 } };
      },
    };
    const s2 = await runTurn({ adapter: chatty, history: [{ role: "user", content: "Is he up?" }], emit: () => {}, now: () => at });
    expect(s2.text).toBe("Let me check. It's 02:10 in Sylhet.");
  });

  it("is governed by a rule that forbids speculation", () => {
    expect(RULES).toContain("<local_time>");
    expect(RULES).toMatch(/Never speculate about his sleep, schedule/);
  });
});
