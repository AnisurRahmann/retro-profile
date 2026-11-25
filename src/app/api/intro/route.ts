import { Resend } from "resend";
import { z } from "zod";
import { env } from "@/server/env";
import { consume } from "@/server/limits";
import { ipHash, sameOrigin } from "@/server/request-meta";
import { db } from "@/server/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const introSchema = z.object({
  sessionId: z.uuid().optional(),
  name: z.string().trim().min(1).max(80),
  email: z.email().max(200),
  topic: z.string().trim().max(200).default(""),
  message: z.string().trim().max(1000).default(""),
  consent: z.literal(true),
  /** Honeypot: humans never see it. */
  website: z.string().max(0).optional(),
  context: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(2000) }))
    .max(6)
    .default([]),
});

const json = (status: number, body: Record<string, unknown>) =>
  Response.json(body, { status, headers: { "cache-control": "no-store" } });

export async function POST(req: Request) {
  if (!sameOrigin(req)) return json(403, { ok: false, code: "forbidden" });
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return json(400, { ok: false, code: "bad_request" });
  }
  // A filled honeypot gets a quiet success so bots learn nothing.
  if (typeof raw === "object" && raw !== null && "website" in raw && (raw as { website?: unknown }).website) {
    return json(200, { ok: true });
  }
  const parsed = introSchema.safeParse(raw);
  if (!parsed.success) return json(400, { ok: false, code: "bad_request" });
  const intro = parsed.data;

  const limit = await consume(ipHash(req), "intro");
  if (limit !== "ok") return json(429, { ok: false, code: "rate_limited" });

  const client = db();
  const mail = env.resend;
  if (!client || !mail) {
    // Mock mode (tests, e2e) accepts without side effects. Production without config refuses.
    return env.mock ? json(200, { ok: true }) : json(503, { ok: false, code: "unavailable" });
  }

  const { error } = await client.from("intros").insert({
    session_id: intro.sessionId ?? null,
    name: intro.name,
    email: intro.email,
    topic: intro.topic,
    message: intro.message,
  });
  if (error) return json(503, { ok: false, code: "unavailable" });

  const transcript = intro.context.map((m) => `${m.role === "user" ? "Visitor" : "Agent"}: ${m.content}`).join("\n\n");
  try {
    await new Resend(mail.key).emails.send({
      from: mail.from,
      to: mail.to,
      replyTo: intro.email,
      subject: `Intro from ${intro.name}${intro.topic ? `: ${intro.topic}` : ""}`.slice(0, 180),
      text: [
        `Name: ${intro.name}`,
        `Email: ${intro.email}`,
        `Topic: ${intro.topic || "(none)"}`,
        "",
        intro.message || "(no message)",
        "",
        "--- Last messages ---",
        transcript || "(none)",
      ].join("\n"),
    });
  } catch {
    // The intro is stored; the email can be re-sent from the table. Still a success for the visitor.
    console.error("intro email failed");
  }
  return json(200, { ok: true });
}
