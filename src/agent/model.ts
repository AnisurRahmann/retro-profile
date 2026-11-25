import Anthropic from "@anthropic-ai/sdk";

export const DEFAULT_MODEL = "claude-haiku-5-5";
export const MAX_TOKENS = 700;

export type ModelRequest = {
  system: Anthropic.TextBlockParam[];
  messages: Anthropic.MessageParam[];
  tools: Anthropic.Tool[];
  /** "auto" on the first call of a turn, "none" on the follow-up after a tool ran. */
  toolChoice: "auto" | "none";
  signal?: AbortSignal;
};

export type ModelResult = {
  content: Anthropic.ContentBlock[];
  stopReason: Anthropic.Message["stop_reason"];
  usage: { input: number; output: number; cacheRead: number; cacheWrite: number };
};

/** One model call. Streams text deltas through onText and resolves with the final message. */
export interface ModelAdapter {
  readonly name: string;
  call(req: ModelRequest, onText: (delta: string) => void): Promise<ModelResult>;
}

export function anthropicAdapter(opts: { apiKey?: string; model?: string } = {}): ModelAdapter {
  const client = new Anthropic({ apiKey: opts.apiKey ?? process.env.ANTHROPIC_API_KEY, maxRetries: 1 });
  const model = opts.model ?? process.env.CHAT_MODEL ?? DEFAULT_MODEL;
  return {
    name: `anthropic:${model}`,
    async call(req, onText) {
      const stream = client.messages.stream(
        {
          model,
          max_tokens: MAX_TOKENS,
          system: req.system,
          messages: req.messages,
          tools: req.tools,
          tool_choice:
            req.toolChoice === "auto" ? { type: "auto", disable_parallel_tool_use: true } : { type: "none" },
          output_config: { effort: "low" },
        },
        { signal: req.signal },
      );
      stream.on("text", onText);
      const message = await stream.finalMessage();
      return {
        content: message.content,
        stopReason: message.stop_reason,
        usage: {
          input: message.usage.input_tokens,
          output: message.usage.output_tokens,
          cacheRead: message.usage.cache_read_input_tokens ?? 0,
          cacheWrite: message.usage.cache_creation_input_tokens ?? 0,
        },
      };
    },
  };
}
