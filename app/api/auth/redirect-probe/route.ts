import { NextResponse } from "next/server";
import {
  authCallbackAllowlistUrl,
  buildEmailRedirectTo,
  defaultPostAuthPath,
  isVercelPreviewOrigin,
  normalizeHttpOrigin,
  safeAuthNextPath,
} from "../../../lib/auth/safe-auth-redirect";

export const dynamic = "force-dynamic";

/**
 * Read-only probe: reports the emailRedirectTo that login would send for this host.
 * No auth, no email, no secrets — used to verify preview vs production redirect wiring.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") || "https";
  const host = forwardedHost || request.headers.get("host") || url.host;
  const origin = normalizeHttpOrigin(`${forwardedProto}://${host}`) || url.origin;
  const next = safeAuthNextPath(url.searchParams.get("next"), defaultPostAuthPath(origin));
  const emailRedirectTo = buildEmailRedirectTo(origin, next);

  return NextResponse.json(
    {
      origin,
      next,
      emailRedirectTo,
      callbackAllowlistUrl: authCallbackAllowlistUrl(origin),
      isVercelPreview: isVercelPreviewOrigin(origin),
      usesWwwProductionHost: /nashaimarkets\.com$/i.test(new URL(emailRedirectTo).host),
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
