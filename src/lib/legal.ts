import { readFileSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import { marked } from "marked";
import { z } from "zod";

/**
 * Build Box legal pages required by Meta app review (/fb-privacy, /fb-data-deletion).
 * Content is content/legal/*.md, carried over unchanged. Trusted first-party markdown, rendered at build time.
 */
const frontmatterSchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  heading: z.string().min(1),
  lede: z.string().min(1),
  description: z.string().min(1),
  updated: z.string().min(1),
});

export type LegalDoc = z.infer<typeof frontmatterSchema> & { html: string };

export function legalDoc(slug: "fb-privacy" | "fb-data-deletion"): LegalDoc {
  const parsed = matter(readFileSync(join(process.cwd(), "content", "legal", `${slug}.md`), "utf8"));
  return { ...frontmatterSchema.parse(parsed.data), html: marked.parse(parsed.content, { async: false }) };
}
