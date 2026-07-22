/**
 * Central Supabase public/server credential resolution.
 * Never log or return full key values from this module's diagnostics helpers.
 */

export type SupabaseKeyKind = "publishable" | "legacy" | "secret" | "missing" | "unknown";

export type SupabasePublicConfig = {
  url: string;
  key: string;
  keySource: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY" | "NEXT_PUBLIC_SUPABASE_ANON_KEY" | null;
  keyKind: SupabaseKeyKind;
  hostname: string | null;
  urlConfigured: boolean;
  keyConfigured: boolean;
  sanitizedWhitespace: boolean;
  sanitizedQuotes: boolean;
};

function stripWrappingQuotes(value: string): { value: string; stripped: boolean } {
  if (
    (value.startsWith('"') && value.endsWith('"') && value.length >= 2)
    || (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
  ) {
    return { value: value.slice(1, -1), stripped: true };
  }
  return { value, stripped: false };
}

/** Normalize env string: trim + remove a single layer of wrapping quotes. */
export function sanitizeEnvCredential(raw: string | undefined | null): {
  value: string;
  sanitizedWhitespace: boolean;
  sanitizedQuotes: boolean;
} {
  if (raw == null) {
    return { value: "", sanitizedWhitespace: false, sanitizedQuotes: false };
  }
  const trimmed = raw.trim();
  const sanitizedWhitespace = trimmed !== raw;
  const { value, stripped } = stripWrappingQuotes(trimmed);
  // Second trim after quote removal (e.g. `" key "` → ` key ` → `key`)
  const finalValue = value.trim();
  return {
    value: finalValue,
    sanitizedWhitespace: sanitizedWhitespace || finalValue !== value,
    sanitizedQuotes: stripped,
  };
}

export function classifySupabaseKey(key: string): SupabaseKeyKind {
  if (!key) return "missing";
  if (key.startsWith("sb_publishable_")) return "publishable";
  if (key.startsWith("sb_secret_")) return "secret";
  if (key.startsWith("eyJ")) return "legacy";
  return "unknown";
}

export function isNewFormatApiKey(key: string): boolean {
  return key.startsWith("sb_publishable_") || key.startsWith("sb_secret_");
}

function hostnameFromUrl(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/**
 * Resolve browser/server public credentials.
 * Prefers NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY; falls back to NEXT_PUBLIC_SUPABASE_ANON_KEY.
 */
export function resolveSupabasePublicConfig(
  env: Record<string, string | undefined> = process.env,
): SupabasePublicConfig {
  const urlResult = sanitizeEnvCredential(env.NEXT_PUBLIC_SUPABASE_URL);
  const publishable = sanitizeEnvCredential(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  const anon = sanitizeEnvCredential(env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  const usePublishable = Boolean(publishable.value);
  const key = usePublishable ? publishable.value : anon.value;
  const keySource = usePublishable
    ? "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
    : anon.value
      ? "NEXT_PUBLIC_SUPABASE_ANON_KEY"
      : null;
  const keyMeta = usePublishable ? publishable : anon;

  return {
    url: urlResult.value,
    key,
    keySource,
    keyKind: classifySupabaseKey(key),
    hostname: hostnameFromUrl(urlResult.value),
    urlConfigured: Boolean(urlResult.value),
    keyConfigured: Boolean(key),
    sanitizedWhitespace: urlResult.sanitizedWhitespace || keyMeta.sanitizedWhitespace,
    sanitizedQuotes: urlResult.sanitizedQuotes || keyMeta.sanitizedQuotes,
  };
}

export function resolveSupabaseServiceRoleKey(
  env: Record<string, string | undefined> = process.env,
): { value: string; configured: boolean; keyKind: SupabaseKeyKind } {
  const result = sanitizeEnvCredential(env.SUPABASE_SERVICE_ROLE_KEY);
  return {
    value: result.value,
    configured: Boolean(result.value),
    keyKind: classifySupabaseKey(result.value),
  };
}

/** Safe diagnostics payload — never includes key material. */
export function supabaseConfigDiagnostics(env: Record<string, string | undefined> = process.env) {
  const publicConfig = resolveSupabasePublicConfig(env);
  const service = resolveSupabaseServiceRoleKey(env);
  return {
    urlConfigured: publicConfig.urlConfigured,
    keyConfigured: publicConfig.keyConfigured,
    keySource: publicConfig.keySource,
    keyKind: publicConfig.keyKind,
    hostname: publicConfig.hostname,
    sanitizedWhitespace: publicConfig.sanitizedWhitespace,
    sanitizedQuotes: publicConfig.sanitizedQuotes,
    serviceRoleConfigured: service.configured,
    serviceRoleKeyKind: service.keyKind,
    publishableVarPresent: Boolean(sanitizeEnvCredential(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY).value),
    anonVarPresent: Boolean(sanitizeEnvCredential(env.NEXT_PUBLIC_SUPABASE_ANON_KEY).value),
  };
}
