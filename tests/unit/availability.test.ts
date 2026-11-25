import { describe, expect, it } from "vitest";
import { getChatAvailability } from "@/agent/availability";
import { bucketTake, LIMITS } from "@/server/limits";

const full = {
  ANTHROPIC_API_KEY: "sk-test",
  SUPABASE_URL: "https://abc.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-role",
  RATE_SALT: "0123456789abcdef0123",
};

describe("getChatAvailability", () => {
  it("is enabled with every required var and CHAT_ENABLED unset or 'true'", () => {
    expect(getChatAvailability(full)).toEqual({ enabled: true });
    expect(getChatAvailability({ ...full, CHAT_ENABLED: "true" })).toEqual({ enabled: true });
    expect(getChatAvailability({ ...full, CHAT_ENABLED: "" })).toEqual({ enabled: true });
  });

  it("is disabled by CHAT_ENABLED=false even when everything else is set (and in mock mode)", () => {
    expect(getChatAvailability({ ...full, CHAT_ENABLED: "false" })).toEqual({ enabled: false, reason: "disabled" });
    expect(getChatAvailability({ CHAT_MOCK: "1", CHAT_ENABLED: "false" })).toEqual({ enabled: false, reason: "disabled" });
  });

  it("parses CHAT_ENABLED strictly", () => {
    for (const v of ["1", "yes", "TRUE", "False", "off"]) {
      expect(getChatAvailability({ ...full, CHAT_ENABLED: v })).toEqual({
        enabled: false,
        reason: "misconfigured",
        missing: ["CHAT_ENABLED"],
      });
    }
  });

  it("lists missing required vars by name, treating blanks as missing", () => {
    expect(getChatAvailability({})).toEqual({
      enabled: false,
      reason: "missing_env",
      missing: ["ANTHROPIC_API_KEY", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "RATE_SALT"],
    });
    expect(getChatAvailability({ ...full, ANTHROPIC_API_KEY: "  " })).toMatchObject({ missing: ["ANTHROPIC_API_KEY"] });
    expect(getChatAvailability({ ...full, SUPABASE_URL: undefined, RATE_SALT: "" })).toMatchObject({
      reason: "missing_env",
      missing: ["SUPABASE_URL", "RATE_SALT"],
    });
  });

  it("flags invalid values as misconfigured, by name only", () => {
    const a = getChatAvailability({ ...full, SUPABASE_URL: "not a url", RATE_SALT: "short" });
    expect(a.reason).toBe("misconfigured");
    expect(a.missing?.sort()).toEqual(["RATE_SALT", "SUPABASE_URL"]);
    expect(JSON.stringify(a)).not.toContain("not a url");
  });

  it("CHAT_MODEL is optional", () => {
    expect(getChatAvailability({ ...full, CHAT_MODEL: "" }).enabled).toBe(true);
  });

  it("mock mode needs no external services", () => {
    expect(getChatAvailability({ CHAT_MOCK: "1" })).toEqual({ enabled: true });
  });
});

describe("in-memory rate limit backstop", () => {
  it("allows the hourly limit, then refuses until it refills", () => {
    const t0 = 1_000_000;
    const hash = `h-${Math.random()}`;
    for (let i = 0; i < LIMITS.chat.hour; i++) expect(bucketTake(hash, "chat", t0)).toBe(true);
    expect(bucketTake(hash, "chat", t0)).toBe(false);
    expect(bucketTake(hash, "chat", t0 + 3_600_000 / LIMITS.chat.hour + 1)).toBe(true);
  });
});

describe("dev startup log", () => {
  it("logs missing names once in development, never values, and nothing in production", async () => {
    const { vi } = await import("vitest");
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const mod = await import("@/agent/availability");
    mod.logChatAvailabilityOnce({ NODE_ENV: "production" });
    expect(spy).not.toHaveBeenCalled();
    mod.logChatAvailabilityOnce({ NODE_ENV: "development", ANTHROPIC_API_KEY: "sk-secret-value" });
    mod.logChatAvailabilityOnce({ NODE_ENV: "development" });
    expect(spy).toHaveBeenCalledTimes(1);
    const line = String(spy.mock.calls[0]![0]);
    expect(line).toMatch(/^\[chat\]/);
    expect(line).toContain("SUPABASE_URL");
    expect(line).not.toContain("sk-secret-value");
    spy.mockRestore();
  });
});
