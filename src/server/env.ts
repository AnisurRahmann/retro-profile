import "server-only";

export const env = {
  get anthropicKey() {
    return process.env.ANTHROPIC_API_KEY ?? "";
  },
  get mock() {
    return process.env.CHAT_MOCK === "1";
  },
  get chatEnabled() {
    return process.env.CHAT_ENABLED !== "false";
  },
  get dailyBudget() {
    const n = Number(process.env.CHAT_DAILY_TOKEN_BUDGET ?? 2_000_000);
    return Number.isFinite(n) && n > 0 ? n : 2_000_000;
  },
  get salt() {
    return process.env.RATE_SALT ?? "";
  },
  get supabase() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    return url && key ? { url, key } : null;
  },
  get resend() {
    const key = process.env.RESEND_API_KEY;
    const to = process.env.INTRO_NOTIFY_EMAIL;
    const from = process.env.INTRO_FROM_EMAIL;
    return key && to && from ? { key, to, from } : null;
  },
};
