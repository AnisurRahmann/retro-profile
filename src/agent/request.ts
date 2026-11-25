import { z } from "zod";

export const MAX_MESSAGES = 30;
export const MAX_CHARS = 2000;
export const SENT_TO_MODEL = 12;

export const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(MAX_CHARS),
});
export type ChatMessage = z.infer<typeof chatMessageSchema>;

export const chatRequestSchema = z
  .object({
    sessionId: z.uuid().optional(),
    messages: z.array(chatMessageSchema).min(1).max(MAX_MESSAGES),
  })
  .refine((r) => r.messages[0]?.role === "user" && r.messages.at(-1)?.role === "user", {
    message: "conversation must start and end with a user message",
  })
  .refine((r) => r.messages.every((m, i) => i === 0 || m.role !== r.messages[i - 1]!.role), {
    message: "roles must alternate",
  });

/** Keep the last N messages, starting on a user turn. */
export function trimHistory(messages: ChatMessage[], keep = SENT_TO_MODEL): ChatMessage[] {
  let out = messages.slice(-keep);
  while (out.length > 0 && out[0]!.role !== "user") out = out.slice(1);
  return out;
}
