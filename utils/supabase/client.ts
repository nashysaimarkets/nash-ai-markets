import { createBrowserClient } from "@supabase/ssr";
import { createAuthCompatibleFetch } from "./auth-compatible-fetch.ts";
import { resolveSupabasePublicConfig } from "./config.ts";

export function createClient(override?: { url: string; key: string }) {
  const resolved = resolveSupabasePublicConfig();
  const url = override?.url.trim() || resolved.url;
  const key = override?.key.trim() || resolved.key;
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
