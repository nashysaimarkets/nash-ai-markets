/**
 * Safe post-auth redirect helpers for passwordless magic links.
 * Origins are allowlisted; `next` must be a same-app relative path.
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

export function isVercelPreviewOrigin(origin: string): boolean {
  try {
    return VERCEL_PREVIEW_ORIGIN.test(new URL(origin).origin);
  } catch {
    return false;
  }
}

export function isAllowedAuthOrigin(origin: string): boolean {
  try {
    const normalized = new URL(origin).origin;
    if (PRODUCTION_ORIGINS.has(normalized)) return true;
    if (LOCAL_ORIGIN.test(normalized)) return true;
    if (VERCEL_PREVIEW_ORIGIN.test(normalized)) return true;
    return false;
  } catch {
    return false;
  }
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
 * Build the Supabase `emailRedirectTo` URL from a trusted browser/request origin.
 * Unknown origins fail closed to production so misconfigured hosts cannot mint redirects.
 */
export function buildEmailRedirectTo(origin: string, next?: string | null): string {
  const allowed = isAllowedAuthOrigin(origin);
  const trustedOrigin = allowed ? new URL(origin).origin : "https://www.nashaimarkets.com";
  const path = safeAuthNextPath(allowed ? next : null, defaultPostAuthPath(trustedOrigin));
  const url = new URL("/auth/callback", trustedOrigin);
  url.searchParams.set("next", path);
  return url.toString();
}

/** Resolve the absolute post-auth location on the request’s own origin. */
export function buildPostAuthRedirect(requestOrigin: string, next?: string | null): string {
  const allowed = isAllowedAuthOrigin(requestOrigin);
  const origin = allowed ? new URL(requestOrigin).origin : "https://www.nashaimarkets.com";
  const path = safeAuthNextPath(allowed ? next : null, defaultPostAuthPath(origin));
  return `${origin}${path}`;
}
