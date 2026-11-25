import { content } from "../content";
import { isPlaceholder } from "../content.schema";
import { building, caseStudies, links, profile, shipped } from "../site";

/**
 * Builds the agent's closed knowledge base from src/content.ts.
 * Only resolved values reach it (via src/site.ts); internal facts are excluded.
 */
export function buildKnowledge(): string {
  const out: string[] = [];
  const h = (t: string) => out.push("", `## ${t}`, "");
  const li = (t: string) => out.push(`- ${t}`);

  out.push("# Knowledge base: Shakil");
  out.push("", "Generated from the site's content file. This is the ONLY source of facts about Shakil.");

  h("Profile");
  li(`Name: ${profile.name} (legal name ${profile.legalName}).`);
  li(`Title: ${profile.title}.`);
  li(`One-liner: ${profile.oneLiner}`);
  li(`Summary: ${profile.summary}`);
  li(`Location and hours: ${profile.location}`);
  li(`Credentials: ${profile.credentials}`);

  h("Status lines (what he's doing lately)");
  profile.statusLines.forEach(li);

  h("Shipped work");
  for (const p of shipped) {
    const study = caseStudies.find((c) => c.slug === p.caseStudy);
    out.push("", `### ${p.title} (id: ${p.id})`, "");
    li(`One-liner: ${p.subtitle}`);
    if (p.href) li(`Link: ${p.href}`);
    if (study) {
      li(`Case study page: ${links.site}/work/${study.slug} (show_project id: ${p.id})`);
      li(`Org: ${study.org}. Role: ${study.role}.${study.period ? ` Period: ${study.period}.` : ""}`);
      li(`Problem: ${study.problem}`);
      li(`What he built: ${study.built}`);
      li(`Flow: ${study.flow.join(" → ")}`);
      li(
        `Results: ${study.results
          .map((r) => (r.before ? `${r.label}: ${r.before} → ${r.after}` : `${r.label}: ${r.after}`))
          .join("; ")}`,
      );
      li(`Stack: ${study.stack.join(", ")}`);
    }
  }

  h("In build (on the bench)");
  for (const b of building) {
    li(
      `${b.title} (id: ${b.id}): ${b.subtitle}. Status: ${b.status === "in-build" ? "in build" : "built, not deployed"}.${b.href ? ` Link: ${b.href}` : ""}`,
    );
  }

  h("Principles");
  content.principles.forEach(li);

  h("Stack");
  li(content.stack.join(", "));

  h("Working style");
  content.workingStyle.forEach(li);

  h("Services");
  li(content.services.offer);
  li(content.services.pricing);
  li(content.services.roles);

  h("Contact and booking");
  li(`Book a 30-minute call: ${links.calendar} (use the book_call tool).`);
  li(`Email: ${links.email}`);
  li(`GitHub: ${links.github}`);
  li(`LinkedIn: ${links.linkedin}`);
  li(`Site: ${links.site}. Privacy and chat logging: ${links.site}/privacy`);

  h("More facts");
  for (const f of content.agentFacts) {
    if (f.internal || isPlaceholder(f.fact)) continue;
    li(`${f.topic}: ${f.fact}`);
  }

  const text = out.join("\n") + "\n";
  if (text.includes("[[")) throw new Error("knowledge.md would contain an unresolved [[placeholder]]");
  return text;
}
