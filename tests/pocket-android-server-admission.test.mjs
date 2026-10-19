import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');

async function load(path, bindings, exports) {
  const source = await read(path);
  const js = stripTypeScriptTypes(source)
    .replace(/^import[\s\S]*?;\s*/gm, '')
    .replace(/^export\s+/gm, '');
  return new Function(...Object.keys(bindings), js + '\nreturn {' + exports.join(',') + '};')(...Object.values(bindings));
}

const raw = {
  isNative: true, entitled: true, freeUseConsumed: false,
  productId: 'untrusted-product', displayName: 'Pocket Monthly', displayPrice: '£4.99',
  purchaseFound: true, purchaseToken: 'synthetic-private-token', orderId: 'synthetic-order',
  appAccountToken: 'other-account', email: 'other@example.invalid', userId: 'another-user',
};
const policy = await load('app/pocket/native-subscription-policy.ts', {}, ['blockedNativeAccess']);

async function fixture(platform, metadata = raw) {
  const calls = { status: 0, restore: 0, purchase: 0, consume: 0 };
  const plugin = {
    getStatus: async () => { calls.status++; return metadata; },
    restore: async () => { calls.restore++; return metadata; },
    purchase: async () => { calls.purchase++; return metadata; },
    consumeFreeUse: async () => { calls.consume++; return { freeUseConsumed: false }; },
  };
  const Capacitor = { isNativePlatform: () => platform !== 'web', getPlatform: () => platform };
  const play = await load('app/pocket/play-billing.ts', { Capacitor, registerPlugin: () => plugin, ...policy },
    ['getPlayAccessStatus', 'restorePlaySubscription', 'purchasePlaySubscription', 'consumePlayFreeUse', 'GOOGLE_MONTHLY_PRODUCT_ID']);
  const native = await load('app/pocket/native-subscription.ts', {
    Capacitor, ...policy, ...play,
    APPLE_MONTHLY_PRODUCT_ID: 'com.nashaimarkets.pocketbullseye.monthly',
    getAppleAccessStatus: plugin.getStatus, restoreAppleSubscription: plugin.restore,
  }, ['getNativeAccessStatus', 'restoreNativeSubscription', 'purchaseNativeSubscription', 'consumeNativeFreeUse', 'isNativePocketApp']);
  return { native, play, calls };
}

test('actual status adapters deny local entitlement, device free use and the historical entitled web fallback', async () => {
  for (const platform of ['android', 'ios', 'web']) {
    const { native } = await fixture(platform);
    const status = await native.getNativeAccessStatus();
    assert.equal(status.entitled, false, platform);
    assert.equal(status.freeUseConsumed, true, platform);
    assert.equal(status.serverVerificationRequired, true);
    assert.equal(status.isNative, platform !== 'web', 'platform identity is not forged to enforce HOLD');
    for (const key of ['purchaseToken', 'orderId', 'appAccountToken', 'email', 'userId', 'transactionId']) assert.equal(key in status, false, key);
  }
});

test('actual purchase entry points cannot call a store; first-free compatibility cannot replenish credit', async () => {
  for (const platform of ['android', 'ios', 'web']) {
    const { native, play, calls } = await fixture(platform);
    await assert.rejects(native.purchaseNativeSubscription(), /unavailable.*ownership verification/i);
    await assert.rejects(play.purchasePlaySubscription(), /unavailable.*current-account ownership/i);
    await native.consumeNativeFreeUse(); await play.consumePlayFreeUse();
    assert.equal(calls.purchase, 0); assert.equal(calls.consume, 0);
  }
});

test('Restore preserves local pending/purchase diagnostics without grants, tokens or ownership transfer', async () => {
  for (const platform of ['android', 'ios', 'web']) {
    const { native, calls } = await fixture(platform, { ...raw, pending: true });
    const restored = await native.restoreNativeSubscription();
    assert.equal(restored.entitled, false); assert.equal(restored.freeUseConsumed, true);
    assert.equal(restored.pending, platform !== 'web');
    assert.equal(restored.purchaseFound, platform !== 'web');
    assert.equal(calls.restore, platform === 'web' ? 0 : 1);
    assert.doesNotMatch(JSON.stringify(restored), /synthetic-private-token|synthetic-order|other-account|other@example/);
  }
});

test('raw account changes and forged verification markers cannot leak or inherit access', async () => {
  for (const identity of ['account-a', 'account-b']) {
    const { native } = await fixture('android', { ...raw, userId: identity, serverVerificationRequired: false, entitled: true });
    const status = await native.getNativeAccessStatus();
    assert.equal(status.entitled, false); assert.equal(status.serverVerificationRequired, true);
    assert.equal('userId' in status, false);
  }
  for (const value of [null, undefined, {}, { entitled: true, freeUseConsumed: false }]) {
    const { native } = await fixture('android', value);
    assert.equal((await native.getNativeAccessStatus()).entitled, false);
  }
});

