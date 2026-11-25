import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

const verdictSchema = z.object({
  grounded: z.boolean(),
  unsupported_claims: z.array(z.string()),
  verdict: z.enum(["pass", "fail"]),
});
export type Verdict = z.infer<typeof verdictSchema>;

const RUBRIC = `You are a strict evaluator. Decide whether an AI agent's answer is grounded in a knowledge base.

Rules:
- Every factual claim about Shakil (numbers, dates, employers, projects, tools, opinions) must be directly supported by the knowledge base.
- Paraphrase is fine. Rounding or inventing numbers is not.
- Offers to book a call or pass a message on are not claims.
- If any claim is unsupported, grounded is false and verdict is "fail". List each unsupported claim verbatim.`;

export async function judgeGroundedness(
  client: Anthropic,
  model: string,
  knowledge: string,
  question: string,
  answer: string,
): Promise<{ verdict: Verdict | null; usage: { input: number; output: number } }> {
  const response = await client.messages.parse({
    model,
    max_tokens: 1024,
    system: [{ type: "text", text: `${RUBRIC}\n\n<knowledge_base>\n${knowledge}</knowledge_base>`, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: `<question>${question}</question>\n<answer>${answer}</answer>` }],
    output_config: { format: zodOutputFormat(verdictSchema) },
  });
  return {
    verdict: response.parsed_output ?? null,
    usage: { input: response.usage.input_tokens, output: response.usage.output_tokens },
  };
}
