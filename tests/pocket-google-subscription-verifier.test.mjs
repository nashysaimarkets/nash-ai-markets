import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createGoogleSubscriptionVerifier} from '../app/api/pocket/google-subscription-verifier.mjs';

const NOW = Date.parse('2026-10-21T21:55:00Z');
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const TOKEN = 'synthetic-purchase-not-a-credential';
const OAUTH = 'synthetic-server-oauth-not-a-credential';
const hash = s => createHash('sha256').update(s).digest('hex');
const bound = (accountId = A, delta = {}) => ({status: 'BOUND', accountId, revoked: false, replacedByTokenSha256: null, ...delta});
function fixture() {
  const config = {packageName: 'com.example.synthetic', productId: 'pocket_bullseye_monthly', basePlanIds: ['synthetic-monthly'], environment: 'production'};
  const purchase = {kind: 'androidpublisher#subscriptionPurchaseV2', subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE',
    acknowledgementState: 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED', startTime: '2026-10-01T00:00:00Z',
    externalAccountIdentifiers: {obfuscatedExternalAccountId: 'synthetic-opaque-account'},
    lineItems: [{productId: config.productId, expiryTime: '2026-11-01T00:00:00Z', offerDetails: {basePlanId: config.basePlanIds[0]}}]};
  const calls = {account: 0, oauth: 0, fetch: [], ownership: []};
  const ownership = new Map();
  const ports = {
    clock: () => NOW,
    async readAccount() { calls.account++; return {accountId: A, obfuscatedAccountId: 'synthetic-opaque-account'}; },
    async readAccessToken() { calls.oauth++; return OAUTH; },
    async readTokenBinding({tokenSha256}) { calls.ownership.push(tokenSha256); return ownership.get(tokenSha256) ?? {status: 'UNBOUND'}; },
    async fetch(url, options) { calls.fetch.push({url, options}); return new Response(JSON.stringify(purchase), {headers: {'content-type': 'application/json'}}); },
  };
  return {config, purchase, calls, ports, ownership, run(input = {}) { return createGoogleSubscriptionVerifier(config, ports).verify({purchaseToken: TOKEN, ...input}); }};
}
const assertClosed = r => { assert.equal(r.entitled, false); assert.equal(r.entitlementCandidate, false); assert.equal(r.writesPerformed, 0); };

