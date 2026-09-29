import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    sitemap: "https://pocket.nashaimarkets.com/sitemap.xml",
    rules: [
      { userAgent: "*", allow: ["/", "/about", "/contact", "/help", "/pricing", "/privacy", "/risk-disclaimer", "/terms"], disallow: ["/admin/", "/api/", "/auth/", "/brief", "/dashboard", "/founding-member", "/onboarding", "/preferences", "/profile", "/terminal"] },
    ],
  };
}
