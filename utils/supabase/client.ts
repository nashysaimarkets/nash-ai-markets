import { createBrowserClient } from "@supabase/ssr";
import { createAuthCompatibleFetch } from "./auth-compatible-fetch.ts";
import { resolveSupabasePublicConfig } from "./config.ts";

export function createClient() {
  const { url, key } = resolveSupabasePublicConfig();
  if (!url || !key) {
    throw new Error("Supabase browser credentials are not configured");
  }

  return createBrowserClient(url, key, {
    global: {
      fetch: createAuthCompatibleFetch(key),
    },
    auth: {
      flowType: "pkce",
      // Callback page completes PKCE/OTP explicitly; avoid racing a second exchange.
      detectSessionInUrl: false,
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}
