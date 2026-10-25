import { nativeAccountBinding } from '../../../pocket/native-account-policy';
import { resolveSupabasePublicConfig } from '../../../../utils/supabase/config';
import { createAdminClient } from '../../../../utils/supabase/admin';
import { createPocketAppleVerifier } from '../../../lib/server/pocket-apple-access';
import { checkNativeReadiness, type NativeReadiness } from '../../../lib/server/pocket-native-readiness';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Coalesce diagnostic probes per instance. No customer data, paid model calls,
// Apple transaction lookup, or writes. Production and unbound previews are 404.
let cached: {until: number; result: Promise<NativeReadiness>} | undefined;
export async function GET(request: Request) {
  const binding = nativeAccountBinding(process.env, resolveSupabasePublicConfig().url);
  const revision = process.env.VERCEL_GIT_COMMIT_SHA ?? '';
  if (!binding || new URL(request.url).origin !== binding.origin || !/^[a-f0-9]{40}$/.test(revision)) {
    return new Response(null, {status:404, headers:{'cache-control':'no-store'}});
  }
  if (!cached || cached.until <= Date.now()) {
    cached = {until: Date.now() + 15_000, result: checkNativeReadiness({
      appleConfiguration: async () => { await createPocketAppleVerifier(); },
      webLedger: async signal => {
        const {data,error} = await createAdminClient().rpc('has_pocket_web_subscription',
          {p_user_id:'00000000-0000-0000-0000-000000000000'}).abortSignal(signal);
        if (error || typeof data !== 'boolean') throw Error('LEDGER_UNAVAILABLE');
        return data;
      },
      legacyOwnership: async signal => {
        const {data,error} = await createAdminClient().rpc('is_pocket_apple_legacy_owner', {
          p_environment:process.env.POCKET_APPLE_ENVIRONMENT,
          p_original_transaction_id:'0', p_user_id:'00000000-0000-0000-0000-000000000000',
        }).abortSignal(signal);
        if (error || typeof data !== 'boolean') throw Error('OWNERSHIP_UNAVAILABLE');
        return data;
      },
      ownedTransactions: async signal => {
        const {data,error} = await createAdminClient().rpc('get_pocket_apple_owned_transactions', {
          p_environment:process.env.POCKET_APPLE_ENVIRONMENT,
          p_user_id:'00000000-0000-0000-0000-000000000000',
        }).abortSignal(signal);
        if (error) throw Error('OWNERSHIP_UNAVAILABLE');
        return data;
      },
    })};
  }
  const result = await cached.result;
  return Response.json({revision,...result}, {status:result.ready ? 200 : 503,
    headers:{'cache-control':'private, no-store'}});
}
