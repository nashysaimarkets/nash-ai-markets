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
  const lastModified = new Date("2026-07-18T00:00:00.000Z");

  return [...publicRoutes.map((route, index) => ({
    url: `https://pocket.nashaimarkets.com${route}`,
    lastModified,
    changeFrequency: index === 0 ? "daily" as const : "monthly" as const,
    priority: index === 0 ? 1 : route === "/pricing" ? 0.8 : 0.5,
  })), {
    url: "https://pocket.nashaimarkets.com/pocket-bullseye",
    lastModified: new Date("2026-09-25T00:00:00.000Z"),
    changeFrequency: "monthly",
    priority: 0.9,
  }, ...["indices", "forex", "review"].map((topic) => ({ url: `https://pocket.nashaimarkets.com/pocket-bullseye/${topic}`, lastModified: new Date("2026-09-16T00:00:00.000Z"), changeFrequency: "monthly" as const, priority: 0.7 }))];
}
