import { content } from "@/content";
import { contentSchema, type Content } from "@/content.schema";

/**
 * Build-time content validation. Called from the page (a Server Component),
 * so a schema violation fails `next build` and zod stays out of client bundles.
 */
export function validateContent(): Content {
  const parsed = contentSchema.safeParse(content);
  if (!parsed.success) {
    throw new Error(
      `src/content.ts failed validation:\n${JSON.stringify(parsed.error.issues, null, 2)}`,
    );
  }
  const problems = integrityProblems(parsed.data);
  if (problems.length > 0) {
    throw new Error(`src/content.ts failed integrity checks:\n${problems.join("\n")}`);
  }
  return parsed.data;
}

/** Cross-reference checks the schema cannot express. Returns human readable problems. */
export function integrityProblems(c: Content): string[] {
  const out: string[] = [];
  const ids = c.projects.map((p) => p.id);
  const idSet = new Set(ids);
  if (idSet.size !== ids.length) out.push("duplicate project ids");

  for (const p of c.projects) {
    for (const t of p.connectsTo) {
      if (!idSet.has(t)) out.push(`${p.id} connectsTo unknown ${t}`);
      if (t === p.id) out.push(`${p.id} connectsTo itself`);
      const other = c.projects.find((q) => q.id === t);
      if (other && !other.connectsTo.includes(p.id)) out.push(`${p.id} -> ${t} is not mirrored`);
    }
    if (p.redlineTag && !p.redline) out.push(`${p.id} has a redlineTag without a redline`);
    if (p.redline && !p.redlineTag) out.push(`${p.id} has a redline without a redlineTag`);
  }

  const goalIds = c.goals.items.map((g) => g.id);
  if (new Set(goalIds).size !== goalIds.length) out.push("duplicate goal ids");
  for (const g of c.goals.items) {
    for (const pid of g.projectIds)
      if (!idSet.has(pid)) out.push(`${g.id} references unknown ${pid}`);
    if (g.projectIds.length === 0 && !g.attachesTo) out.push(`${g.id} attaches to nothing`);
  }
  for (const co of c.goals.companies) {
    for (const pid of co.projectIds)
      if (!idSet.has(pid)) out.push(`${co.id} references unknown ${pid}`);
  }
  for (const s of c.sheets) {
    if (s.redlineGoalId && !goalIds.includes(s.redlineGoalId)) {
      out.push(`sheet ${s.no} references unknown goal ${s.redlineGoalId}`);
    }
  }

  const revs = c.experience.map((e) => e.rev);
  if (new Set(revs).size !== revs.length) out.push("duplicate experience revs");
  if ([...revs].sort().reverse().join("") !== revs.join(""))
    out.push("experience is not newest first");

  const share = c.routing.reduce((n, t) => n + t.share, 0);
  if (share !== 100) out.push(`routing shares sum to ${share}, expected 100`);

  for (const list of [c.metrics.map((m) => m.id), c.caseStudies.map((s) => s.id)]) {
    if (new Set(list).size !== list.length) out.push(`duplicate ids in ${list[0]?.slice(0, 2)}`);
  }
  return out;
}
