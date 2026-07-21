import assert from "node:assert/strict";
import test from "node:test";
import {
  buildEmailRedirectTo,
  buildPostAuthRedirect,
  defaultPostAuthPath,
  isAllowedAuthOrigin,
  isVercelPreviewOrigin,
  safeAuthNextPath,
} from "../app/lib/auth/safe-auth-redirect.ts";

const PRODUCTION = "https://www.nashaimarkets.com";
const PREVIEW =
  "https://nash-ai-markets-git-bullseye-customer-te-69ca60-nash-ai-markets.vercel.app";
const UNIQUE_PREVIEW = "https://nash-ai-markets-kki912d62-nash-ai-markets.vercel.app";

test("production login returns to production dashboard by default", () => {
  assert.equal(isAllowedAuthOrigin(PRODUCTION), true);
  assert.equal(isVercelPreviewOrigin(PRODUCTION), false);
  assert.equal(defaultPostAuthPath(PRODUCTION), "/dashboard");
  assert.equal(
    buildEmailRedirectTo(PRODUCTION),
    `${PRODUCTION}/auth/callback?next=%2Fdashboard`,
  );
  assert.equal(buildPostAuthRedirect(PRODUCTION), `${PRODUCTION}/dashboard`);
});

test("preview login returns to the originating preview terminal by default", () => {
  assert.equal(isAllowedAuthOrigin(PREVIEW), true);
  assert.equal(isVercelPreviewOrigin(PREVIEW), true);
  assert.equal(defaultPostAuthPath(PREVIEW), "/terminal");
  assert.equal(
    buildEmailRedirectTo(PREVIEW),
    `${PREVIEW}/auth/callback?next=%2Fterminal`,
  );
  assert.equal(buildPostAuthRedirect(PREVIEW), `${PREVIEW}/terminal`);
  assert.equal(buildPostAuthRedirect(UNIQUE_PREVIEW, "/terminal"), `${UNIQUE_PREVIEW}/terminal`);
});

test("unsafe external redirect URLs are rejected", () => {
  assert.equal(safeAuthNextPath("https://evil.example/phish"), "/dashboard");
  assert.equal(safeAuthNextPath("//evil.example/phish"), "/dashboard");
  assert.equal(safeAuthNextPath("/\\evil.example"), "/dashboard");
  assert.equal(safeAuthNextPath("/unknown-admin"), "/dashboard");
  assert.equal(isAllowedAuthOrigin("https://evil.example"), false);
  assert.equal(isAllowedAuthOrigin("https://nash-ai-markets-other.vercel.app"), false);
  assert.equal(
    buildEmailRedirectTo("https://evil.example", "/terminal"),
    `${PRODUCTION}/auth/callback?next=%2Fdashboard`,
  );
  assert.equal(
    buildPostAuthRedirect("https://evil.example", "https://evil.example"),
    `${PRODUCTION}/dashboard`,
  );
});

test("safe next paths remain available for production and preview", () => {
  assert.equal(safeAuthNextPath("/terminal", "/dashboard"), "/terminal");
  assert.equal(safeAuthNextPath("/dashboard", "/terminal"), "/dashboard");
  assert.equal(safeAuthNextPath("/brief", "/dashboard"), "/brief");
  assert.equal(
    buildEmailRedirectTo(PRODUCTION, "/terminal"),
    `${PRODUCTION}/auth/callback?next=%2Fterminal`,
  );
  assert.equal(
    buildEmailRedirectTo(PREVIEW, "/dashboard"),
    `${PREVIEW}/auth/callback?next=%2Fdashboard`,
  );
});
