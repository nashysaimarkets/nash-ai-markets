import { POCKET_PRODUCT } from "../lib/product-brand";
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/pocket",
    name: POCKET_PRODUCT.displayName,
    short_name: POCKET_PRODUCT.shortName,
    description: "Private mobile-first AI chart analysis from NASH AI Markets.",
    start_url: "/pocket",
    scope: "/pocket",
    display: "standalone",
    orientation: "any",
    background_color: "#101b2b",
    theme_color: "#101b2b",
    categories: ["finance", "business"],
    icons: [
      { src: "/icons/ntp-icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/ntp-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/ntp-icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
