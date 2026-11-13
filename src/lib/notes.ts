import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import { z } from "zod";

/**
 * The seven posts in content/blogs, migrated as they are.
 * Format: YAML frontmatter, then chapters. Each chapter is a "## kind" line followed by "key: value" lines.
 */

const frontmatterSchema = z.object({
  id: z.string().min(1),
  date: z.string().min(1),
  year: z.coerce.string(),
  cat: z.string().min(1),
  read: z.string().min(1),
  title: z.string().min(1),
  excerpt: z.string().min(1),
});

export type Chapter =
  | { kind: "title"; eyebrow?: string; title: string; sub?: string }
  | { kind: "body"; head?: string; body: string }
  | { kind: "quote"; q: string }
  | { kind: "end"; cta?: string; href?: string };

export type Note = z.infer<typeof frontmatterSchema> & { slug: string; order: number; chapters: Chapter[] };

const DIR = join(process.cwd(), "content", "blogs");

function unquote(value: string): string {
  const trimmed = value.trim();
  return /^".*"$/.test(trimmed) ? trimmed.slice(1, -1) : trimmed;
}

function parseChapters(body: string): Chapter[] {
  const chapters: Chapter[] = [];
  for (const block of body.split(/^## /m).slice(1)) {
    const [kindLine = "", ...lines] = block.split("\n");
    const fields: Record<string, string> = {};
    for (const line of lines) {
      const match = /^(\w+):\s*(.*)$/.exec(line);
      if (match?.[1]) fields[match[1]] = unquote(match[2] ?? "");
    }
    const kind = kindLine.trim();
    if (kind === "title" && fields.title) chapters.push({ kind, eyebrow: fields.eyebrow, title: fields.title, sub: fields.sub });
    else if (kind === "body" && fields.body) chapters.push({ kind, head: fields.head, body: fields.body });
    else if (kind === "quote" && fields.q) chapters.push({ kind, q: fields.q });
    else if (kind === "end") chapters.push({ kind, cta: fields.cta?.replace(/\s*→\s*$/, ""), href: fields.href });
  }
  return chapters;
}

export function allNotes(): Note[] {
  return readdirSync(DIR)
    .filter((file) => /^\d{3}-.+\.md$/.test(file))
    .sort()
    .map((file) => {
      const parsed = matter(readFileSync(join(DIR, file), "utf8"));
      const front = frontmatterSchema.parse(parsed.data);
      return { ...front, slug: front.id, order: Number(file.slice(0, 3)), chapters: parseChapters(parsed.content) };
    });
}

export function noteBySlug(slug: string): Note | undefined {
  return allNotes().find((note) => note.slug === slug);
}
