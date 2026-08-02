import { NextResponse } from "next/server";
import {
  createAuthCompatibleFetch,
} from "../../../../utils/supabase/auth-compatible-fetch.ts";
import {
  resolveSupabasePublicConfig,
  supabaseConfigDiagnostics,
} from "../../../../utils/supabase/config.ts";
import { createClient } from "../../../../utils/supabase/server.ts";
import { isFounding100Admin } from "../../../lib/server/founding-100.ts";

export const dynamic = "force-dynamic";

function redactAuthErrorText(value: string): string {
  return value
    .replace(/sb_[a-z]+_[A-Za-z0-9]+/g, "[redacted]")
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9._-]+/g, "[redacted]")
    .slice(0, 160);
}

async function classifyHostname(hostname: string | null): Promise<{
  dnsStatus: "ok" | "nxdomain" | "servfail" | "timeout" | "skipped" | "unknown";
  detail: string | null;
}> {
  if (!hostname) return { dnsStatus: "skipped", detail: "missing_hostname" };
  try {
    const dns = await import("node:dns/promises");
    await dns.lookup(hostname);
    return { dnsStatus: "ok", detail: null };
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error
      ? String((error as { code?: string }).code)
      : null;
    if (code === "ENOTFOUND" || code === "ENODATA") {
      return { dnsStatus: "nxdomain", detail: code };
    }
    if (code === "ETIMEOUT" || code === "EAI_AGAIN") {
      return { dnsStatus: "timeout", detail: code };
    }
    if (code === "ESERVFAIL") {
      return { dnsStatus: "servfail", detail: code };
    }
    return {
      dnsStatus: "unknown",
      detail: code || (error instanceof Error ? error.name : "lookup_failed"),
    };
  }
}

async function requireProbeAccess(): Promise<NextResponse | null> {
  // Opaque 404 in production so the route does not advertise itself.
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
 * Secure auth configuration probe.
 * Reports presence / hostname / key kind only — never key material.
 * Optionally probes GET /auth/v1/settings without sending magic links.
 * Restricted to founding admins outside production.
 */
export async function GET(request: Request) {
  const denied = await requireProbeAccess();
  if (denied) return denied;

  const diagnostics = supabaseConfigDiagnostics();
  const url = new URL(request.url);
  const probe = url.searchParams.get("probe") === "1";
  const hostnameCheck = await classifyHostname(diagnostics.hostname);

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

  if (probe) {
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
          const message = typeof body.message === "string"
            ? body.message
            : typeof body.msg === "string"
              ? body.msg
              : null;
          authSettingsProbe.errorMessageSafe = message ? redactAuthErrorText(message) : null;
        }
      } catch (error) {
        authSettingsProbe.errorCode = hostnameCheck.dnsStatus === "nxdomain"
          ? "host_nxdomain"
          : "fetch_failed";
        authSettingsProbe.errorMessageSafe = error instanceof Error
          ? redactAuthErrorText(`${error.name}:${error.message}`)
          : "unknown";
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
      urlProjectRef: diagnostics.urlProjectRef,
      serviceRoleJwtRef: diagnostics.serviceRoleJwtRef,
      projectRefsMatch: diagnostics.projectRefsMatch ? "yes" : "no",
      hostnameDnsStatus: hostnameCheck.dnsStatus,
      hostnameDnsDetail: hostnameCheck.detail,
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
