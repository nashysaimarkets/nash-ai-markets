/** Explicit release binding, separate from the staging-preview policy. Public
 * provider metadata only; this never authorizes an account or subscription. */
export type NativeAccountBinding = { origin: string; provider: string };
export function nativeAccountBinding(env: Record<string, string | undefined>, provider: string): NativeAccountBinding | null {
  if (!env.POCKET_NATIVE_AUTH_BRANCH || env.POCKET_NATIVE_AUTH_BRANCH !== env.VERCEL_GIT_COMMIT_REF || env.VERCEL_ENV !== 'preview') return null;
  const origin = `https://${env.VERCEL_URL || ''}`;
  if (!/^https:\/\/nash-ai-markets-[a-z0-9-]+-nash-ai-markets\.vercel\.app$/.test(origin)) return null;
  if (provider !== env.POCKET_NATIVE_AUTH_PROVIDER || !/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(provider)) return null;
  return {origin,provider};
}
export function nativeAccountOriginMatches(binding: NativeAccountBinding | null | undefined, origin: string, provider: string) {
  return Boolean(binding && binding.origin === origin && binding.provider === provider &&
    /^https:\/\/nash-ai-markets-[a-z0-9-]+-nash-ai-markets\.vercel\.app$/.test(origin));
}
