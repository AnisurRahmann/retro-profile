import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env";

let client: SupabaseClient | null | undefined;

/** Service-role client, server only. Null when Supabase isn't configured. */
export function db(): SupabaseClient | null {
  if (client !== undefined) return client;
  const cfg = env.supabase;
  client = cfg ? createClient(cfg.url, cfg.key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
  return client;
}
