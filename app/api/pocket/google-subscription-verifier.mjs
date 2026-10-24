/** Server-only Google Play verification. Importing this module has no effects.
 * Read ports MUST come from authenticated server services, never a request body.
 * A successful result is a persistence candidate, NOT a scanner entitlement.
 * Atomic token ownership, linked-token retirement, acknowledgement, notifications
 * and revocation reconciliation must be integrated before enabling purchases.
 */
import {createHash, timingSafeEqual} from 'node:crypto';

const MAX_BODY_BYTES = 65536;
const ORIGIN = 'https://androidpublisher.googleapis.com';
const PREFIX = 'SUBSCRIPTION_STATE_';
const DENIED_STATES = new Set(['PENDING', 'PAUSED', 'ON_HOLD', 'EXPIRED', 'PENDING_PURCHASE_CANCELED']);
const ELIGIBLE_STATES = new Set(['ACTIVE', 'IN_GRACE_PERIOD', 'CANCELED']);
const digest = value => createHash('sha256').update(value).digest('hex');
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
const text = (value, max) => typeof value === 'string' && value.length > 0 && value.length <= max && !/[\s\x00-\x1f\x7f]/u.test(value);
const same = (a, b) => typeof a === 'string' && typeof b === 'string' &&
  Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a), Buffer.from(b));
class Refusal extends Error {
  constructor(reason, status = 'HOLD') { super(reason); this.reason = reason; this.status = status; }
}
const requireFact = (ok, reason, status) => { if (!ok) throw new Refusal(reason, status); };

// Reject malformed calendar dates instead of accepting Date.parse normalization.
function timestamp(value) {
  if (typeof value !== 'string') return NaN;
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!m) return NaN;
  const [year, month, day, hour, minute, second] = m.slice(1, 7).map(Number);
  if (year < 1970 || month < 1 || month > 12 || day < 1 ||
      day > new Date(Date.UTC(year, month, 0)).getUTCDate() || hour > 23 || minute > 59 || second > 59 ||
      (m[7] !== 'Z' && (Number(m[7].slice(1, 3)) > 23 || Number(m[7].slice(4)) > 59))) return NaN;
  return Date.parse(value);
}

async function bounded(action, signal) {
  signal.throwIfAborted();
  let rejectAbort;
  const aborted = new Promise((_, reject) => { rejectAbort = () => reject(new Refusal('CANCELLED_OR_TIMEOUT')); });
  signal.addEventListener('abort', rejectAbort, {once: true});
  try { return await Promise.race([Promise.resolve().then(() => { signal.throwIfAborted(); return action(); }), aborted]); }
  finally { signal.removeEventListener('abort', rejectAbort); }
}

async function readJson(response, signal) {
  requireFact(response?.status === 200, response?.status === 404 ? 'PURCHASE_NOT_FOUND' : 'GOOGLE_UNAVAILABLE',
    response?.status === 404 ? 'DENIED' : 'HOLD');
  requireFact(/^application\/json(?:\s*;|$)/i.test(response.headers?.get('content-type') ?? ''), 'GOOGLE_RESPONSE_INVALID');
  const advertised = response.headers.get('content-length');
  requireFact(advertised === null || (/^\d+$/.test(advertised) && Number(advertised) <= MAX_BODY_BYTES), 'GOOGLE_RESPONSE_TOO_LARGE');
  const reader = response.body?.getReader();
  requireFact(reader && typeof reader.read === 'function', 'GOOGLE_RESPONSE_INVALID');
  const chunks = []; let size = 0, complete = false;
  try {
    while (true) {
      const {done, value} = await bounded(() => reader.read(), signal);
      if (done) { complete = true; break; }
      requireFact(value instanceof Uint8Array, 'GOOGLE_RESPONSE_INVALID');
      size += value.byteLength;
      requireFact(size <= MAX_BODY_BYTES, 'GOOGLE_RESPONSE_TOO_LARGE');
      chunks.push(Buffer.from(value));
    }
    return JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(Buffer.concat(chunks)));
  } finally {
    if (!complete) { try { void Promise.resolve(reader.cancel()).catch(() => {}); } catch {} }
    reader.releaseLock();
  }
}

