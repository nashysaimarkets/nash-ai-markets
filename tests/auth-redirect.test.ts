import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  authCallbackAllowlistUrl,
  buildEmailRedirectTo,
  buildPostAuthRedirect,
  defaultPostAuthPath,
  describeAuthRedirectChain,
  isAllowedAuthOrigin,
  isAuthProviderCompatibleWithOrigin,
  isVercelPreviewOrigin,
  matchesStablePreviewAllowlist,
  resolveAuthRequestOrigin,
  safeAuthNextPath,
} from "../app/lib/auth/safe-auth-redirect.ts";

const PRODUCTION = "https://www.nashaimarkets.com";
const PREVIEW =
  "https://nash-ai-markets-git-bullseye-customer-te-69ca60-nash-ai-markets.vercel.app";
const UNIQUE_PREVIEW = "https://nash-ai-markets-bljrecjyb-nash-ai-markets.vercel.app";
const SITES_STAGING =
  "https://nash-ai-markets-bullseye-staging.nashysinners.chatgpt.site";

test("default post-auth destination is /dashboard for every host", () => {
  assert.equal(defaultPostAuthPath(PRODUCTION), "/dashboard");
  assert.equal(defaultPostAuthPath(PREVIEW), "/dashboard");
  assert.equal(defaultPostAuthPath(UNIQUE_PREVIEW), "/dashboard");
  assert.equal(safeAuthNextPath(null), "/dashboard");
  assert.equal(safeAuthNextPath(undefined), "/dashboard");
  assert.equal(safeAuthNextPath("/unknown-admin"), "/dashboard");
});

test("login resumes an existing authenticated session before requesting another email", async () => {
  const page = await readFile(new URL("../app/login/page.tsx", import.meta.url), "utf8");
  assert.match(page, /supabase\.auth\.getUser\(\)/);
  assert.match(page, /if \(data\.user\) redirect\("\/dashboard"\)/);
});

test("production login builds a path-only production callback", () => {
  assert.equal(isAllowedAuthOrigin(PRODUCTION), true);
  assert.equal(isVercelPreviewOrigin(PRODUCTION), false);
  assert.equal(buildEmailRedirectTo(PRODUCTION), `${PRODUCTION}/auth/callback`);
  assert.equal(buildPostAuthRedirect(PRODUCTION), `${PRODUCTION}/dashboard`);
});

test("preview login returns path-only callback on the originating preview host", () => {
  assert.equal(isAllowedAuthOrigin(PREVIEW), true);
  assert.equal(isVercelPreviewOrigin(PREVIEW), true);
  assert.equal(buildEmailRedirectTo(PREVIEW), `${PREVIEW}/auth/callback`);
  assert.equal(buildPostAuthRedirect(PREVIEW), `${PREVIEW}/dashboard`);
  assert.equal(buildPostAuthRedirect(UNIQUE_PREVIEW, "/terminal"), `${UNIQUE_PREVIEW}/terminal`);
  assert.equal(buildEmailRedirectTo(UNIQUE_PREVIEW), `${UNIQUE_PREVIEW}/auth/callback`);
  assert.doesNotMatch(buildEmailRedirectTo(PREVIEW), /nashaimarkets\.com/);
  assert.doesNotMatch(buildEmailRedirectTo(PREVIEW), /\?/);
  assert.equal(authCallbackAllowlistUrl(PREVIEW), `${PREVIEW}/auth/callback`);
  assert.ok(buildEmailRedirectTo(PREVIEW).startsWith(`${PREVIEW}/`));
  assert.equal(matchesStablePreviewAllowlist(buildEmailRedirectTo(PREVIEW)), true);
});

test("owner-only Sites staging keeps authentication on its exact origin", () => {
  assert.equal(isAllowedAuthOrigin(SITES_STAGING), true);
  assert.equal(isVercelPreviewOrigin(SITES_STAGING), false);
  assert.equal(buildEmailRedirectTo(SITES_STAGING), `${SITES_STAGING}/auth/callback`);
  assert.equal(buildPostAuthRedirect(SITES_STAGING), `${SITES_STAGING}/dashboard`);
  assert.equal(authCallbackAllowlistUrl(SITES_STAGING), `${SITES_STAGING}/auth/callback`);
  assert.equal(isAllowedAuthOrigin("https://other-staging.nashysinners.chatgpt.site"), false);
});

test("private acceptance origins refuse a browser bundle compiled for production Supabase", () => {
  assert.equal(
    isAuthProviderCompatibleWithOrigin(
      SITES_STAGING,
      "https://pxlqvaddvghjjhenqmdh.supabase.co",
    ),
    true,
  );
  assert.equal(
    isAuthProviderCompatibleWithOrigin(
      SITES_STAGING,
      "https://opmgzchnmcgnsfwpmysc.supabase.co",
    ),
    false,
  );
  assert.equal(
    isAuthProviderCompatibleWithOrigin(
      SITES_STAGING,
      "https://PXLQVADDVGHJJHENQMDH.SUPABASE.CO./",
    ),
    true,
  );
  assert.equal(
    isAuthProviderCompatibleWithOrigin(
      PREVIEW,
      "https://pxlqvaddvghjjhenqmdh.supabase.co",
    ),
    true,
  );
  assert.equal(
    isAuthProviderCompatibleWithOrigin(
      PREVIEW,
      "https://opmgzchnmcgnsfwpmysc.supabase.co",
    ),
    false,
  );
  assert.equal(
    isAuthProviderCompatibleWithOrigin(
      UNIQUE_PREVIEW,
      "https://PXLQVADDVGHJJHENQMDH.SUPABASE.CO./",
    ),
    true,
  );
  assert.equal(isAuthProviderCompatibleWithOrigin(PREVIEW, null), false);
  assert.equal(isAuthProviderCompatibleWithOrigin(PRODUCTION, null), true);
  assert.equal(
    isAuthProviderCompatibleWithOrigin(
      PRODUCTION,
      "https://opmgzchnmcgnsfwpmysc.supabase.co",
    ),
    true,
  );
});

