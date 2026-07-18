import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: ["/", "/about", "/blog", "/contact", "/help", "/pricing", "/privacy", "/risk-disclaimer", "/terms"], disallow: ["/admin/", "/api/", "/auth/", "/brief", "/dashboard", "/founding-member", "/ideas", "/onboarding", "/preferences", "/profile", "/terminal"] },
    ],
    sitemap: "https://www.nashaimarkets.com/sitemap.xml",
    host: "https://www.nashaimarkets.com",
  };
}
