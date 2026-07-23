/**
 * Safe post-auth redirect helpers for passwordless magic links.
 * The browser/request origin is preserved (never rewritten to www).
 * Only the `next` path is validated against an allowlist.
 */

const PRODUCTION_ORIGINS = new Set([
  "https://www.nashaimarkets.com",
  "https://nashaimarkets.com",
]);

/** Unique and git preview hosts for the nash-ai-markets Vercel project. */
const VERCEL_PREVIEW_ORIGIN =
  /^https:\/\/nash-ai-markets-[a-z0-9-]+-nash-ai-markets\.vercel\.app$/i;

const LOCAL_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;

const ALLOWED_NEXT_PREFIXES = [
  "/dashboard",
  "/terminal",
  "/markets",
  "/brief",
  "/profile",
  "/onboarding",
  "/welcome",
  "/ideas",
  "/pricing",
  "/membership-required",
] as const;

/** Cookie used to carry post-auth `next` without putting it in emailRedirectTo. */
export const AUTH_NEXT_COOKIE = "nam_auth_next";

/** Normalize an http(s) origin; reject credentials and non-http(s) schemes. */
export function normalizeHttpOrigin(origin: string): string | null {
  try {
    const url = new URL(origin);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.username || url.password) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function isVercelPreviewOrigin(origin: string): boolean {
  const normalized = normalizeHttpOrigin(origin);
  return Boolean(normalized && VERCEL_PREVIEW_ORIGIN.test(normalized));
}

export function isAllowedAuthOrigin(origin: string): boolean {
  const normalized = normalizeHttpOrigin(origin);
  if (!normalized) return false;
  if (PRODUCTION_ORIGINS.has(normalized)) return true;
  if (LOCAL_ORIGIN.test(normalized)) return true;
  if (VERCEL_PREVIEW_ORIGIN.test(normalized)) return true;
  return false;
}

/**
 * Resolve the public request origin from forwarded headers first.
 * Never invent www.nashaimarkets.com when the request already has a host.
 */
export function resolveAuthRequestOrigin(request: Request): string {
  const url = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const forwardedProto =
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
    url.protocol.replace(":", "") ||
    "https";
  if (forwardedHost) {
    const fromForwarded = normalizeHttpOrigin(`${forwardedProto}://${forwardedHost}`);
    if (fromForwarded) return fromForwarded;
  }
  const host = request.headers.get("host")?.split(",")[0]?.trim();
  if (host) {
    const fromHost = normalizeHttpOrigin(`${forwardedProto}://${host}`);
    if (fromHost) return fromHost;
  }
  return normalizeHttpOrigin(url.origin) ?? url.origin;
}

/**
 * Default landing after auth is always /terminal.
 * Callers may still pass an explicit allowlisted `next` (including /dashboard).
 * Origin is accepted for call-site clarity; it does not change the default path,
 * and never rewrites production ↔ preview hosts.
 */
export function defaultPostAuthPath(origin?: string): string {
  void origin;
  return "/terminal";
}

/**
 * Accept only same-origin relative paths. Rejects protocol-relative, absolute,
 * and unknown destinations (open-redirect protection).
 */
export function safeAuthNextPath(
  requested: string | null | undefined,
  fallback: string = defaultPostAuthPath(),
): string {
  if (!requested) return fallback;
  const trimmed = requested.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return fallback;
  if (trimmed.includes("://") || trimmed.includes("\\") || /[\s<>]/.test(trimmed)) return fallback;

  const withoutHash = trimmed.split("#")[0] ?? trimmed;
  const pathOnly = withoutHash.split("?")[0] ?? withoutHash;
  if (pathOnly === "/") return withoutHash;

  const allowed = ALLOWED_NEXT_PREFIXES.some(
    (prefix) => pathOnly === prefix || pathOnly.startsWith(`${prefix}/`),
  );
  return allowed ? withoutHash : fallback;
}

/**
 * Build Supabase `emailRedirectTo` from the **current** trusted browser/request origin.
 * Rejects unsafe external origins. Never rewrites a trusted origin to www.
 *
 * Path-only `/auth/callback` (no `?next=`) so Redirect URL allowlists like
 * `https://<preview-host>/**` match reliably. Post-auth destination is resolved
 * on the callback host via cookie/`next` query/`defaultPostAuthPath` (/terminal).
 */
export function buildEmailRedirectTo(origin: string, next?: string | null): string {
  const trustedOrigin = normalizeHttpOrigin(origin);
  if (!trustedOrigin || !isAllowedAuthOrigin(trustedOrigin)) {
    throw new Error("Refusing to build auth redirect from an untrusted origin");
  }
  // Keep `next` out of the allowlisted URL; callers persist it via AUTH_NEXT_COOKIE.
  void next;
  return new URL("/auth/callback", trustedOrigin).toString();
}

/** Resolve the absolute post-auth location on the request’s own origin. */
export function buildPostAuthRedirect(requestOrigin: string, next?: string | null): string {
  const origin = normalizeHttpOrigin(requestOrigin);
  if (!origin || !isAllowedAuthOrigin(origin)) {
    // Last-resort absolute URL only when the request origin is unusable/untrusted.
    // Prefer /terminal — never invent a /dashboard landing here.
    return "https://www.nashaimarkets.com/terminal";
  }
  const path = safeAuthNextPath(next, defaultPostAuthPath(origin));
  return `${origin}${path}`;
}

/** Exact callback URL that must be allowlisted in Supabase for a given origin. */
export function authCallbackAllowlistUrl(origin: string): string {
  const trustedOrigin = normalizeHttpOrigin(origin);
  if (!trustedOrigin) throw new Error("Invalid origin for callback allowlist URL");
  return `${trustedOrigin}/auth/callback`;
}

/** Compare a redirect_to value against the stable preview allowlist pattern. */
export function matchesStablePreviewAllowlist(redirectTo: string): boolean {
  try {
    const url = new URL(redirectTo);
    return (
      url.protocol === "https:" &&
      url.hostname === "nash-ai-markets-git-bullseye-customer-te-69ca60-nash-ai-markets.vercel.app" &&
      (url.pathname === "/auth/callback" || url.pathname.startsWith("/auth/callback/"))
    );
  } catch {
    return false;
  }
}

/** Expected post-OTP hops when the allowlist accepts the preview callback. */
export function describeAuthRedirectChain(origin: string, next?: string | null) {
  const trustedOrigin = normalizeHttpOrigin(origin);
  if (!trustedOrigin) {
    throw new Error("Invalid origin for redirect chain");
  }
  const path = safeAuthNextPath(next, defaultPostAuthPath(trustedOrigin));
  const emailRedirectTo = buildEmailRedirectTo(trustedOrigin, path);
  return {
    emailRedirectTo,
    allowlistEntryRecommended: `${trustedOrigin}/**`,
    matchesStablePreviewAllowlist: matchesStablePreviewAllowlist(emailRedirectTo),
    expectedHops: [
      {
        step: 1,
        name: "supabase_otp_redirect_to",
        url: emailRedirectTo,
        note: "Path-only callback — no ?next= query (allowlist-safe)",
      },
      {
        step: 2,
        name: "app_auth_callback",
        url: `${emailRedirectTo}?code=…`,
        note: "Supabase redirects here with ?code=… (PKCE) or token_hash",
      },
      {
        step: 3,
        name: "post_auth_destination",
        url: `${trustedOrigin}${path}`,
      },
    ],
    failureModeIfAllowlistRejects: {
      note: "Supabase substitutes Site URL; callback then runs on that host",
      siteUrlFallbackExample: "https://www.nashaimarkets.com/auth/callback",
      appThenRedirectsTo: "https://www.nashaimarkets.com/terminal",
    },
  };
}
