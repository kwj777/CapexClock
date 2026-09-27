import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/__forms.html", "/app", "/auth"] },
    sitemap: "https://capexclock.com/sitemap.xml",
  };
}
