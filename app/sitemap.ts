import type { MetadataRoute } from "next";

const publicRoutes = [
  "",
  "/about",
  "/contact",
  "/help",
  "/pricing",
  "/privacy",
  "/risk-disclaimer",
  "/terms",
  "/waitlist",
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const existingLastModified = new Date("2026-07-18T00:00:00.000Z");
  const pocketLastModified = new Date("2026-09-26T00:00:00.000Z");
  const existingRoutes: MetadataRoute.Sitemap = publicRoutes.map((route, index) => ({
    url: "https://www.nashaimarkets.com" + route,
    lastModified: existingLastModified,
    changeFrequency: index === 0 ? "daily" : "monthly",
    priority: index === 0 ? 1 : route === "/pricing" ? 0.8 : 0.5,
  }));
  const pocketRoutes: MetadataRoute.Sitemap = [
    {
      url: "https://www.nashaimarkets.com/pocket",
      lastModified: pocketLastModified,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: "https://www.nashaimarkets.com/pocket/founding",
      lastModified: pocketLastModified,
      changeFrequency: "weekly",
      priority: 0.9,
    },
  ];
  return [...existingRoutes, ...pocketRoutes];
}
