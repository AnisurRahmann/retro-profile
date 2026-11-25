export type CardProject = {
  id: string;
  title: string;
  subtitle: string;
  href?: string;
  caseStudy?: string;
  status?: "in-build" | "built-not-deployed";
};

export type StatusLabels = { inBuild: string; built: string };

export function projectHref(p: CardProject): { href: string; external: boolean } | null {
  if (p.caseStudy) return { href: `/work/${p.caseStudy}`, external: false };
  if (p.href) return { href: p.href, external: true };
  return null;
}
