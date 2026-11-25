import "server-only";
import { env } from "./env";
import { db } from "./supabase";

export const LIMITS = {
  chat: { hour: 20, day: 60 },
  intro: { hour: 5, day: 5 },
} as const;

export type LimitOutcome = "ok" | "rate_limited" | "budget" | "unavailable";

/** In-memory fallback, used ONLY in mock mode (tests, e2e, screenshots). */
const memory = new Map<string, number>();
let memoryBudget = 0;
function memoryConsume(hash: string, kind: keyof typeof LIMITS): boolean {
  const now = new Date();
  const h = `${hash}:${kind}:h:${now.toISOString().slice(0, 13)}`;
  const d = `${hash}:${kind}:d:${now.toISOString().slice(0, 10)}`;
  memory.set(h, (memory.get(h) ?? 0) + 1);
  memory.set(d, (memory.get(d) ?? 0) + 1);
  return memory.get(h)! <= LIMITS[kind].hour && memory.get(d)! <= LIMITS[kind].day;
}

/**
 * Counts one request against the visitor's hourly and daily windows (atomic Postgres function),
 * and for chat also checks the global daily token budget. Fails closed when the store is unreachable.
 */
export async function consume(hash: string, kind: keyof typeof LIMITS): Promise<LimitOutcome> {
  const client = db();
  if (!client) {
    if (!env.mock) return "unavailable";
    if (!memoryConsume(hash, kind)) return "rate_limited";
    return kind === "chat" && memoryBudget >= env.dailyBudget ? "budget" : "ok";
  }
  const { data: allowed, error } = await client.rpc("rate_consume", {
    p_hash: hash,
    p_kind: kind,
    p_hour_limit: LIMITS[kind].hour,
    p_day_limit: LIMITS[kind].day,
  });
  if (error) return "unavailable";
  if (!allowed) return "rate_limited";
  if (kind === "chat") {
    const { data: underBudget, error: budgetError } = await client.rpc("budget_available", { p_limit: env.dailyBudget });
    if (budgetError) return "unavailable";
    if (!underBudget) return "budget";
  }
  return "ok";
}

export async function addSpend(outputTokens: number): Promise<void> {
  const client = db();
  if (!client) {
    memoryBudget += outputTokens;
    return;
  }
  await client.rpc("budget_add", { p_tokens: outputTokens });
}

/** Test hook for the in-memory store. */
export function __resetMemoryLimits() {
  memory.clear();
  memoryBudget = 0;
}