test('active verified purchase produces an atomic-persistence candidate, never an entitlement', async () => {
  const f = fixture(), r = await f.run();
  assert.equal(r.status, 'VERIFIED_FOR_PERSISTENCE'); assert.equal(r.entitlementCandidate, true);
  assert.equal(r.entitled, false); assert.equal(r.writesPerformed, 0);
  assert.equal(r.atomicOwnershipRecheckRequired, true); assert.equal(r.revocationReconciliationRequired, true);
  assert.equal(r.acknowledgementRequired, false); assert.equal(r.tokenSha256, hash(TOKEN));
  assert.equal(f.calls.account, 2); assert.equal(f.calls.fetch.length, 1);
  assert.ok(!JSON.stringify(r).includes(TOKEN)); assert.ok(!JSON.stringify(r).includes(OAUTH));
});
for (const state of ['IN_GRACE_PERIOD', 'CANCELED']) test(`${state} retains only the unexpired candidate`, async () => {
  const f = fixture(); f.purchase.subscriptionState = 'SUBSCRIPTION_STATE_' + state;
  assert.equal((await f.run()).status, 'VERIFIED_FOR_PERSISTENCE');
});
for (const state of ['PENDING', 'PAUSED', 'ON_HOLD', 'EXPIRED', 'PENDING_PURCHASE_CANCELED']) test(`${state} never grants or creates a candidate`, async () => {
  const f = fixture(); f.purchase.subscriptionState = 'SUBSCRIPTION_STATE_' + state;
  const r = await f.run(); assertClosed(r); assert.equal(r.status, 'DENIED');
});
test('unknown provider and acknowledgement states fail closed', async () => {
  for (const field of ['subscriptionState', 'acknowledgementState']) { const f = fixture(); f.purchase[field] = 'future-unknown-state'; assertClosed(await f.run()); }
});
test('pending acknowledgement is retained as a requirement, never automatically acknowledged', async () => {
  const f = fixture(); f.purchase.acknowledgementState = 'ACKNOWLEDGEMENT_STATE_PENDING';
  const r = await f.run(); assert.equal(r.acknowledgementRequired, true); assert.equal(r.entitled, false);
  assert.equal(f.calls.fetch.length, 1); assert.equal(f.calls.fetch[0].options.method, 'GET');
});
test('expiry at or before now and malformed calendar dates are rejected', async () => {
  for (const expiry of [new Date(NOW).toISOString(), '2026-10-20T00:00:00Z', '2027-02-30T00:00:00Z', '2026-14-01T00:00:00Z', 'not-a-date']) {
    const f = fixture(); f.purchase.lineItems[0].expiryTime = expiry; assertClosed(await f.run());
  }
});
test('RFC3339 offsets and nanosecond fractions are supported without assuming UTC text', async () => {
  const f = fixture(); f.purchase.lineItems[0].expiryTime = '2026-11-01T01:00:00.123456789+01:00';
  const r = await f.run(); assert.equal(r.expiresAtMs, Date.parse('2026-11-01T00:00:00.123Z'));
});
test('future start and expiry reached during account recheck are refused', async () => {
  const f = fixture(); f.purchase.startTime = '2027-01-01T00:00:00Z'; assertClosed(await f.run());
  const g = fixture(); let n = 0; g.ports.clock = () => n++ ? Date.parse(g.purchase.lineItems[0].expiryTime) : NOW;
  assertClosed(await g.run());
});
test('wrong account, missing obfuscation and client entitlement/email assertions cannot prove ownership', async () => {
  for (const id of [undefined, 'other-account']) { const f = fixture(); f.purchase.externalAccountIdentifiers = {obfuscatedExternalAccountId: id};
    f.purchase.entitled = true; f.purchase.email = 'synthetic@example.invalid'; assertClosed(await f.run()); }
});
test('wrong product, wrong base plan and duplicate matching items fail closed', async () => {
  for (const mutate of [p => p.lineItems[0].productId = 'other', p => p.lineItems[0].offerDetails.basePlanId = 'other', p => p.lineItems.push(structuredClone(p.lineItems[0]))]) {
    const f = fixture(); mutate(f.purchase); assertClosed(await f.run());
  }
});
test('an unrelated unexpired product cannot rescue an expired target product', async () => {
  const f = fixture(); f.purchase.lineItems.push({...structuredClone(f.purchase.lineItems[0]), productId: 'other'});
  f.purchase.lineItems[0].expiryTime = '2026-10-01T01:00:00Z'; assertClosed(await f.run());
});
test('test purchases are confined to explicit sandbox mode', async () => {
  const f = fixture(); f.purchase.testPurchase = {}; assertClosed(await f.run());
  f.config.environment = 'sandbox'; assert.equal((await f.run()).status, 'VERIFIED_FOR_PERSISTENCE');
  delete f.purchase.testPurchase; assertClosed(await f.run());
});
test('missing authenticated account or unknown ownership does not contact Google', async () => {
  for (const mode of ['account', 'unknown', 'ambiguous']) {
    const f = fixture();
    if (mode === 'account') f.ports.readAccount = async () => null;
    else f.ports.readTokenBinding = async () => mode === 'unknown' ? null : {status: 'UNBOUND', accountId: B};
    assertClosed(await f.run()); assert.equal(f.calls.fetch.length, 0); assert.equal(f.calls.oauth, 0);
  }
});
test('existing token assigned to another account is rejected before credential access', async () => {
  const f = fixture(); f.ownership.set(hash(TOKEN), bound(B));
  const r = await f.run(); assertClosed(r); assert.equal(r.reason, 'ACCOUNT_OWNERSHIP_CONFLICT'); assert.equal(f.calls.oauth, 0);
});
test('same-owner restore remains a candidate; revoked or superseded tokens are refused', async () => {
  const f = fixture(); f.ownership.set(hash(TOKEN), bound()); assert.equal((await f.run()).ownershipState, 'BOUND');
  for (const delta of [{revoked: true}, {replacedByTokenSha256: 'a'.repeat(64)}]) {
    const g = fixture(); g.ownership.set(hash(TOKEN), bound(A, delta)); assertClosed(await g.run()); assert.equal(g.calls.fetch.length, 0);
  }
});
test('linked token must have known same-account ownership and be retired atomically later', async () => {
  const f = fixture(); f.purchase.linkedPurchaseToken = 'synthetic-previous-purchase';
  assertClosed(await f.run());
  f.ownership.set(hash(f.purchase.linkedPurchaseToken), bound(B)); assertClosed(await f.run());
  f.ownership.set(hash(f.purchase.linkedPurchaseToken), bound());
  const r = await f.run(); assert.equal(r.supersedesTokenSha256, hash(f.purchase.linkedPurchaseToken));
  assert.equal(r.atomicOwnershipRecheckRequired, true); assert.equal(r.entitled, false);
});
test('linked token self-cycle and conflicting successor cannot be accepted', async () => {
  const f = fixture(); f.purchase.linkedPurchaseToken = TOKEN; assertClosed(await f.run());
  f.purchase.linkedPurchaseToken = 'synthetic-old'; f.ownership.set(hash('synthetic-old'), bound(A, {replacedByTokenSha256: 'a'.repeat(64)}));
  assertClosed(await f.run());
});
test('restoring an already-linked same-owner successor is idempotent as a candidate', async () => {
  const f = fixture(); f.purchase.linkedPurchaseToken = 'synthetic-old';
  f.ownership.set(hash(TOKEN), bound()); f.ownership.set(hash('synthetic-old'), bound(A, {replacedByTokenSha256: hash(TOKEN)}));
  assert.equal((await f.run()).status, 'VERIFIED_FOR_PERSISTENCE');
});
test('account switch during verification refuses the result', async () => {
  const f = fixture(); let n = 0;
  f.ports.readAccount = async () => ({accountId: n++ ? B : A, obfuscatedAccountId: 'synthetic-opaque-account'});
  const r = await f.run(); assertClosed(r); assert.equal(r.reason, 'SESSION_CHANGED');
});
test('configuration, ports and token are snapshotted against mutation across await', async () => {
  const f = fixture(), verifier = createGoogleSubscriptionVerifier(f.config, f.ports), input = {purchaseToken: TOKEN};
  f.config.packageName = 'com.attacker'; f.config.productId = 'other'; f.config.basePlanIds[0] = 'other';
  f.ports.fetch = async () => { throw Error('replacement must not run'); };
  const promise = verifier.verify(input); input.purchaseToken = 'changed';
  assert.equal((await promise).status, 'VERIFIED_FOR_PERSISTENCE');
  assert.ok(f.calls.fetch[0].url.includes('/com.example.synthetic/')); assert.ok(f.calls.fetch[0].url.endsWith(TOKEN));
});
test('transport uses one fixed HTTPS GET, encoded path, no redirects, no cookies and no body', async () => {
  const f = fixture(), special = 'synthetic/path?query#fragment%'; await f.run({purchaseToken: special});
  const {url, options} = f.calls.fetch[0];
  assert.equal(url, 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications/com.example.synthetic/purchases/subscriptionsv2/tokens/' + encodeURIComponent(special));
  assert.equal(options.method, 'GET'); assert.equal(options.redirect, 'error'); assert.equal(options.credentials, 'omit');
  assert.equal(options.cache, 'no-store'); assert.equal(options.headers.Authorization, 'Bearer ' + OAUTH);
  assert.equal(options.body, undefined); assert.equal(f.calls.fetch.length, 1);
});
test('invalid token and invalid abort signal are sanitized before any external effect', async () => {
  for (const input of [{purchaseToken: ''}, {purchaseToken: 'token\nvalue'}, {purchaseToken: 'x'.repeat(4097)}, {signal: {removeEventListener() { throw Error('hostile'); }}}]) {
    const f = fixture(); assertClosed(await f.run(input)); assert.equal(f.calls.account, 0); assert.equal(f.calls.fetch.length, 0);
  }
});
test('provider failure retains no token, response message, stack or OAuth credential and is not retried', async () => {
  const f = fixture(); let calls = 0;
  f.ports.fetch = async () => { calls++; throw Error(TOKEN + OAUTH); };
  const r = await f.run(); assertClosed(r); assert.equal(calls, 1);
  assert.ok(!JSON.stringify(r).includes(TOKEN)); assert.ok(!JSON.stringify(r).includes(OAUTH));
});
test('HTTP errors, wrong origins, malformed JSON and wrong media types fail closed', async () => {
  for (const mode of ['401', '404', '500', 'origin', 'json', 'media']) {
    const f = fixture(); f.ports.fetch = async () => {
      const r = new Response(mode === 'json' ? 'invalid:' + TOKEN : JSON.stringify(f.purchase),
        {status: /^\d/.test(mode) ? Number(mode) : 200, headers: {'content-type': mode === 'media' ? 'text/html' : 'application/json'}});
      if (mode === 'origin') Object.defineProperty(r, 'url', {value: 'https://unapproved.invalid/'});
      return r;
    };
    const r = await f.run(); assertClosed(r); assert.ok(!JSON.stringify(r).includes(TOKEN));
  }
});
test('advertised and streamed oversized responses are bounded without parsing', async () => {
  for (const header of [false, true]) { const f = fixture();
    f.ports.fetch = async () => new Response(' '.repeat(65537), {headers: {'content-type': 'application/json', ...(header ? {'content-length': '65537'} : {})}});
    const r = await f.run(); assertClosed(r); assert.equal(r.reason, 'GOOGLE_RESPONSE_TOO_LARGE'); }
});
test('timeout of an uncooperative OAuth reader prevents every later network attempt', async () => {
  const f = fixture(); f.config.timeoutMs = 10; let resolveToken;
  f.ports.readAccessToken = () => new Promise(resolve => { resolveToken = resolve; });
  const r = await f.run(); assertClosed(r); assert.equal(r.reason, 'CANCELLED_OR_TIMEOUT');
  resolveToken(OAUTH); await Promise.resolve(); assert.equal(f.calls.fetch.length, 0);
});
test('already-cancelled request never reads account or credentials', async () => {
  const f = fixture(), controller = new AbortController(); controller.abort();
  assertClosed(await f.run({signal: controller.signal})); assert.equal(f.calls.account, 0); assert.equal(f.calls.oauth, 0);
});
test('cancellation of an uncooperative fetch ends the attempt without retry', async () => {
  const f = fixture(); f.config.timeoutMs = 10; let n = 0;
  f.ports.fetch = () => { n++; return new Promise(() => {}); };
  const r = await f.run(); assertClosed(r); assert.equal(n, 1); assert.equal(r.reason, 'CANCELLED_OR_TIMEOUT');
});
test('missing configuration, unknown environment and absent read ports cannot create a verifier', () => {
  const f = fixture();
  for (const config of [{}, {...f.config, basePlanIds: []}, {...f.config, environment: 'automatic'}, {...f.config, timeoutMs: 10001}, {...f.config, packageName: 'https://unapproved.invalid'}]) {
    assert.throws(() => createGoogleSubscriptionVerifier(config, f.ports));
  }
  assert.throws(() => createGoogleSubscriptionVerifier(f.config, {}));
});

test('the fetch signal is closed after an HTTP error rather than leaving an unread body active', async () => {
  const f = fixture(); let observed;
  f.ports.fetch = async (_url, options) => { observed = options.signal; return new Response('synthetic error', {status: 500}); };
  assertClosed(await f.run()); assert.equal(observed.aborted, true);
});
