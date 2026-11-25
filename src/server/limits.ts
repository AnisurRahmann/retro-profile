import "server-only";
import { env } from "./env";
import { db } from "./supabase";

export const LIMITS = {
  chat: { hour: 20, day: 60 },
  intro: { hour: 5, day: 5 },
} as const;

export type Kind = keyof typeof LIMITS;
export type LimitOutcome = "ok" | "rate_limited" | "budget";

/**
 * Per-instance token bucket: capacity = hourly limit, refilled linearly over an hour.
 * The primary limiter in mock mode, and the backstop when the Supabase RPC fails at runtime.
 */
const buckets = new Map<string, { tokens: number; at: number }>();
const HOUR_MS = 3_600_000;

export function bucketTake(hash: string, kind: Kind, now = Date.now()): boolean {
  const cap = LIMITS[kind].hour;
  const key = `${kind}:${hash}`;
  const b = buckets.get(key) ?? { tokens: cap, at: now };
  b.tokens = Math.min(cap, b.tokens + ((now - b.at) / HOUR_MS) * cap);
  b.at = now;
  const ok = b.tokens >= 1;
  if (ok) b.tokens -= 1;
  buckets.set(key, b);
  if (buckets.size > 10_000) buckets.delete(buckets.keys().next().value!); // bound memory
  return ok;
}

let memoryBudget = 0;
let warned = 0;
function warn(what: string) {
  const now = Date.now();
  if (now - warned < 60_000) return; // at most once a minute per instance
  warned = now;
  console.warn(`[chat] ${what} failed; failing open with the in-memory rate limit backstop`);
}

/**
 * Counts one request against the visitor's hourly and daily windows (atomic Postgres function) and, for chat,
 * checks the global daily token budget.
 *
 * Missing configuration never reaches here: getChatAvailability() returns 503 first. A runtime RPC error
 * fails OPEN, limited by the per-instance token bucket (see docs/DECISIONS.md).
 */
export async function consume(hash: string, kind: Kind): Promise<LimitOutcome> {
  const client = db();
  if (!client) {
    // Mock mode only.
    if (!bucketTake(hash, kind)) return "rate_limited";
    return kind === "chat" && memoryBudget >= env.dailyBudget ? "budget" : "ok";
  }
  const { data: allowed, error } = await client.rpc("rate_consume", {
    p_hash: hash,
    p_kind: kind,
    p_hour_limit: LIMITS[kind].hour,
    p_day_limit: LIMITS[kind].day,
  });
  if (error) {
    warn("rate_consume RPC");
    return bucketTake(hash, kind) ? "ok" : "rate_limited";
  }
  if (!allowed) return "rate_limited";
  if (kind === "chat") {
    const { data: underBudget, error: budgetError } = await client.rpc("budget_available", { p_limit: env.dailyBudget });
    if (budgetError) warn("budget_available RPC");
    else if (!underBudget) return "budget";
  }
  return "ok";
}

export async function addSpend(outputTokens: number): Promise<void> {
  const client = db();
  if (!client) {
    memoryBudget += outputTokens;
    return;
  }
  const { error } = await client.rpc("budget_add", { p_tokens: outputTokens });
  if (error) warn("budget_add RPC");
}

/** Test hook. */
export function __resetLimits() {
  buckets.clear();
  memoryBudget = 0;
}
