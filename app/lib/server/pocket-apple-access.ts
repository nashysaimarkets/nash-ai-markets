import type { JWSTransactionDecodedPayload, JWSRenewalInfoDecodedPayload, StatusResponse } from "@apple/app-store-server-library";

export const POCKET_APPLE_BUNDLE_ID = "com.nashaimarkets.pocketbullseye";
export const POCKET_APPLE_PRODUCT_ID = `${POCKET_APPLE_BUNDLE_ID}.monthly`;
export type AppleAccessDependencies = {
  environment: string;
  now: () => number;
  verifyTransaction: (jws: string) => Promise<JWSTransactionDecodedPayload>;
  verifyRenewal: (jws: string) => Promise<JWSRenewalInfoDecodedPayload>;
  getStatuses: (transactionId: string) => Promise<StatusResponse>;
  isLegacyOwner?: (originalTransactionId: string, userId: string) => Promise<boolean>;
  getOwnedTransactionIds?: (userId: string) => Promise<string[]>;
};

/** Never decode unsigned claims. Both proof and fresh status must come from Apple
 * and belong to the authenticated account. A restore is the same verification,
 * not a client override. Pre-binding legacy purchases need a separate migration. */
export async function verifyPocketAppleAccess(userId: string, proof: string, deps: AppleAccessDependencies): Promise<boolean> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId) || proof.length > 16000) return false;
  const matches = async (tx: JWSTransactionDecodedPayload) => {
    const valid = tx.bundleId === POCKET_APPLE_BUNDLE_ID
    && tx.productId === POCKET_APPLE_PRODUCT_ID && tx.environment === deps.environment
    && tx.type === "Auto-Renewable Subscription"
    && !!tx.originalTransactionId && !!tx.transactionId && tx.revocationDate == null && tx.isUpgraded !== true;
    if (!valid) return false;
    if (tx.appAccountToken != null) return tx.appAccountToken.toLowerCase() === userId.toLowerCase();
    return deps.isLegacyOwner ? deps.isLegacyOwner(tx.originalTransactionId!, userId) : false;
  };
  let originals: string[];
  if (proof) {
    const supplied = await deps.verifyTransaction(proof);
    if (!await matches(supplied)) return false;
    originals = [supplied.originalTransactionId!];
  } else {
    // TestFlight may have no production transaction. Only a separately recorded,
    // UUID-bound ownership mapping can select an original transaction to refresh.
    // Never infer this mapping from email, events, receipt possession or client ID.
    if (!deps.getOwnedTransactionIds) return false;
    originals = await deps.getOwnedTransactionIds(userId);
    if (!Array.isArray(originals) || originals.length > 5 ||
      originals.some(id => typeof id !== 'string' || !/^[0-9]{1,64}$/.test(id)) ||
      new Set(originals).size !== originals.length) throw Error('Invalid Apple ownership records');
    for (const original of originals) {
      if (!deps.isLegacyOwner || !await deps.isLegacyOwner(original, userId)) return false;
    }
  }
  for (const original of originals) {
  const response = await deps.getStatuses(original);
  if (response.bundleId !== POCKET_APPLE_BUNDLE_ID || response.environment !== deps.environment) return false;
  for (const group of response.data ?? []) for (const current of group.lastTransactions ?? []) {
    if (current.originalTransactionId !== original || !current.signedTransactionInfo || ![1, 4].includes(current.status ?? 0)) continue;
    const tx = await deps.verifyTransaction(current.signedTransactionInfo);
    if (!await matches(tx) || tx.originalTransactionId !== original) continue;
    if (current.status === 1 && typeof tx.expiresDate === "number" && Number.isFinite(tx.expiresDate) && tx.expiresDate > deps.now()) return true;
    if (current.status === 4 && current.signedRenewalInfo) {
      const renewal = await deps.verifyRenewal(current.signedRenewalInfo);
      if (renewal.originalTransactionId === original && renewal.environment === deps.environment
          && renewal.productId === POCKET_APPLE_PRODUCT_ID
          && (renewal.appAccountToken == null || renewal.appAccountToken.toLowerCase() === userId.toLowerCase())
          && typeof renewal.gracePeriodExpiresDate === "number" && Number.isFinite(renewal.gracePeriodExpiresDate) && renewal.gracePeriodExpiresDate > deps.now()) return true;
    }
  }
  }
  return false;
}

