import type { MetadataRoute } from "next";
import { caseStudies, links } from "@/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = links.site;
  return [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/chat`, changeFrequency: "monthly", priority: 0.8 },
    ...caseStudies.map((c) => ({ url: `${base}/work/${c.slug}`, changeFrequency: "monthly" as const, priority: 0.7 })),
    { url: `${base}/lifts`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${base}/privacy`, changeFrequency: "yearly", priority: 0.2 },
  ];
}