function snapshotAccount(value) {
  requireFact(record(value) && uuid(value.accountId) && text(value.obfuscatedAccountId, 64), 'AUTHENTICATED_ACCOUNT_REQUIRED');
  return Object.freeze({accountId: value.accountId.toLowerCase(), obfuscatedAccountId: value.obfuscatedAccountId});
}
function snapshotBinding(value, account, currentHash, isLinked = false) {
  requireFact(record(value), 'TOKEN_OWNERSHIP_UNKNOWN');
  if (value.status === 'UNBOUND') {
    requireFact(Object.keys(value).length === 1, 'TOKEN_OWNERSHIP_UNKNOWN');
    requireFact(!isLinked, 'LINKED_OWNERSHIP_REVIEW_REQUIRED');
    return 'UNBOUND';
  }
  requireFact(value.status === 'BOUND' && uuid(value.accountId) && typeof value.revoked === 'boolean' &&
    (value.replacedByTokenSha256 === null || /^[a-f0-9]{64}$/.test(value.replacedByTokenSha256 ?? '')), 'TOKEN_OWNERSHIP_UNKNOWN');
  requireFact(value.accountId.toLowerCase() === account.accountId, 'ACCOUNT_OWNERSHIP_CONFLICT', 'DENIED');
  requireFact(!value.revoked, 'TOKEN_REVOKED', 'DENIED');
  requireFact(value.replacedByTokenSha256 === null || (isLinked && value.replacedByTokenSha256 === currentHash),
    'TOKEN_REPLACED', 'DENIED');
  return 'BOUND';
}

/** No route is mounted. The caller must supply an authenticated account lookup,
 * authoritative token index and existing server OAuth credential service.
 * Missing/unknown lookups fail closed; emails and native entitlement flags are
 * never accepted as ownership evidence. Each verification sends at most one GET.
 */
