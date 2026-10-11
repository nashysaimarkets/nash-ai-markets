import type { NextConfig } from "next";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

// Vercel and the production trace workflow invoke `next build` directly rather
// than the vinext npm build wrapper. Prepare the same-origin OCR assets here too.
// This copies pinned local dependencies only; it never downloads chart data.
execFileSync(process.execPath, [resolve(process.cwd(), "scripts/prepare-axis-ocr.mjs")], { stdio: "inherit" });

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
] as const;

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Native shared libraries are loaded by dlopen, outside JavaScript tracing.
  // Keep this scoped to the preview harness rather than every API function.
  outputFileTracingIncludes: {
    "/api/pocket/torture": [
      "./node_modules/sharp/**/*",
      "./node_modules/@img/sharp-*/**/*",
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders.map((header) => ({ ...header })),
      },
      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, max-age=0, must-revalidate",
          },
          {
            key: "Service-Worker-Allowed",
            value: "/",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
