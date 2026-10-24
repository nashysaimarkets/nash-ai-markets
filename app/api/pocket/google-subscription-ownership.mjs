/** Server-only, unmounted ownership write path. The verifier/account/database
 * ports must be trusted server services. Never accept them or a verification
 * candidate from a request body. No purchase, acknowledgement or entitlement.
 * commitStatement must use a dedicated autocommit statement, not an enclosing
 * uncommitted transaction, and no automatic retry on ambiguous database errors.
 */
import {createHash} from 'node:crypto';
const hash = x => createHash('sha256').update(x).digest('hex');
const digest = x => typeof x === 'string' && /^[a-f0-9]{64}$/.test(x);
const uuid = x => typeof x === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(x);
const record = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const requireFact = x => { if (!x) throw Error('OWNERSHIP_BOUNDARY_REFUSED'); };
export const OWNERSHIP_SQL = 'select pocket_google_ownership.claim_token($1::uuid,$2::text,$3::text,$4::text,$5::text) as result';
const DENIALS = new Set(['ACCOUNT_OWNERSHIP_CONFLICT','TOKEN_SCOPE_CONFLICT','TOKEN_REVOKED','TOKEN_REPLACED','LINKED_OWNERSHIP_CHANGED','LINKED_TOKEN_CYCLE']);
const HOLDS = new Set(['INVALID_OWNERSHIP_INPUT','LINKED_OWNERSHIP_REVIEW_REQUIRED']);

export function createGoogleOwnershipRecorder(config, ports) {
  requireFact(record(config) && typeof config.packageName === 'string' && config.packageName.length <= 255
    && /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/.test(config.packageName)
    && ['production','sandbox'].includes(config.environment));
  requireFact(record(ports) && ['verify','readAccount','commitStatement'].every(k => typeof ports[k] === 'function'));
  const {packageName,environment} = config;
  const maxAgeMs = config.maxVerificationAgeMs ?? 30000;
  requireFact(Number.isSafeInteger(maxAgeMs) && maxAgeMs > 0 && maxAgeMs <= 30000);
  const {verify,readAccount,commitStatement} = ports, clock = ports.clock ?? Date.now;
  requireFact(typeof clock === 'function');
  return Object.freeze({async record(input = {}) {
    const base = {entitled:false,ownershipRecorded:false,writeAttempted:false};
    let attempted = false, signal, stage = 'INPUT';
    try {
      const {purchaseToken} = input;
      signal = input.signal;
      requireFact(typeof purchaseToken === 'string' && purchaseToken.length > 0 && purchaseToken.length <= 4096
        && !/[\s\x00-\x1f\x7f]/u.test(purchaseToken) && (signal === undefined || signal instanceof AbortSignal));
      signal?.throwIfAborted();
      stage = 'VERIFICATION';
      const raw = await verify({purchaseToken,signal});
      requireFact(record(raw) && raw.status === 'VERIFIED_FOR_PERSISTENCE' && raw.entitled === false
        && raw.entitlementCandidate === true && raw.writesPerformed === 0
        && raw.atomicOwnershipRecheckRequired === true && raw.revocationReconciliationRequired === true
        && raw.environment === environment && ['UNBOUND','BOUND'].includes(raw.ownershipState));
      // Copy only validated primitives before awaiting account/database services.
      const candidate = Object.freeze({accountId:raw.accountId,tokenSha256:raw.tokenSha256,
        supersedesTokenSha256:raw.supersedesTokenSha256,observedAtMs:raw.observedAtMs,expiresAtMs:raw.expiresAtMs});
      requireFact(uuid(candidate.accountId) && digest(candidate.tokenSha256) && candidate.tokenSha256 === hash(purchaseToken)
        && (candidate.supersedesTokenSha256 === null || digest(candidate.supersedesTokenSha256))
        && candidate.supersedesTokenSha256 !== candidate.tokenSha256
        && Number.isSafeInteger(candidate.observedAtMs) && candidate.observedAtMs >= 0
        && Number.isSafeInteger(candidate.expiresAtMs));
      stage = 'ACCOUNT_RECHECK';
      const account = await readAccount({signal});
      requireFact(record(account) && typeof account.accountId === 'string'
        && account.accountId.toLowerCase() === candidate.accountId);
      signal?.throwIfAborted();
      stage = 'FRESHNESS';
      const now = clock();
      requireFact(Number.isSafeInteger(now) && now >= candidate.observedAtMs
        && now - candidate.observedAtMs <= maxAgeMs && candidate.expiresAtMs > now);
      stage = 'COMMIT'; attempted = true;
      const ack = await commitStatement(OWNERSHIP_SQL,[candidate.accountId,packageName,environment,
        candidate.tokenSha256,candidate.supersedesTokenSha256]);
      requireFact(record(ack) && Array.isArray(ack.rows) && ack.rows.length === 1 && record(ack.rows[0].result));
      const result = ack.rows[0].result;
      if ((result.status === 'DENIED' && DENIALS.has(result.reason)) || (result.status === 'HOLD' && HOLDS.has(result.reason))) {
        return Object.freeze({...base,status:result.status,reason:result.reason,writeAttempted:true});
      }
      requireFact(result.status === 'RECORDED' && result.entitled === false && typeof result.created === 'boolean'
        && result.accountId === candidate.accountId && result.packageName === packageName && result.environment === environment
        && result.tokenSha256 === candidate.tokenSha256 && result.supersedesTokenSha256 === candidate.supersedesTokenSha256);
      // Abort after dispatch is not a rollback. Report a known recorded receipt.
      return Object.freeze({...base,status:signal?.aborted ? 'RECORDED_AFTER_CANCELLATION' : 'OWNERSHIP_RECORDED',
        ownershipRecorded:true,writeAttempted:true,created:result.created,tokenSha256:candidate.tokenSha256,
        accountId:candidate.accountId,supersedesTokenSha256:candidate.supersedesTokenSha256,
        acknowledgementAndAdmissionRequired:true});
    } catch {
      return Object.freeze({...base,status:attempted ? 'UNCERTAIN' : 'HOLD',stage,writeAttempted:attempted,
        reason:attempted ? 'COMMIT_ACKNOWLEDGEMENT_UNKNOWN' : signal?.aborted ? 'CANCELLED' : 'OWNERSHIP_INPUT_OR_VERIFICATION_REFUSED',
        reconciliationRequired:attempted});
    }
  }});
}

/** Recommended composition: constructs the existing verifier with the SAME
 * frozen package/environment config. The public request supplies only a token;
 * callers cannot inject a pre-verified candidate or select a different app.
 * Import is deferred so the low-level boundary suite remains dependency-free.
 */
export async function createVerifiedGoogleOwnershipRecorder(config, ports) {
  const boundConfig = structuredClone(config);
  const boundPorts = {readAccount:ports.readAccount,readAccessToken:ports.readAccessToken,
    readTokenBinding:ports.readTokenBinding,fetch:ports.fetch,clock:ports.clock,
    commitStatement:ports.commitStatement};
  const {createGoogleSubscriptionVerifier} = await import('./google-subscription-verifier.mjs');
  const verifier = createGoogleSubscriptionVerifier(boundConfig,boundPorts);
  return createGoogleOwnershipRecorder(boundConfig,{verify:input=>verifier.verify(input),
    readAccount:boundPorts.readAccount,clock:boundPorts.clock,commitStatement:boundPorts.commitStatement});
}
