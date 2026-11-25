import { z } from "zod";
import { DEFAULT_MODEL } from "./model";

/**
 * Single source of truth for "is the chat agent available?". The /chat page and /api/chat both call this,
 * so they can never disagree. Reads env only; no network.
 */
export type ChatAvailability = {
  enabled: boolean;
  reason?: "disabled" | "missing_env" | "misconfigured";
  /** Env var NAMES (never values) that are missing or invalid. */
  missing?: string[];
};

type Env = Record<string, string | undefined>;

export const REQUIRED_ENV = ["ANTHROPIC_API_KEY", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "RATE_SALT"] as const;

const blankToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

const flagSchema = z.preprocess(blankToUndefined, z.enum(["true", "false"]).default("true"));

const chatEnvSchema = z.object({
  ANTHROPIC_API_KEY: z.string().min(1),
  CHAT_MODEL: z.preprocess(blankToUndefined, z.string().min(1).default(DEFAULT_MODEL)),
  SUPABASE_URL: z.url({ protocol: /^https?$/ }),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  RATE_SALT: z.string().min(16),
});
export type ChatEnv = z.infer<typeof chatEnvSchema>;

export function getChatAvailability(env: Env = process.env): ChatAvailability {
  const flag = flagSchema.safeParse(env.CHAT_ENABLED);
  if (!flag.success) return { enabled: false, reason: "misconfigured", missing: ["CHAT_ENABLED"] };
  if (flag.data === "false") return { enabled: false, reason: "disabled" };

  // Mock mode (tests, e2e, screenshots): scripted model and in-memory limits, no external services.
  if (env.CHAT_MOCK === "1") return { enabled: true };

  const missing = REQUIRED_ENV.filter((name) => blankToUndefined(env[name]) === undefined);
  if (missing.length) return { enabled: false, reason: "missing_env", missing };

  const parsed = chatEnvSchema.safeParse(env);
  if (!parsed.success) {
    const bad = Array.from(new Set(parsed.error.issues.map((i) => String(i.path[0]))));
    return { enabled: false, reason: "misconfigured", missing: bad };
  }
  return { enabled: true };
}

let logged = false;
/** Development only: log missing/invalid var names once, with a [chat] prefix. Never values. */
export function logChatAvailabilityOnce(env: Env = process.env): void {
  if (logged || env.NODE_ENV !== "development") return;
  logged = true;
  const a = getChatAvailability(env);
  if (a.enabled) return;
  if (a.reason === "disabled") console.warn("[chat] disabled (CHAT_ENABLED=false)");
  else console.warn(`[chat] unavailable (${a.reason}): ${a.missing?.join(", ")}. Add them to .env.local.`);
}