/** Explicit environment configuration; never fall back from production to sandbox.
 * Keys and pinned Apple roots stay server-only. No receipt/status caching means
 * refund, expiration and grace changes are checked on each billed request. */
export async function createPocketAppleVerifier() {
  const { AppStoreServerAPIClient, SignedDataVerifier, Environment } = await import("@apple/app-store-server-library");
  const env = process.env.POCKET_APPLE_ENVIRONMENT;
  if (env !== "Production" && env !== "Sandbox") throw new Error("Apple verifier environment is not configured");
  if (env === "Sandbox" && process.env.VERCEL_ENV === "production") throw new Error("Sandbox purchases cannot grant production access");
  const environment = env === "Production" ? Environment.PRODUCTION : Environment.SANDBOX;
  const key = process.env.POCKET_APPLE_SIGNING_KEY;
  const keyId = process.env.POCKET_APPLE_KEY_ID;
  const issuer = process.env.POCKET_APPLE_ISSUER_ID;
  const rootConfig = process.env.POCKET_APPLE_ROOT_CERTIFICATES_BASE64;
  const appId = Number(process.env.POCKET_APPLE_APP_ID);
  if (!key || !keyId || !issuer || !rootConfig || !Number.isSafeInteger(appId) || appId <= 0) throw new Error("Apple verifier configuration unavailable");
  const {createPrivateKey, X509Certificate} = await import('node:crypto');
  const signingKey = createPrivateKey(key);
  if (signingKey.asymmetricKeyType !== 'ec' || signingKey.asymmetricKeyDetails?.namedCurve !== 'prime256v1') throw Error('Apple signing key invalid');
  const roots: unknown = JSON.parse(rootConfig);
  if (!Array.isArray(roots) || roots.length === 0 || roots.some(root => typeof root !== "string" || !root)) throw new Error("Pinned Apple roots unavailable");
  for (const root of roots) {
    const cert = new X509Certificate(Buffer.from(root, 'base64'));
    if (!cert.ca || Date.parse(cert.validFrom) > Date.now() || Date.parse(cert.validTo) <= Date.now()) throw Error('Apple root certificate invalid');
  }
  const verifier = new SignedDataVerifier(roots.map(root => Buffer.from(root, "base64")), true, environment, POCKET_APPLE_BUNDLE_ID, appId);
  const client = new AppStoreServerAPIClient(key, keyId, issuer, POCKET_APPLE_BUNDLE_ID, environment);
  return { verifier, client, environment, appId };
}

export async function hasPocketAppleSubscription(userId: string, proof: string): Promise<boolean> {
  let setup: Awaited<ReturnType<typeof createPocketAppleVerifier>>;
  try { setup = await createPocketAppleVerifier(); }
  catch { throw Object.assign(new Error("Apple verifier configuration unavailable"), {code:"POCKET_APPLE_CONFIGURATION"}); }
  const { verifier, client, environment } = setup;
  return verifyPocketAppleAccess(userId, proof, {
    environment, now: Date.now,
    verifyTransaction: async jws => {
      try { return await verifier.verifyAndDecodeTransaction(jws); }
      catch { throw Object.assign(new Error("Apple transaction verification unavailable"), {code:"POCKET_APPLE_VERIFICATION_UNAVAILABLE"}); }
    },
    verifyRenewal: jws => verifier.verifyAndDecodeRenewalInfo(jws),
    getStatuses: id => client.getAllSubscriptionStatuses(id),
    getOwnedTransactionIds: async id => {
      const {createAdminClient} = await import('../../../utils/supabase/admin.ts');
      const {data,error} = await createAdminClient().rpc('get_pocket_apple_owned_transactions', {
        p_environment:environment, p_user_id:id,
      });
      if (error || !Array.isArray(data)) throw Object.assign(Error('Apple ownership lookup unavailable'), {code:'POCKET_APPLE_OWNERSHIP_UNAVAILABLE'});
      return data;
    },
    isLegacyOwner: async (originalTransactionId, id) => {
      const { createAdminClient } = await import("../../../utils/supabase/admin.ts");
      const { data, error } = await createAdminClient().rpc("is_pocket_apple_legacy_owner", {
        p_environment: environment, p_original_transaction_id: originalTransactionId, p_user_id: id,
      });
      if (error || typeof data !== "boolean") throw Object.assign(new Error("Legacy Apple ownership lookup unavailable"), {code:"POCKET_APPLE_OWNERSHIP_UNAVAILABLE"});
      return data;
    },
  });
}
