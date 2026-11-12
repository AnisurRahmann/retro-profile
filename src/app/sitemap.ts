import type { MetadataRoute } from "next";
import { SITE_URL } from "@/content";
import { BUILD_DATE } from "@/lib/build";

export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: SITE_URL, lastModified: BUILD_DATE, changeFrequency: "monthly", priority: 1 }];
}
