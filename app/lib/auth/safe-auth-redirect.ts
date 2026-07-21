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
  "/brief",
  "/profile",
  "/onboarding",
  "/welcome",
  "/ideas",
  "/pricing",
  "/membership-required",
] as const;

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

/** Default landing after auth: terminal on Vercel preview, dashboard in production. */
export function defaultPostAuthPath(origin: string): string {
  return isVercelPreviewOrigin(origin) ? "/terminal" : "/dashboard";
}

/**
 * Accept only same-origin relative paths. Rejects protocol-relative, absolute,
 * and unknown destinations (open-redirect protection).
 */
export function safeAuthNextPath(
  requested: string | null | undefined,
  fallback = "/dashboard",
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
 * Build Supabase `emailRedirectTo` from the **current** browser/request origin.
 * Never rewrites a valid https origin to www — that previously forced preview
 * sessions onto production when allowlisting/Supabase wildcards disagreed.
 *
 * Path-only callbacks (no `?next=`) are preferred when the destination matches
 * the host default. Supabase Redirect URL globs match more reliably without
 * query strings; the callback route then applies `defaultPostAuthPath`.
 */
export function buildEmailRedirectTo(origin: string, next?: string | null): string {
  const trustedOrigin = normalizeHttpOrigin(origin);
  if (!trustedOrigin) {
    throw new Error("Refusing to build auth redirect from a non-http(s) origin");
  }
  const fallback = defaultPostAuthPath(trustedOrigin);
  const path = safeAuthNextPath(next, fallback);
  const url = new URL("/auth/callback", trustedOrigin);
  if (path !== fallback) {
    url.searchParams.set("next", path);
  }
  return url.toString();
}

/** Resolve the absolute post-auth location on the request’s own origin. */
export function buildPostAuthRedirect(requestOrigin: string, next?: string | null): string {
  const origin = normalizeHttpOrigin(requestOrigin);
  if (!origin) return "https://www.nashaimarkets.com/dashboard";
  const path = safeAuthNextPath(next, defaultPostAuthPath(origin));
  return `${origin}${path}`;
}

/** Exact callback URL that must be allowlisted in Supabase for a given origin. */
export function authCallbackAllowlistUrl(origin: string): string {
  const trustedOrigin = normalizeHttpOrigin(origin);
  if (!trustedOrigin) throw new Error("Invalid origin for callback allowlist URL");
  return `${trustedOrigin}/auth/callback`;
}
