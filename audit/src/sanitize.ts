/**
 * Strip secrets and auth material from audit artifacts.
 */

const SECRET_QUERY_KEYS = new Set([
  "access_token",
  "refresh_token",
  "token",
  "code",
  "token_hash",
  "apikey",
  "api_key",
  "authorization",
  "password",
  "email",
]);

export function sanitizeUrl(raw: string): string {
  try {
    const url = new URL(raw);
    for (const key of [...url.searchParams.keys()]) {
      if (SECRET_QUERY_KEYS.has(key.toLowerCase()) || /token|secret|key|auth/i.test(key)) {
        url.searchParams.set(key, "[redacted]");
      }
    }
    if (url.hash && /(access_token|refresh_token|token)/i.test(url.hash)) {
      url.hash = "#redacted";
    }
    return url.toString();
  } catch {
    return raw
      .replace(/([?&#](?:access_token|refresh_token|token|code|token_hash|password|email)=)[^&#]*/gi, "$1[redacted]")
      .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]");
  }
}

export function sanitizeText(value: string): string {
  return value
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]")
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[jwt-redacted]")
    .replace(/sb_publishable_[A-Za-z0-9_]+/g, "[publishable-key-redacted]")
    .replace(/sb_secret_[A-Za-z0-9_]+/g, "[secret-key-redacted]")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[email-redacted]")
    .replace(/(password|passwd|pwd)\s*[:=]\s*\S+/gi, "$1=[redacted]");
}

export function severityRank(severity: "P0" | "P1" | "P2" | "P3"): number {
  return { P0: 0, P1: 1, P2: 2, P3: 3 }[severity];
}
