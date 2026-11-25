/**
 * /api/chat wire protocol: newline-delimited JSON events.
 */
import type { ToolEventResult } from "./tools";

export type ErrorCode = "rate_limited" | "budget" | "disabled" | "bad_request" | "forbidden" | "unavailable" | "upstream";

export type ChatEvent =
  | { type: "text"; delta: string }
  | { type: "tool"; name: string; result: ToolEventResult }
  | { type: "done" }
  | { type: "error"; code: ErrorCode };

export function encodeEvent(event: ChatEvent): string {
  return JSON.stringify(event) + "\n";
}

const EVENT_TYPES = new Set(["text", "tool", "done", "error"]);

function isChatEvent(v: unknown): v is ChatEvent {
  return typeof v === "object" && v !== null && EVENT_TYPES.has((v as { type?: string }).type ?? "");
}

/** Incremental parser: feed it decoded chunks, it calls onEvent per complete line. Bad lines are skipped. */
export function createEventParser(onEvent: (event: ChatEvent) => void) {
  let buffer = "";
  const flushLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (isChatEvent(parsed)) onEvent(parsed);
    } catch {
      /* ignore malformed line */
    }
  };
  return {
    push(chunk: string) {
      buffer += chunk;
      let nl = buffer.indexOf("\n");
      while (nl !== -1) {
        flushLine(buffer.slice(0, nl));
        buffer = buffer.slice(nl + 1);
        nl = buffer.indexOf("\n");
      }
    },
    end() {
      flushLine(buffer);
      buffer = "";
    },
  };
}
