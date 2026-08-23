import { NextResponse } from "next/server";
import {
  authCallbackAllowlistUrl,
  buildEmailRedirectTo,
  defaultPostAuthPath,
  describeAuthRedirectChain,
  isAllowedAuthOrigin,
  isVercelPreviewOrigin,
  matchesStablePreviewAllowlist,
  resolveAuthRequestOrigin,
  safeAuthNextPath,
} from "../../../lib/auth/safe-auth-redirect";
import { isFounding100Admin } from "../../../lib/server/founding-100.ts";
import { createAdminClient } from "../../../../utils/supabase/admin";
import { createClient } from "../../../../utils/supabase/server";

export const dynamic = "force-dynamic";

async function requireProbeAccess(): Promise<NextResponse | null> {
  if (process.env.VERCEL_ENV === "production") {
    return new NextResponse(null, { status: 404 });
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email || !isFounding100Admin(user.email)) {
    return new NextResponse(null, { status: 404 });
  }
  return null;
}

/**
 * Read-only probe: reports the emailRedirectTo login sends for this host.
 * With ?verify=1, also asks Supabase Admin generateLink what redirect_to it
 * embeds in the action_link (tokens stripped) — proves allowlist acceptance.
 * Restricted to founding admins outside production.
 */
export async function GET(request: Request) {
  const denied = await requireProbeAccess();
  if (denied) return denied;

  const origin = resolveAuthRequestOrigin(request);
  if (!isAllowedAuthOrigin(origin)) {
    return NextResponse.json({ ok: false, code: "UNTRUSTED_ORIGIN" }, { status: 400 });
  }

  const url = new URL(request.url);
  const next = safeAuthNextPath(url.searchParams.get("next"), defaultPostAuthPath(origin));
  const emailRedirectTo = buildEmailRedirectTo(origin, next);
  const chain = describeAuthRedirectChain(origin, next);
  const verify = url.searchParams.get("verify") === "1";

  let supabaseLink: Record<string, unknown> | null = null;
  if (verify) {
    try {
      const admin = createAdminClient();
      const { data, error } = await admin.auth.admin.generateLink({
        type: "magiclink",
        email: "redirect-probe@nashaimarkets.com",
        options: { redirectTo: emailRedirectTo },
      });
      if (error) {
        supabaseLink = { ok: false, code: "generate_link_failed" };
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
    } catch {
      supabaseLink = { ok: false, code: "generate_link_failed" };
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
        gitCommitShaShort: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
        gitBranch: process.env.VERCEL_GIT_COMMIT_REF ?? null,
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
