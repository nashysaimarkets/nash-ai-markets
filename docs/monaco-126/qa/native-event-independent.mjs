// Executes the actual React effect and pure view helper with synthetic native
// events. No browser, StoreKit, provider API, credentials or persistent state.
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const repo = resolve(process.argv[2] ?? '../monaco');
const expectSafe = process.argv[3] === '--expect-safe';
const { nativeSubscriptionView } = await import(pathToFileURL(resolve(repo, 'app/pocket/native-subscription-view.ts')));
const source = await readFile(resolve(repo, 'app/pocket/NativeSubscriptionControls.tsx'), 'utf8');
const marker = '  useEffect(() => {';
const start = source.indexOf(marker) + marker.length;
const end = ['  }, [attempt]);', '  }, [native, attempt]);']
  .map(marker => source.indexOf(marker, start)).find(index => index >= start) ?? -1;
assert.ok(start >= marker.length && end > start, 'actual recovery effect must exist');
const state = { status: null, phase: 'CHECKING', message: '' };
let emit;
const binding = {
  native: true, isAppleNativeApp: () => true, setNative: () => {}, mounted: { current: false }, revision: { current: 0 },
  setPhase: value => { state.phase = value; }, setMessage: value => { state.message = value; },
  setStatus: value => { state.status = value; },
  subscribeAppleAccessChanges: async callback => { emit = callback; return { remove: async () => {} }; },
  getAppleProductStatus: () => new Promise(() => {}), getAppleAccessStatus: () => new Promise(() => {}),
};
const cleanup = new Function(...Object.keys(binding), stripTypeScriptTypes('const mount=()=>{' + source.slice(start, end) + '\n};') + ';return mount();')(...Object.values(binding));
const known = { isNative: true, entitled: false, freeUseConsumed: true, productId: 'synthetic-existing-product', displayName: 'Pocket Monthly', displayPrice: '£4.99', productAvailable: true };
try {
  // The old bridge emits this cleared local value before remote verification.
  // New phases are optional so legacy one-argument listeners stay compatible.
  emit(known, 'VERIFYING');
  const pending = nativeSubscriptionView(state.status, state.phase);
  if (!expectSafe) {
    assert.equal(state.phase, 'READY'); assert.equal(pending.showPurchase, true);
    console.log(JSON.stringify({ result: 'REPRODUCED', phase: state.phase, showPurchase: pending.showPurchase, scope: 'actual effect/helper; synthetic pre-verification event; no native/API call' }));
  } else {
    assert.equal(pending.showPurchase, false, 'pre-verification native event cannot offer purchase');
    assert.notEqual(pending.heading, 'APPLE ACCESS VERIFIED');
    emit(known, 'ERROR');
    const failed = nativeSubscriptionView(state.status, state.phase);
    assert.equal(failed.showPurchase, false); assert.equal(failed.showRetry, true);
    emit({ ...known, entitled: true }, 'VERIFIED');
    const verified = nativeSubscriptionView(state.status, state.phase);
    assert.equal(verified.heading, 'APPLE ACCESS VERIFIED'); assert.equal(verified.showPurchase, false);
    emit(known);
    assert.equal(nativeSubscriptionView(state.status, state.phase).showPurchase, false, 'unknown/legacy event is held for verification');
    console.log(JSON.stringify({ result: 'PASS', pendingPurchaseHidden: true, failedCheckRetry: true, verifiedStateAccepted: true, unknownPhaseHeld: true, scope: 'actual effect/helper; synthetic events; no native/API call' }));
  }
} finally { cleanup(); }
