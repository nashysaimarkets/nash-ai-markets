import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "NASH AI Markets",
    short_name: "NASH AI",
    description: "Provider-backed market intelligence with deterministic risk controls.",
    start_url: "/",
    display: "standalone",
    background_color: "#07110f",
    theme_color: "#07110f",
    icons: [{ src: "/favicon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
