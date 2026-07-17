import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: ["/", "/about", "/contact", "/help", "/pricing", "/privacy", "/risk-disclaimer", "/terms"], disallow: ["/admin/", "/api/", "/auth/", "/brief", "/dashboard", "/founding-member", "/onboarding", "/profile", "/terminal"] },
    ],
  };
}
