import type Anthropic from "@anthropic-ai/sdk";
import type { ModelAdapter, ModelResult } from "./model";

/**
 * Scripted model for tests, e2e and screenshots. Keyed by the latest user message.
 * Never used in production unless CHAT_MOCK=1 is set.
 */
type Script = { match: RegExp; text: string; tool?: { name: string; input: Record<string, unknown> } };

export const MOCK_SCRIPTS: Script[] = [
  {
    match: /hiring|hire|role|recruit/i,
    text: "Good fit to check. Shakil is a **fullstack AI engineer** with about 10 years at early-stage startups, most recently the primary backend and AI engineer at Gerald (YC W21). He's open to conversations about AI engineering roles. The fastest way is a 30-minute call.",
    tool: { name: "book_call", input: { reason: "hiring" } },
  },
  {
    match: /voice agent|phone/i,
    text: "That's his core work. He runs fixed-fee pilots: one phone number, one use case, 2 to 4 weeks, with a pass/fail metric agreed before it starts. Pricing is one for a call.",
    tool: { name: "book_call", input: { reason: "voice agent project" } },
  },
  {
    match: /building right now|working on|bench/i,
    text: "Right now he's shipping **Callback AI**, a link-based voice screening agent for recruiters. Also on the bench:\n\n- **Halfband**: AI IELTS prep with a voice examiner\n- **Airlock**: guard and verifier gates for full-access coding agents\n- **agentloop**: fixer and reviewer agents in a PR loop",
    tool: { name: "show_project", input: { id: "callback-ai" } },
  },
  {
    match: /support agent|how the .* worked/i,
    text: "At Gerald, support queries waited minutes for a human. He built a conversational agent with structured tool calling, SSE streaming and conversation state, plus smart actions so the support team resolves issues without engineering. Median response went from **3.5 min to 10 s**, and the app rating from 3.5 to 4.2.",
    tool: { name: "show_project", input: { id: "support-agent" } },
  },
  {
    match: /follow up|get back to me|pass (it|this) on/i,
    text: "Happy to pass it on. Leave your details below and he'll get back to you himself.",
    tool: { name: "leave_intro", input: { topic: "Follow-up request" } },
  },
  {
    match: /book|call|meet/i,
    text: "Here's his calendar. Thirty minutes is usually enough to see if there's a fit.",
    tool: { name: "book_call", input: {} },
  },
];

const DEFAULT_TEXT =
  "That's not something I know about him. I can pass the question to Shakil, or you can book a call.";

function lastUserText(messages: Anthropic.MessageParam[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]!;
    if (m.role !== "user") continue;
    if (typeof m.content === "string") return m.content;
    const text = m.content.find((b) => b.type === "text");
    if (text && "text" in text) return text.text;
    return ""; // tool_result turn
  }
  return "";
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException("aborted", "AbortError"));
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      reject(new DOMException("aborted", "AbortError"));
    });
  });

export function mockAdapter(opts: { delayMs?: number } = {}): ModelAdapter {
  const delay = opts.delayMs ?? 12;
  return {
    name: "mock",
    async call(req, onText): Promise<ModelResult> {
      const last = req.messages.at(-1);
      const afterTool = last?.role === "user" && Array.isArray(last.content) && last.content.some((b) => b.type === "tool_result");
      const userText = lastUserText(req.messages);
      const script = MOCK_SCRIPTS.find((s) => s.match.test(userText));

      // Follow-up call after a tool ran: the text was already streamed on call 1.
      const text = afterTool ? "" : (script?.text ?? DEFAULT_TEXT);
      for (const token of text.match(/\S+\s*|\s+/g) ?? []) {
        await sleep(delay, req.signal);
        onText(token);
      }
      const content: Anthropic.ContentBlock[] = [];
      if (text) content.push({ type: "text", text, citations: null } as Anthropic.TextBlock);
      const useTool = !afterTool && req.toolChoice === "auto" && script?.tool;
      if (useTool) {
        content.push({ type: "tool_use", id: `toolu_mock_${Date.now()}`, name: script.tool!.name, input: script.tool!.input } as Anthropic.ToolUseBlock);
      }
      return {
        content,
        stopReason: useTool ? "tool_use" : "end_turn",
        usage: { input: 40, output: Math.ceil(text.length / 4), cacheRead: 2400, cacheWrite: 0 },
      };
    },
  };
}
