import assert from "node:assert/strict";
import test from "node:test";
import {
  authCallbackAllowlistUrl,
  buildEmailRedirectTo,
  buildPostAuthRedirect,
  defaultPostAuthPath,
  describeAuthRedirectChain,
  isAllowedAuthOrigin,
  isVercelPreviewOrigin,
  resolveAuthRequestOrigin,
  safeAuthNextPath,
} from "../app/lib/auth/safe-auth-redirect.ts";

const PRODUCTION = "https://www.nashaimarkets.com";
const PREVIEW =
  "https://nash-ai-markets-git-bullseye-customer-te-69ca60-nash-ai-markets.vercel.app";
const UNIQUE_PREVIEW = "https://nash-ai-markets-bljrecjyb-nash-ai-markets.vercel.app";

test("default post-auth destination is /terminal for every host", () => {
  assert.equal(defaultPostAuthPath(PRODUCTION), "/terminal");
  assert.equal(defaultPostAuthPath(PREVIEW), "/terminal");
  assert.equal(defaultPostAuthPath(UNIQUE_PREVIEW), "/terminal");
  assert.equal(safeAuthNextPath(null), "/terminal");
  assert.equal(safeAuthNextPath(undefined), "/terminal");
  assert.equal(safeAuthNextPath("/unknown-admin"), "/terminal");
});

test("production login builds an absolute production callback with next=/terminal", () => {
  assert.equal(isAllowedAuthOrigin(PRODUCTION), true);
  assert.equal(isVercelPreviewOrigin(PRODUCTION), false);
  assert.equal(
    buildEmailRedirectTo(PRODUCTION),
    `${PRODUCTION}/auth/callback?next=%2Fterminal`,
  );
  assert.equal(buildPostAuthRedirect(PRODUCTION), `${PRODUCTION}/terminal`);
});

test("preview login returns to the originating preview terminal by default", () => {
  assert.equal(isAllowedAuthOrigin(PREVIEW), true);
  assert.equal(isVercelPreviewOrigin(PREVIEW), true);
  assert.equal(
    buildEmailRedirectTo(PREVIEW),
    `${PREVIEW}/auth/callback?next=%2Fterminal`,
  );
  assert.equal(buildPostAuthRedirect(PREVIEW), `${PREVIEW}/terminal`);
  assert.equal(buildPostAuthRedirect(UNIQUE_PREVIEW, "/terminal"), `${UNIQUE_PREVIEW}/terminal`);
  assert.equal(
    buildEmailRedirectTo(UNIQUE_PREVIEW),
    `${UNIQUE_PREVIEW}/auth/callback?next=%2Fterminal`,
  );
  assert.doesNotMatch(buildEmailRedirectTo(PREVIEW), /nashaimarkets\.com/);
  assert.equal(authCallbackAllowlistUrl(PREVIEW), `${PREVIEW}/auth/callback`);
  assert.ok(buildEmailRedirectTo(PREVIEW).startsWith(`${PREVIEW}/`));
});

test("unsafe external redirect URLs are rejected", () => {
  assert.equal(safeAuthNextPath("https://evil.example/phish"), "/terminal");
  assert.equal(safeAuthNextPath("//evil.example/phish"), "/terminal");
  assert.equal(safeAuthNextPath("/\\evil.example"), "/terminal");
  assert.equal(isAllowedAuthOrigin("https://evil.example"), false);
  assert.equal(isAllowedAuthOrigin("https://nash-ai-markets-other.vercel.app"), false);
  assert.equal(
    buildEmailRedirectTo(PREVIEW, "https://evil.example/phish"),
    `${PREVIEW}/auth/callback?next=%2Fterminal`,
  );
  assert.equal(
    buildPostAuthRedirect(PREVIEW, "//evil.example"),
    `${PREVIEW}/terminal`,
  );
});

test("valid https origin is never rewritten to www for emailRedirectTo", () => {
  const oddPreview = "https://nash-ai-markets-bljrecjyb-nash-ai-markets.vercel.app";
  const redirectTo = buildEmailRedirectTo(oddPreview);
  assert.match(
    redirectTo,
    /^https:\/\/nash-ai-markets-bljrecjyb-nash-ai-markets\.vercel\.app\/auth\/callback\?next=%2Fterminal$/,
  );
  assert.equal(redirectTo.includes("www.nashaimarkets.com"), false);
});

test("explicit next paths remain available for production and preview", () => {
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

test("missing next defaults to /terminal not /dashboard", () => {
  assert.equal(safeAuthNextPath(null, defaultPostAuthPath(PREVIEW)), "/terminal");
  assert.equal(safeAuthNextPath(undefined, defaultPostAuthPath(UNIQUE_PREVIEW)), "/terminal");
  assert.equal(safeAuthNextPath(null, defaultPostAuthPath(PRODUCTION)), "/terminal");
  assert.equal(buildPostAuthRedirect(PREVIEW, null), `${PREVIEW}/terminal`);
  assert.equal(buildPostAuthRedirect(PRODUCTION, null), `${PRODUCTION}/terminal`);
  assert.equal(buildPostAuthRedirect("not-a-url"), "https://www.nashaimarkets.com/terminal");
});

test("resolveAuthRequestOrigin prefers forwarded host over request URL host", () => {
  const request = new Request("https://internal.example/auth/callback?code=abc", {
    headers: {
      "x-forwarded-host": "nash-ai-markets-mjht7tcni-nash-ai-markets.vercel.app",
      "x-forwarded-proto": "https",
    },
  });
  assert.equal(
    resolveAuthRequestOrigin(request),
    "https://nash-ai-markets-mjht7tcni-nash-ai-markets.vercel.app",
  );
});

test("redirect chain keeps preview origin through callback to /terminal", () => {
  const chain = describeAuthRedirectChain(PREVIEW);
  assert.equal(chain.emailRedirectTo, `${PREVIEW}/auth/callback?next=%2Fterminal`);
  assert.equal(chain.expectedHops[2]?.url, `${PREVIEW}/terminal`);
  assert.equal(chain.failureModeIfAllowlistRejects.appThenRedirectsTo, `${PRODUCTION}/terminal`);
});