test('actual primary and review request prefixes reject old native/web bypasses before provider dispatch', async () => {
  const source = await read('app/pocket/PocketBullseye.tsx');
  const start = source.indexOf('  async function analyse()');
  const end = source.indexOf('    if (!reviewTarget && !preflightAllowsAnalysis', start);
  assert.ok(start >= 0 && end > start);
  const body = stripTypeScriptTypes(source.slice(start, end) + '\nthrow Error("PROVIDER_BOUNDARY_REACHED");\n}');
  for (const platform of ['android', 'ios', 'web']) for (const reviewTarget of [null, {}]) {
    const { native } = await fixture(platform);
    let holds = 0;
    const bindings = {
      image: 'private-source', contextImage: 'context', detailImage: 'detail', fourHourImage: '4h',
      privacyChecked: true, busy: false, analysisRequestActive: { current: false }, reviewTarget,
      nativeAccess: raw, isNativePocketApp: () => platform !== 'web',
      refreshNativeAccess: () => native.getNativeAccessStatus(),
      openSubscriptionPaywall: () => { holds++; },
    };
    const analyse = new Function(...Object.keys(bindings), body + ';return analyse;')(...Object.values(bindings));
    await analyse(); assert.equal(holds, 1, platform + (reviewTarget ? ' review' : ' primary'));
  }
});

test('actual additional-request gate has no browser bypass and denies unverified status', async () => {
  const source = await read('app/pocket/PocketBullseye.tsx');
  const start = source.indexOf('  async function requireNativeEntitlementForAdditionalRequest(');
  const end = source.indexOf('  function openChartFocus(', start);
  const body = stripTypeScriptTypes(source.slice(start, end));
  for (const platform of ['android', 'web']) {
    const { native } = await fixture(platform); let holds = 0;
    const gate = new Function('refreshNativeAccess', 'openSubscriptionPaywall', 'isNativePocketApp', body + ';return requireNativeEntitlementForAdditionalRequest;')(
      () => native.getNativeAccessStatus(), () => { holds++; }, () => platform !== 'web');
    assert.equal(await gate(), false); assert.equal(holds, 1);
  }
});

test('paywall is recovery-only and even an injected local success cannot invoke onUnlocked', async () => {
  const source = await read('app/pocket/NativeSubscriptionPaywall.tsx');
  assert.doesNotMatch(source, /purchaseNativeSubscription|psAppleSubscribe|SUBSCRIBE FOR|CONTINUE TO GOOGLE PLAY|YOUR FREE ANALYSIS IS COMPLETE/);
  assert.match(source, /RESTORE PURCHASES/); assert.match(source, /Sign in to Pocket/); assert.match(source, /Contact support/);
  const start = source.indexOf('  async function restore()');
  const end = source.indexOf('  if (typeof document', start);
  const messages = []; let unlocked = 0, restores = 0;
  const restore = new Function('action', 'setAction', 'setMessage', 'restoreNativeSubscription', 'onUnlocked',
    stripTypeScriptTypes(source.slice(start, end)) + ';return restore;')(
      null, () => {}, message => messages.push(message), async () => { restores++; return raw; }, () => { unlocked++; });
  await restore(); assert.equal(restores, 1); assert.equal(unlocked, 0);
  assert.match(messages.at(-1), /cannot verify this Pocket account/);
  assert.doesNotMatch(messages.join(' '), /synthetic-private-token/);
});

test('actual registered Java purchase bridge is blocked and status/restore cannot emit grants or tokens (source review)', async () => {
  const source = await read('android/app/src/main/java/com/nashaimarkets/pocketbullseye/PocketPlayBillingPlugin.java');
  const start = source.indexOf('    public void purchase(');
  const end = source.indexOf('    @PluginMethod', start);
  const purchase = source.slice(start, end);
  assert.match(purchase, /call\.reject\(/);
  assert.doesNotMatch(purchase, /withBillingReady|queryExisting|launchBillingFlow|queryProduct/);
  const statusStart = source.indexOf('    private JSObject status(');
  const statusEnd = source.indexOf('    private String displayPrice(', statusStart);
  const status = source.slice(statusStart, statusEnd);
  assert.match(status, /put\("entitled", false\)/); assert.match(status, /put\("freeUseConsumed", true\)/);
  assert.match(status, /put\("purchaseFound"/); assert.match(status, /put\("pending"/);
  assert.doesNotMatch(status, /put\("purchaseToken"|put\("orderId"/);
  assert.doesNotMatch(source, /getDebugMessage\(|System\.out|System\.err|Log\.(d|e|i|v|w)\(/);
  assert.match(source, /public void restore\([\s\S]*?withBillingReady\(call, \(\) -> queryStatus\(call, productId\)\)/);
  const queryStart = source.indexOf('    private void queryStatus(');
  const queryEnd = source.indexOf('    private interface ProductResult', queryStart);
  assert.doesNotMatch(source.slice(queryStart, queryEnd), /acknowledgeAndResolve|acknowledgePurchase|launchBillingFlow/);
  const resumeStart = source.indexOf('    protected void handleOnResume(');
  const resumeEnd = source.indexOf('    @Override', resumeStart);
  assert.doesNotMatch(source.slice(resumeStart, resumeEnd), /billingClient\.|acknowledgePurchase/);
});
