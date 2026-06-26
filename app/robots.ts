import type { MetadataRoute } from "next";

const SITE = "https://www.joincarenow.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Private app areas (auth-gated anyway) — keep them out of the index.
      disallow: ["/api/", "/founder", "/admin", "/portal", "/dashboard", "/pipeline", "/settings", "/billing"],
    },
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
