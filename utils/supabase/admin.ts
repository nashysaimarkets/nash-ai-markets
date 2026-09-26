import { createClient } from "@supabase/supabase-js";
import { createAuthCompatibleFetch } from "./auth-compatible-fetch.ts";
import { resolveSupabasePublicConfig, resolveSupabaseServiceRoleKey } from "./config.ts";

export function createAdminClient() {
  const { url } = resolveSupabasePublicConfig();
  const service = resolveSupabaseServiceRoleKey();

  if (!url || !service.value) {
    throw new Error("Supabase server credentials are not configured");
  }

  return createClient(url, service.value, {
    global: {
      fetch: createAuthCompatibleFetch(service.value),
    },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
