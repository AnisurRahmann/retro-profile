import "server-only";
import { createHash } from "node:crypto";
import { env } from "./env";

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

export function ipHash(req: Request): string {
  return createHash("sha256").update(clientIp(req) + env.salt).digest("hex");
}

/** Same-origin POSTs only: Origin must be present and match the Host. */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function userAgentFamily(req: Request): string {
  const ua = req.headers.get("user-agent") ?? "";
  if (/bot|crawl|spider|curl|wget|python|httpclient/i.test(ua)) return "bot";
  if (/Edg\//.test(ua)) return "edge";
  if (/Firefox\//.test(ua)) return "firefox";
  if (/Chrome\//.test(ua)) return "chrome";
  if (/Safari\//.test(ua)) return "safari";
  return "other";
}
