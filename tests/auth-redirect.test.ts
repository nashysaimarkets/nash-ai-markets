import assert from "node:assert/strict";
import test from "node:test";
import {
  authCallbackAllowlistUrl,
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
const UNIQUE_PREVIEW = "https://nash-ai-markets-bljrecjyb-nash-ai-markets.vercel.app";

test("production login returns to production dashboard by default", () => {
  assert.equal(isAllowedAuthOrigin(PRODUCTION), true);
  assert.equal(isVercelPreviewOrigin(PRODUCTION), false);
  assert.equal(defaultPostAuthPath(PRODUCTION), "/dashboard");
  assert.equal(
    buildEmailRedirectTo(PRODUCTION),
    `${PRODUCTION}/auth/callback`,
  );
  assert.equal(buildPostAuthRedirect(PRODUCTION), `${PRODUCTION}/dashboard`);
});

test("preview login returns to the originating preview terminal by default", () => {
  assert.equal(isAllowedAuthOrigin(PREVIEW), true);
  assert.equal(isVercelPreviewOrigin(PREVIEW), true);
  assert.equal(defaultPostAuthPath(PREVIEW), "/terminal");
  assert.equal(
    buildEmailRedirectTo(PREVIEW),
    `${PREVIEW}/auth/callback`,
  );
  assert.equal(buildPostAuthRedirect(PREVIEW), `${PREVIEW}/terminal`);
  assert.equal(buildPostAuthRedirect(UNIQUE_PREVIEW, "/terminal"), `${UNIQUE_PREVIEW}/terminal`);
  assert.equal(
    buildEmailRedirectTo(UNIQUE_PREVIEW),
    `${UNIQUE_PREVIEW}/auth/callback`,
  );
  assert.doesNotMatch(buildEmailRedirectTo(PREVIEW), /nashaimarkets\.com/);
  assert.doesNotMatch(buildEmailRedirectTo(PREVIEW), /\?/);
  assert.equal(authCallbackAllowlistUrl(PREVIEW), `${PREVIEW}/auth/callback`);
});

test("unsafe external redirect URLs are rejected", () => {
  assert.equal(safeAuthNextPath("https://evil.example/phish"), "/dashboard");
  assert.equal(safeAuthNextPath("//evil.example/phish"), "/dashboard");
  assert.equal(safeAuthNextPath("/\\evil.example"), "/dashboard");
  assert.equal(safeAuthNextPath("/unknown-admin"), "/dashboard");
  assert.equal(isAllowedAuthOrigin("https://evil.example"), false);
  assert.equal(isAllowedAuthOrigin("https://nash-ai-markets-other.vercel.app"), false);
  assert.equal(
    buildEmailRedirectTo(PREVIEW, "https://evil.example/phish"),
    `${PREVIEW}/auth/callback`,
  );
  assert.equal(
    buildPostAuthRedirect(PREVIEW, "//evil.example"),
    `${PREVIEW}/terminal`,
  );
});

test("valid https origin is never rewritten to www for emailRedirectTo", () => {
  const oddPreview = "https://nash-ai-markets-bljrecjyb-nash-ai-markets.vercel.app";
  const redirectTo = buildEmailRedirectTo(oddPreview);
  assert.match(redirectTo, /^https:\/\/nash-ai-markets-bljrecjyb-nash-ai-markets\.vercel\.app\/auth\/callback$/);
  assert.equal(redirectTo.includes("www.nashaimarkets.com"), false);
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

test("missing next on preview defaults to /terminal not /dashboard", () => {
  assert.equal(safeAuthNextPath(null, defaultPostAuthPath(PREVIEW)), "/terminal");
  assert.equal(safeAuthNextPath(undefined, defaultPostAuthPath(UNIQUE_PREVIEW)), "/terminal");
  assert.equal(safeAuthNextPath(null, defaultPostAuthPath(PRODUCTION)), "/dashboard");
  assert.equal(buildPostAuthRedirect(PREVIEW, null), `${PREVIEW}/terminal`);
  assert.equal(buildPostAuthRedirect(PRODUCTION, null), `${PRODUCTION}/dashboard`);
});
