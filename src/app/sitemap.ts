import type { MetadataRoute } from "next";
import { livePosts } from "@/lib/blog";
import { getLibrary } from "@/lib/library/source";
import { SITE_URL } from "@/lib/site";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const library = await getLibrary();
  const posts = livePosts();
  return [
    { url: `${SITE_URL}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/capex-calculator`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE_URL}/capex-spreadsheet-template`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/reserve-calculator`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/lifespan`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/pricing`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/terms`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    ...library.map((c) => ({ url: `${SITE_URL}/lifespan/${c.slug}`, changeFrequency: "monthly" as const, priority: 0.6 })),
    { url: `${SITE_URL}/blog`, changeFrequency: "weekly", priority: 0.6, ...(posts[0] && { lastModified: posts[0].date }) },
    ...posts.map((p) => ({ url: `${SITE_URL}/blog/${p.slug}`, lastModified: p.updated ?? p.date, changeFrequency: "yearly" as const, priority: 0.5 })),
  ];
}