test("unsafe external redirect URLs are rejected", () => {
  assert.equal(safeAuthNextPath("https://evil.example/phish"), "/dashboard");
  assert.equal(safeAuthNextPath("//evil.example/phish"), "/dashboard");
  assert.equal(safeAuthNextPath("/\\evil.example"), "/dashboard");
  assert.equal(isAllowedAuthOrigin("https://evil.example"), false);
  assert.equal(isAllowedAuthOrigin("https://nash-ai-markets-other.vercel.app"), false);
  assert.equal(buildEmailRedirectTo(PREVIEW, "https://evil.example/phish"), `${PREVIEW}/auth/callback`);
  assert.equal(buildPostAuthRedirect(PREVIEW, "//evil.example"), `${PREVIEW}/dashboard`);
});

test("valid https origin is never rewritten to www for emailRedirectTo", () => {
  const oddPreview = "https://nash-ai-markets-bljrecjyb-nash-ai-markets.vercel.app";
  const redirectTo = buildEmailRedirectTo(oddPreview);
  assert.match(redirectTo, /^https:\/\/nash-ai-markets-bljrecjyb-nash-ai-markets\.vercel\.app\/auth\/callback$/);
  assert.equal(redirectTo.includes("www.nashaimarkets.com"), false);
});

test("explicit next paths remain available after callback", () => {
  assert.equal(safeAuthNextPath("/terminal", "/dashboard"), "/terminal");
  assert.equal(safeAuthNextPath("/dashboard", "/terminal"), "/dashboard");
  assert.equal(safeAuthNextPath("/brief", "/dashboard"), "/brief");
  assert.equal(buildPostAuthRedirect(PRODUCTION, "/terminal"), `${PRODUCTION}/terminal`);
  assert.equal(buildPostAuthRedirect(PREVIEW, "/dashboard"), `${PREVIEW}/dashboard`);
});

test("missing next defaults to /dashboard", () => {
  assert.equal(safeAuthNextPath(null, defaultPostAuthPath(PREVIEW)), "/dashboard");
  assert.equal(safeAuthNextPath(undefined, defaultPostAuthPath(UNIQUE_PREVIEW)), "/dashboard");
  assert.equal(safeAuthNextPath(null, defaultPostAuthPath(PRODUCTION)), "/dashboard");
  assert.equal(buildPostAuthRedirect(PREVIEW, null), `${PREVIEW}/dashboard`);
  assert.equal(buildPostAuthRedirect(PRODUCTION, null), `${PRODUCTION}/dashboard`);
  assert.equal(buildPostAuthRedirect("not-a-url"), "https://www.nashaimarkets.com/dashboard");
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

test("unsafe external origins are rejected by buildEmailRedirectTo", () => {
  assert.throws(() => buildEmailRedirectTo("https://evil.example"), /untrusted origin/i);
  assert.throws(() => buildEmailRedirectTo("https://nash-ai-markets-other.vercel.app"), /untrusted origin/i);
  assert.doesNotThrow(() => buildEmailRedirectTo(PREVIEW, "/terminal"));
});

test("emailRedirectTo never includes ?next= so allowlist /** can match", () => {
  assert.equal(buildEmailRedirectTo(PREVIEW, "/terminal"), `${PREVIEW}/auth/callback`);
  assert.equal(buildEmailRedirectTo(PREVIEW, "/dashboard"), `${PREVIEW}/auth/callback`);
  assert.doesNotMatch(buildEmailRedirectTo(PREVIEW, "/terminal"), /next=/);
  assert.doesNotMatch(buildEmailRedirectTo(PREVIEW, "/terminal"), /dashboard/);
});

test("production login stays on the production origin", () => {
  const redirectTo = buildEmailRedirectTo(PRODUCTION, "/terminal");
  assert.equal(redirectTo, `${PRODUCTION}/auth/callback`);
  assert.equal(buildPostAuthRedirect(PRODUCTION, "/terminal"), `${PRODUCTION}/terminal`);
  assert.doesNotMatch(redirectTo, /vercel\.app/);
});

test("preview login never rewrites to production www", () => {
  const redirectTo = buildEmailRedirectTo(PREVIEW, "/terminal");
  assert.ok(redirectTo.startsWith(`${PREVIEW}/`));
  assert.equal(redirectTo.includes("www.nashaimarkets.com"), false);
  assert.equal(buildPostAuthRedirect(PREVIEW, "/terminal"), `${PREVIEW}/terminal`);
});

test("redirect chain keeps preview origin through callback to /dashboard", () => {
  const chain = describeAuthRedirectChain(PREVIEW);
  assert.equal(chain.emailRedirectTo, `${PREVIEW}/auth/callback`);
  assert.equal(chain.expectedHops[2]?.url, `${PREVIEW}/dashboard`);
  assert.equal(chain.failureModeIfAllowlistRejects.appThenRedirectsTo, `${PRODUCTION}/dashboard`);
  assert.equal(chain.matchesStablePreviewAllowlist, true);
});
