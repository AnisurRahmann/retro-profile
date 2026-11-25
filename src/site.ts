/**
 * The rendered view of src/content.ts with every unresolved [[placeholder]] removed.
 * Components import from here, never from content.ts directly.
 *
 * Rules:
 * - optional field holding a placeholder → dropped
 * - required field holding a placeholder → the whole item is hidden
 * - human receipts with ANY placeholder → excluded
 */
import { content } from "./content";
import { isPlaceholder, type BenchItem, type CaseStudy, type Project, type Receipt } from "./content.schema";

function dropPlaceholders<T extends Record<string, unknown>>(item: T, optional: (keyof T)[]): T | null {
  const out: Record<string, unknown> = { ...item };
  for (const [key, value] of Object.entries(item)) {
    const bad = isPlaceholder(value) || (Array.isArray(value) && value.some(isPlaceholder));
    if (!bad) continue;
    if (optional.includes(key as keyof T)) delete out[key];
    else return null;
  }
  return out as T;
}

function hasAnyPlaceholder(value: unknown): boolean {
  return JSON.stringify(value).includes("[[");
}

const notNull = <T,>(v: T | null): v is T => v !== null;

export const profile = content.profile;
export const links = content.links;
export const ui = content.ui;
export const closer = content.closer;

export const caseStudies: CaseStudy[] = content.caseStudies
  .map((c) => dropPlaceholders(c, ["period"]))
  .filter(notNull);

const caseStudySlugs = new Set(caseStudies.map((c) => c.slug));

function cleanProject<T extends Project>(p: T): T | null {
  const cleaned = dropPlaceholders(p, ["href", "caseStudy"]);
  if (!cleaned) return null;
  if (cleaned.caseStudy && !caseStudySlugs.has(cleaned.caseStudy)) delete cleaned.caseStudy;
  return cleaned;
}

export const shipped: Project[] = content.shipped.map(cleanProject).filter(notNull);
export const building: BenchItem[] = content.building.map(cleanProject).filter(notNull);

export const receipts: Receipt[] = content.receipts
  .map((r) => {
    if (r.kind === "human" && hasAnyPlaceholder(r)) return null;
    return dropPlaceholders(r, ["org", "avatar", "date", "time", "href"]);
  })
  .filter(notNull);

export const lifts = {
  intro: content.lifts.intro,
  rules: content.lifts.rules.filter((r) => !isPlaceholder(r)),
  routines: content.lifts.routines.filter((d) => !hasAnyPlaceholder(d)),
};

export const liftHref: string | undefined = shipped.find((p) => p.id === "lift")?.href;

/** Every project-like card, keyed by id (used by the agent's show_project tool). */
export const allProjects: (Project | BenchItem)[] = [...shipped, ...building];

export function projectHref(p: Project): { href: string; external: boolean } | null {
  if (p.caseStudy) return { href: `/work/${p.caseStudy}`, external: false };
  if (p.href) return { href: p.href, external: true };
  return null;
}

/** Fill {name} slots in a ui template. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => String(values[k] ?? `{${k}}`));
}

/** Hosts the chat renderer may link to. */
export const allowedLinkHosts: string[] = Array.from(
  new Set(
    [
      ...Object.values(links).filter((v) => v.startsWith("https://")),
      ...allProjects.map((p) => p.href).filter((h): h is string => !!h),
      "https://arshakil.com",
      "https://www.arshakil.com",
    ].map((u) => new URL(u).host),
  ),
);
