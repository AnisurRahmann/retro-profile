import type { MetadataRoute } from "next";
import { profile } from "@/content";
import { allNotes } from "@/lib/notes";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = profile.site;
  return [
    { url: `${base}/`, priority: 1 },
    { url: `${base}/gym/`, priority: 0.7 },
    { url: `${base}/notes/`, priority: 0.6 },
    ...allNotes().map((note) => ({ url: `${base}/notes/${note.slug}/`, priority: 0.5 })),
  ];
}