export function createGoogleSubscriptionVerifier(config, ports) {
  requireFact(record(config) && /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/i.test(config.packageName ?? '') &&
    text(config.productId, 150) && Array.isArray(config.basePlanIds) && config.basePlanIds.length > 0 &&
    config.basePlanIds.every(value => text(value, 100)) && new Set(config.basePlanIds).size === config.basePlanIds.length &&
    ['production', 'sandbox'].includes(config.environment), 'VERIFIER_CONFIG_INVALID');
  requireFact(record(ports) && ['readAccount', 'readAccessToken', 'readTokenBinding', 'fetch'].every(key => typeof ports[key] === 'function'), 'VERIFIER_PORTS_REQUIRED');
  const timeoutMs = config.timeoutMs ?? 10000;
  requireFact(Number.isSafeInteger(timeoutMs) && timeoutMs > 0 && timeoutMs <= 10000, 'VERIFIER_CONFIG_INVALID');
  const {packageName, productId, environment} = config;
  const basePlanIds = new Set(config.basePlanIds);
  const {readAccount, readAccessToken, readTokenBinding, fetch: fetchOnce} = ports;
  const clock = ports.clock ?? Date.now;
  requireFact(typeof clock === 'function', 'VERIFIER_CONFIG_INVALID');

  return Object.freeze({async verify(input = {}) {
    let stage = 'INPUT', signal, timer, controller, externalSignal, onExternalAbort;
    const base = {entitled: false, entitlementCandidate: false, writesPerformed: 0};
    try {
      const {purchaseToken} = input;
      requireFact(text(purchaseToken, 4096), 'PURCHASE_TOKEN_INVALID');
      externalSignal = input.signal;
      requireFact(externalSignal === undefined || externalSignal instanceof AbortSignal, 'SIGNAL_INVALID');
      controller = new AbortController(); signal = controller.signal;
      onExternalAbort = () => controller.abort();
      if (externalSignal?.aborted) controller.abort();
      externalSignal?.addEventListener('abort', onExternalAbort, {once: true});
      timer = setTimeout(() => controller.abort(), timeoutMs);
      const tokenSha256 = digest(purchaseToken);
      stage = 'ACCOUNT';
      const account = snapshotAccount(await bounded(() => readAccount({signal}), signal));
      const current = await bounded(() => readTokenBinding({tokenSha256, signal}), signal);
      const ownershipState = snapshotBinding(current, account, tokenSha256);
      stage = 'GOOGLE_GET';
      const accessToken = await bounded(() => readAccessToken({signal}), signal);
      requireFact(text(accessToken, 8192), 'SERVER_OAUTH_REQUIRED');
      const url = `${ORIGIN}/androidpublisher/v3/applications/${encodeURIComponent(packageName)}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`;
      const response = await bounded(() => fetchOnce(url, {method: 'GET', redirect: 'error', credentials: 'omit', cache: 'no-store',
        headers: {Authorization: `Bearer ${accessToken}`, Accept: 'application/json'}, signal}), signal);
      requireFact(!response?.url || response.url === url, 'GOOGLE_RESPONSE_ORIGIN_MISMATCH');
      const purchase = await readJson(response, signal);
      stage = 'PURCHASE_POLICY';
      requireFact(record(purchase) && purchase.kind === 'androidpublisher#subscriptionPurchaseV2', 'GOOGLE_RESPONSE_INVALID');
      requireFact(purchase.testPurchase == null || record(purchase.testPurchase), 'GOOGLE_RESPONSE_INVALID');
      const testPurchase = purchase.testPurchase != null;
      requireFact(testPurchase === (environment === 'sandbox'), 'PURCHASE_ENVIRONMENT_MISMATCH', 'DENIED');
      requireFact(same(purchase.externalAccountIdentifiers?.obfuscatedExternalAccountId, account.obfuscatedAccountId),
        'GOOGLE_ACCOUNT_BINDING_MISMATCH', 'DENIED');
      const state = typeof purchase.subscriptionState === 'string' && purchase.subscriptionState.startsWith(PREFIX)
        ? purchase.subscriptionState.slice(PREFIX.length) : '';
      requireFact(!DENIED_STATES.has(state), 'SUBSCRIPTION_NOT_ENTITLED', 'DENIED');
      requireFact(ELIGIBLE_STATES.has(state), 'SUBSCRIPTION_STATE_UNKNOWN');
      requireFact(Array.isArray(purchase.lineItems) && purchase.lineItems.length > 0 && purchase.lineItems.length <= 100,
        'GOOGLE_RESPONSE_INVALID');
      const matches = purchase.lineItems.filter(item => record(item) && item.productId === productId && basePlanIds.has(item.offerDetails?.basePlanId));
      requireFact(matches.length === 1, 'PRODUCT_OR_PLAN_AMBIGUOUS', 'DENIED');
      const item = matches[0], observedAtMs = clock(), expiresAtMs = timestamp(item.expiryTime), startsAtMs = timestamp(purchase.startTime);
      requireFact(Number.isSafeInteger(observedAtMs) && observedAtMs >= 0 && Number.isFinite(expiresAtMs) && Number.isFinite(startsAtMs), 'PURCHASE_TIME_INVALID');
      requireFact(startsAtMs <= observedAtMs && startsAtMs < expiresAtMs, 'PURCHASE_TIME_INVALID');
      requireFact(expiresAtMs > observedAtMs, 'SUBSCRIPTION_EXPIRED', 'DENIED');
      requireFact(['ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED', 'ACKNOWLEDGEMENT_STATE_PENDING'].includes(purchase.acknowledgementState), 'ACKNOWLEDGEMENT_STATE_UNKNOWN');
      stage = 'LINKED_OWNERSHIP';
      let supersedesTokenSha256 = null;
      if (purchase.linkedPurchaseToken != null) {
        requireFact(text(purchase.linkedPurchaseToken, 4096), 'LINKED_TOKEN_INVALID');
        supersedesTokenSha256 = digest(purchase.linkedPurchaseToken);
        requireFact(supersedesTokenSha256 !== tokenSha256, 'LINKED_TOKEN_CYCLE', 'DENIED');
        const linked = await bounded(() => readTokenBinding({tokenSha256: supersedesTokenSha256, signal}), signal);
        snapshotBinding(linked, account, tokenSha256, true);
      }
      stage = 'SESSION_RECHECK';
      const currentAccount = snapshotAccount(await bounded(() => readAccount({signal}), signal));
      requireFact(currentAccount.accountId === account.accountId && same(currentAccount.obfuscatedAccountId, account.obfuscatedAccountId), 'SESSION_CHANGED');
      signal.throwIfAborted();
      const finalAtMs = clock();
      requireFact(Number.isSafeInteger(finalAtMs) && finalAtMs >= observedAtMs && expiresAtMs > finalAtMs, 'PURCHASE_EXPIRED_DURING_CHECK');
      return Object.freeze({...base, status: 'VERIFIED_FOR_PERSISTENCE', entitlementCandidate: true,
        accountId: account.accountId, tokenSha256, supersedesTokenSha256, ownershipState,
        productId, basePlanId: item.offerDetails.basePlanId, environment, state, expiresAtMs, observedAtMs: finalAtMs,
        acknowledgementRequired: purchase.acknowledgementState === 'ACKNOWLEDGEMENT_STATE_PENDING',
        atomicOwnershipRecheckRequired: true, revocationReconciliationRequired: true});
    } catch (error) {
      return Object.freeze({...base, status: error instanceof Refusal ? error.status : 'HOLD', stage,
        reason: signal?.aborted ? 'CANCELLED_OR_TIMEOUT' : error instanceof Refusal ? error.reason : 'VERIFICATION_UNAVAILABLE'});
    } finally {
      clearTimeout(timer);
      controller?.abort(); // Close any unread error body or late read-only operation.
      if (externalSignal instanceof AbortSignal && onExternalAbort) externalSignal.removeEventListener('abort', onExternalAbort);
    }
  }});
}
