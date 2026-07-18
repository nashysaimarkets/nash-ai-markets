import type { MetadataRoute } from "next";

const publicRoutes = [
  "",
  "/about",
  "/blog",
  "/contact",
  "/help",
  "/pricing",
  "/privacy",
  "/risk-disclaimer",
  "/terms",
  "/waitlist",
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date("2026-07-18T00:00:00.000Z");

  return publicRoutes.map((route, index) => ({
    url: `https://www.nashaimarkets.com${route}`,
    lastModified,
    changeFrequency: index === 0 ? "daily" : "monthly",
    priority: index === 0 ? 1 : route === "/pricing" ? 0.8 : 0.5,
  }));
}
