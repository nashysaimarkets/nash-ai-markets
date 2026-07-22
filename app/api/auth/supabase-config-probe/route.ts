import { NextResponse } from "next/server";
import {
  createAuthCompatibleFetch,
} from "../../../../utils/supabase/auth-compatible-fetch.ts";
import {
  resolveSupabasePublicConfig,
  supabaseConfigDiagnostics,
} from "../../../../utils/supabase/config.ts";

export const dynamic = "force-dynamic";

/**
 * Secure auth configuration probe.
 * Reports presence / hostname / key kind only — never key material.
 * Optionally probes GET /auth/v1/settings without sending magic links.
 */
export async function GET(request: Request) {
  const diagnostics = supabaseConfigDiagnostics();
  const url = new URL(request.url);
  const probe = url.searchParams.get("probe") === "1";

  const authSettingsProbe: {
    attempted: boolean;
    ok: boolean;
    status: number | null;
    errorCode: string | null;
    errorMessageSafe: string | null;
  } = {
    attempted: false,
    ok: false,
    status: null,
    errorCode: null,
    errorMessageSafe: null,
  };

  if (probe && process.env.VERCEL_ENV !== "production") {
    const config = resolveSupabasePublicConfig();
    if (config.urlConfigured && config.keyConfigured && config.hostname) {
      authSettingsProbe.attempted = true;
      try {
        const settingsUrl = `${config.url.replace(/\/$/, "")}/auth/v1/settings`;
        const compatibleFetch = createAuthCompatibleFetch(config.key);
        const response = await compatibleFetch(settingsUrl, {
          method: "GET",
          headers: {
            apikey: config.key,
            Accept: "application/json",
          },
        });
        authSettingsProbe.status = response.status;
        authSettingsProbe.ok = response.ok;
        if (!response.ok) {
          let body: { error?: string; error_code?: string; msg?: string; message?: string } = {};
          try {
            body = await response.json();
          } catch {
            body = {};
          }
          const raw = body.error_code || body.error || body.msg || body.message || `http_${response.status}`;
          authSettingsProbe.errorCode = typeof raw === "string" ? raw.slice(0, 80) : "unknown";
          // Never echo tokens / keys if somehow present.
          const message = typeof body.message === "string" ? body.message : typeof body.msg === "string" ? body.msg : null;
          authSettingsProbe.errorMessageSafe = message
            ? message.replace(/sb_[a-z]+_[A-Za-z0-9]+/g, "[redacted]").replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[redacted]").slice(0, 120)
            : null;
        }
      } catch (error) {
        authSettingsProbe.errorCode = "fetch_failed";
        authSettingsProbe.errorMessageSafe = error instanceof Error ? error.name : "unknown";
      }
    }
  }

  return NextResponse.json(
    {
      expectedVariables: {
        NEXT_PUBLIC_SUPABASE_URL: diagnostics.urlConfigured ? "yes" : "no",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: diagnostics.publishableVarPresent ? "yes" : "no",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: diagnostics.anonVarPresent ? "yes" : "no",
        resolvedPublicKey: diagnostics.keyConfigured ? "yes" : "no",
        resolvedKeySource: diagnostics.keySource,
      },
      supabaseHostname: diagnostics.hostname,
      keyTypePrefix: diagnostics.keyKind,
      sanitizedWhitespace: diagnostics.sanitizedWhitespace,
      sanitizedQuotes: diagnostics.sanitizedQuotes,
      serviceRoleConfigured: diagnostics.serviceRoleConfigured ? "yes" : "no",
      serviceRoleKeyKind: diagnostics.serviceRoleKeyKind,
      authSettingsProbe,
      deployment: {
        vercelEnv: process.env.VERCEL_ENV ?? null,
        gitCommitShaShort: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
        gitBranch: process.env.VERCEL_GIT_COMMIT_REF ?? null,
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
