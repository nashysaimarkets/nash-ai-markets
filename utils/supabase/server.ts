import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createAuthCompatibleFetch } from "./auth-compatible-fetch.ts";
import { resolveSupabasePublicConfig } from "./config.ts";

export async function createClient() {
  const { url, key } = resolveSupabasePublicConfig();
  if (!url || !key) {
    throw new Error("Supabase server credentials are not configured");
  }

  const cookieStore = await cookies();
  return createServerClient(url, key, {
    global: {
      fetch: createAuthCompatibleFetch(key),
    },
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll(cookiesToSet) {
        try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); }
        catch { /* Server Components cannot always write refreshed cookies. */ }
      },
    },
  });
}
