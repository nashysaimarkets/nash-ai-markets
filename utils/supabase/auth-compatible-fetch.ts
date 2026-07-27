import { isNewFormatApiKey } from "./config.ts";

type FetchFn = typeof fetch;

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

/**
 * New-format keys (`sb_publishable_` / `sb_secret_`) are not JWTs.
 *
 * - Always send them on `apikey`.
 * - Auth (`/auth/v1/*`) keeps a matching `Authorization: Bearer <api-key>` pair —
 *   required for PKCE token exchange after magic-link redirects.
 * - Edge Functions reject non-JWT Bearer API keys, so strip only there.
 * - Real user JWTs (eyJ…) are never stripped.
 */
export function createAuthCompatibleFetch(
  supabaseKey: string,
  baseFetch: FetchFn = fetch,
): FetchFn {
  return async (input, init) => {
    const headers = new Headers(init?.headers);

    if (!headers.has("apikey") && supabaseKey) {
      headers.set("apikey", supabaseKey);
    }

    if (isNewFormatApiKey(supabaseKey)) {
      const authorization = headers.get("Authorization");
      const url = requestUrl(input);
      if (
        authorization === `Bearer ${supabaseKey}`
        && url.includes("/functions/v1/")
      ) {
        headers.delete("Authorization");
      }
    }

    return baseFetch(input, { ...init, headers });
  };
}
