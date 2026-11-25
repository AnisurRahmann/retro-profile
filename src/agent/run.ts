import type Anthropic from "@anthropic-ai/sdk";
import type { ModelAdapter, ModelResult } from "./model";
import type { ChatEvent } from "./protocol";
import type { ChatMessage } from "./request";
import { buildSystem } from "./system";
import { executeTool, tools } from "./tools";

export const MAX_MODEL_CALLS = 2;

export type TurnStats = {
  text: string;
  toolName: string | null;
  usage: ModelResult["usage"];
  modelCalls: number;
  stopReason: ModelResult["stopReason"];
};

let cachedSystem: Anthropic.TextBlockParam[] | null = null;
const systemBlocks = () => (cachedSystem ??= buildSystem());

/**
 * Runs one visitor turn: at most two model calls, at most one tool.
 * Call 1 may use a tool; call 2 (only if a tool ran) is forced to plain text.
 */
export async function runTurn(opts: {
  adapter: ModelAdapter;
  history: ChatMessage[];
  emit: (e: ChatEvent) => void;
  signal?: AbortSignal;
}): Promise<TurnStats> {
  const { adapter, emit, signal } = opts;
  const messages: Anthropic.MessageParam[] = opts.history.map((m) => ({ role: m.role, content: m.content }));
  const usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  let text = "";
  let toolName: string | null = null;
  let calls = 0;
  let stopReason: ModelResult["stopReason"] = null;

  const onText = (delta: string) => {
    text += delta;
    emit({ type: "text", delta });
  };
  const add = (u: ModelResult["usage"]) => {
    usage.input += u.input;
    usage.output += u.output;
    usage.cacheRead += u.cacheRead;
    usage.cacheWrite += u.cacheWrite;
  };

  const first = await adapter.call({ system: systemBlocks(), messages, tools, toolChoice: "auto", signal }, onText);
  calls++;
  add(first.usage);
  stopReason = first.stopReason;

  const toolUse = first.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
  // Never run a tool whose input may be truncated or that came with a refusal.
  if (toolUse && first.stopReason === "tool_use" && calls < MAX_MODEL_CALLS) {
    const { result, forModel } = executeTool(toolUse.name, toolUse.input);
    if (result.kind !== "error") {
      toolName = toolUse.name;
      emit({ type: "tool", name: toolUse.name, result });
    }
    messages.push({ role: "assistant", content: first.content });
    messages.push({
      role: "user",
      content: [{ type: "tool_result", tool_use_id: toolUse.id, content: forModel, is_error: result.kind === "error" }],
    });
    // Only continue if the model hasn't said anything yet, or the tool failed and needs a recovery line.
    if (text.trim() === "" || result.kind === "error") {
      if (text && !/\s$/.test(text)) onText("\n\n");
      const second = await adapter.call({ system: systemBlocks(), messages, tools, toolChoice: "none", signal }, onText);
      calls++;
      add(second.usage);
      stopReason = second.stopReason;
    }
  }

  return { text, toolName, usage, modelCalls: calls, stopReason };
}
