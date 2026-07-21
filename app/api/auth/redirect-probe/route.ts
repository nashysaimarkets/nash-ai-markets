import { NextResponse } from "next/server";
import {
  authCallbackAllowlistUrl,
  buildEmailRedirectTo,
  defaultPostAuthPath,
  describeAuthRedirectChain,
  isVercelPreviewOrigin,
  matchesStablePreviewAllowlist,
  resolveAuthRequestOrigin,
  safeAuthNextPath,
} from "../../../lib/auth/safe-auth-redirect";
import { createAdminClient } from "../../../../utils/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Read-only probe: reports the emailRedirectTo login sends for this host.
 * With ?verify=1, also asks Supabase Admin generateLink what redirect_to it
 * embeds in the action_link (tokens stripped) — proves allowlist acceptance.
 */
export async function GET(request: Request) {
  const origin = resolveAuthRequestOrigin(request);
  const url = new URL(request.url);
  const next = safeAuthNextPath(url.searchParams.get("next"), defaultPostAuthPath(origin));
  const emailRedirectTo = buildEmailRedirectTo(origin, next);
  const chain = describeAuthRedirectChain(origin, next);
  const verify = url.searchParams.get("verify") === "1";

  let supabaseLink: Record<string, unknown> | null = null;
  if (verify && process.env.VERCEL_ENV !== "production") {
    try {
      const admin = createAdminClient();
      const { data, error } = await admin.auth.admin.generateLink({
        type: "magiclink",
        email: "redirect-probe@nashaimarkets.com",
        options: { redirectTo: emailRedirectTo },
      });
      if (error) {
        supabaseLink = { ok: false, error: error.message };
      } else {
        const actionLink = data.properties?.action_link ?? "";
        let embeddedRedirectTo: string | null = null;
        try {
          embeddedRedirectTo = actionLink
            ? new URL(actionLink).searchParams.get("redirect_to")
            : null;
        } catch {
          embeddedRedirectTo = null;
        }
        const decoded =
          embeddedRedirectTo != null ? decodeURIComponent(embeddedRedirectTo) : null;
        supabaseLink = {
          ok: true,
          requestedRedirectTo: emailRedirectTo,
          embeddedRedirectTo: decoded,
          usesWwwProductionHost: Boolean(decoded && /nashaimarkets\.com$/i.test(new URL(decoded).host)),
          matchesRequested: decoded === emailRedirectTo,
          matchesStablePreviewAllowlist: decoded ? matchesStablePreviewAllowlist(decoded) : false,
          // Never return raw tokens / full action_link.
        };
      }
    } catch (error) {
      supabaseLink = {
        ok: false,
        error: error instanceof Error ? error.message : "generateLink failed",
      };
    }
  }

  return NextResponse.json(
    {
      origin,
      next,
      emailRedirectTo,
      callbackAllowlistUrl: authCallbackAllowlistUrl(origin),
      isVercelPreview: isVercelPreviewOrigin(origin),
      usesWwwProductionHost: /nashaimarkets\.com$/i.test(new URL(emailRedirectTo).host),
      beginsWithPreviewOrigin:
        isVercelPreviewOrigin(origin) && emailRedirectTo.startsWith(`${origin}/`),
      pathOnlyCallback: !emailRedirectTo.includes("?"),
      matchesStablePreviewAllowlist: matchesStablePreviewAllowlist(emailRedirectTo),
      redirectChain: chain,
      supabaseLink,
      deployment: {
        vercelEnv: process.env.VERCEL_ENV ?? null,
        vercelUrl: process.env.VERCEL_URL ?? null,
        gitCommitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
        gitCommitShaShort: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
        gitBranch: process.env.VERCEL_GIT_COMMIT_REF ?? null,
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
