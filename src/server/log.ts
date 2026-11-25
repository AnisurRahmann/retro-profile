import "server-only";
import type { TurnStats } from "@/agent/run";
import { db } from "./supabase";

/** Logs one turn. Runs after the response finished; failures are swallowed and never reach the visitor. */
export async function logTurn(t: {
  sessionId: string;
  ipHash: string;
  uaFamily: string;
  userMessage: string;
  stats: TurnStats | null;
  latencyMs: number;
}): Promise<void> {
  const client = db();
  if (!client) return;
  try {
    await client
      .from("chat_sessions")
      .upsert({ id: t.sessionId, ip_hash: t.ipHash, user_agent_family: t.uaFamily }, { onConflict: "id", ignoreDuplicates: true });
    const rows: Record<string, unknown>[] = [{ session_id: t.sessionId, role: "user", content: t.userMessage }];
    if (t.stats) {
      rows.push({
        session_id: t.sessionId,
        role: "assistant",
        content: t.stats.text,
        tool_name: t.stats.toolName,
        input_tokens: t.stats.usage.input,
        output_tokens: t.stats.usage.output,
        cache_read_tokens: t.stats.usage.cacheRead,
        latency_ms: t.latencyMs,
      });
    }
    await client.from("chat_messages").insert(rows);
  } catch (err) {
    console.error("chat log failed", err instanceof Error ? err.message : "unknown");
  }
}
