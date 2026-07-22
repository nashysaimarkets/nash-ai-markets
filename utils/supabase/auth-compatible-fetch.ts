import { isNewFormatApiKey } from "./config.ts";

type FetchFn = typeof fetch;

/**
 * New-format keys (`sb_publishable_` / `sb_secret_`) are not JWTs.
 * supabase-js still sets `Authorization: Bearer <api-key>` on Auth requests when
 * there is no user session; Kong rejects that with 401 Invalid JWT.
 *
 * Keep `apikey` required; strip Authorization only when it is the API key itself.
 * Real user JWTs (eyJ…) are left untouched.
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
      if (authorization === `Bearer ${supabaseKey}`) {
        headers.delete("Authorization");
      }
    }

    return baseFetch(input, { ...init, headers });
  };
}
