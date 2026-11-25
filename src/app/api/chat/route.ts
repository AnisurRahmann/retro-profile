import Anthropic from "@anthropic-ai/sdk";
import { after } from "next/server";
import { mockAdapter } from "@/agent/mock";
import { anthropicAdapter, type ModelAdapter } from "@/agent/model";
import { encodeEvent, type ChatEvent, type ErrorCode } from "@/agent/protocol";
import { chatRequestSchema, trimHistory } from "@/agent/request";
import { runTurn, type TurnStats } from "@/agent/run";
import { env } from "@/server/env";
import { addSpend, consume } from "@/server/limits";
import { logTurn } from "@/server/log";
import { ipHash, sameOrigin, userAgentFamily } from "@/server/request-meta";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const STATUS: Record<ErrorCode, number> = {
  rate_limited: 429,
  budget: 429,
  disabled: 503,
  bad_request: 400,
  forbidden: 403,
  unavailable: 503,
  upstream: 502,
};

function errorResponse(code: ErrorCode) {
  return new Response(encodeEvent({ type: "error", code }), {
    status: STATUS[code],
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" },
  });
}

let adapter: ModelAdapter | null = null;
function getAdapter(): ModelAdapter | null {
  if (adapter) return adapter;
  if (env.mock) return (adapter = mockAdapter());
  if (!env.anthropicKey) return null;
  return (adapter = anthropicAdapter());
}

export async function POST(req: Request) {
  if (!env.chatEnabled) return errorResponse("disabled");
  if (!sameOrigin(req)) return errorResponse("forbidden");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse("bad_request");
  }
  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) return errorResponse("bad_request");

  const model = getAdapter();
  if (!model) return errorResponse("unavailable");

  const hash = ipHash(req);
  const limit = await consume(hash, "chat");
  if (limit !== "ok") return errorResponse(limit);

  const history = trimHistory(parsed.data.messages);
  const userMessage = history.at(-1)!.content;
  const sessionId = parsed.data.sessionId ?? crypto.randomUUID();
  const started = Date.now();
  let stats: TurnStats | null = null;

  // Upstream is aborted when the visitor disconnects (or presses Stop).
  const upstream = new AbortController();
  req.signal.addEventListener("abort", () => upstream.abort());

  after(async () => {
    if (stats) await addSpend(stats.usage.output).catch(() => undefined);
    await logTurn({
      sessionId,
      ipHash: hash,
      uaFamily: userAgentFamily(req),
      userMessage,
      stats,
      latencyMs: Date.now() - started,
    });
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;
      const emit = (e: ChatEvent) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(encodeEvent(e)));
        } catch {
          open = false;
        }
      };
      try {
        stats = await runTurn({ adapter: model, history, emit, signal: upstream.signal });
        emit(stats.stopReason === "refusal" && !stats.text ? { type: "error", code: "upstream" } : { type: "done" });
      } catch (err) {
        if (!upstream.signal.aborted) {
          const code: ErrorCode = err instanceof Anthropic.RateLimitError ? "unavailable" : "upstream";
          console.error("chat turn failed", err instanceof Error ? err.name : "unknown");
          emit({ type: "error", code });
        }
      } finally {
        open = false;
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
    cancel() {
      upstream.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
      "x-accel-buffering": "no",
    },
  });
}
