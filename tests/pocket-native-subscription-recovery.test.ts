import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import { nativeSubscriptionView, type NativeSubscriptionPhase } from "../app/pocket/native-subscription-view.ts";
import type { AppleAccessStatus, AppleAccessVerificationPhase } from "../app/pocket/apple-storekit.ts";

const known: AppleAccessStatus = { isNative: true, entitled: false, freeUseConsumed: true, productId: "existing-product", displayName: "Pocket Bullseye Monthly", displayPrice: "£4.99", productAvailable: true };

test("native initialization failure has visible recovery without a price or purchase offer", () => {
  const failed = nativeSubscriptionView(null, "ERROR");
  assert.equal(failed.heading, "APPLE ACCESS CHECK UNAVAILABLE");
  assert.equal(failed.showRetry, true);
  assert.equal(failed.showPurchase, false);
  assert.equal(failed.productLabel, null);
});

test("cached product data cannot offer a purchase during loading or failed account verification", () => {
  for (const phase of ["CHECKING", "ERROR"] as const) {
    const view = nativeSubscriptionView(known, phase);
    assert.equal(view.showPurchase, false);
    assert.equal(view.productLabel, null);
    assert.notEqual(view.heading, "APPLE ACCESS VERIFIED");
  }
});

test("ready Apple products keep existing price and entitlement behavior without a web purchase fallback", () => {
  assert.equal(nativeSubscriptionView(known, "READY").showPurchase, true);
  assert.match(nativeSubscriptionView(known, "READY").productLabel!, /£4\.99 per month/);
  const entitled = nativeSubscriptionView({ ...known, entitled: true }, "READY");
  assert.equal(entitled.heading, "APPLE ACCESS VERIFIED");
  assert.equal(entitled.showPurchase, false);
  for (const status of [null, { ...known, productAvailable: false }, { ...known, productAvailable: undefined }, { ...known, displayPrice: "" }, { ...known, isNative: false }]) {
    const view = nativeSubscriptionView(status, "READY");
    assert.equal(view.showPurchase, false);
    assert.equal(view.productLabel, null);
    assert.equal(view.showRetry, true);
  }
});

type AccessCallback = (next: AppleAccessStatus, verification?: AppleAccessVerificationPhase) => void;
async function mountRecovery(options: { product: Promise<AppleAccessStatus>; access?: () => Promise<AppleAccessStatus>; subscribe?: (callback: AccessCallback) => Promise<{ remove: () => Promise<void> }> }) {
  const source = await readFile(new URL("../app/pocket/NativeSubscriptionControls.tsx", import.meta.url), "utf8");
  const marker = "  useEffect(() => {";
  const start = source.indexOf(marker) + marker.length;
  const end = source.indexOf("  }, [native, attempt]);", start);
  assert.ok(start >= marker.length && end > start, "the actual native recovery effect must be present");
  const state = { native: true as boolean | null, phase: "CHECKING" as NativeSubscriptionPhase, message: "", status: null as AppleAccessStatus | null, removed: 0, writes: 0 };
  let notify: AccessCallback | undefined;
  const bindings = {
    native: true,
    mounted: { current: false }, revision: { current: 0 },
    setPhase: (value: NativeSubscriptionPhase) => { state.phase = value; state.writes++; },
    setMessage: (value: string) => { state.message = value; state.writes++; },
    setStatus: (value: AppleAccessStatus) => { state.status = value; state.writes++; },
    subscribeAppleAccessChanges: options.subscribe ?? (async (callback: AccessCallback) => { notify = callback; return { remove: async () => { state.removed++; } }; }),
    getAppleProductStatus: () => options.product,
    getAppleAccessStatus: options.access ?? (async () => ({ ...known, entitled: true })),
  };
  const effect = stripTypeScriptTypes("const mount = () => {" + source.slice(start, end) + "\n};");
  const cleanup = new Function(...Object.keys(bindings), effect + "\nreturn mount();")(...Object.values(bindings)) as () => void;
  return { state, notify: (value: AppleAccessStatus, verification?: AppleAccessVerificationPhase) => notify!(value, verification), cleanup };
}

const flush = () => new Promise<void>(resolve => setImmediate(resolve));

test("actual native product rejection leaves a native error state instead of the empty web state", async () => {
  let reject!: (reason: Error) => void;
  const product = new Promise<AppleAccessStatus>((_resolve, fail) => { reject = fail; });
  const fixture = await mountRecovery({ product });
  reject(new Error("StoreKit product unavailable"));
  await flush();
  assert.equal(fixture.state.native, true);
  assert.equal(fixture.state.phase, "ERROR");
  assert.equal(fixture.state.status, null);
  assert.equal(fixture.state.message, "StoreKit product unavailable");
  assert.equal(nativeSubscriptionView(fixture.state.status, fixture.state.phase).showRetry, true);
  fixture.cleanup(); await flush();
  assert.equal(fixture.state.removed, 1);
});

test("late initialization failure cannot overwrite a newer verified subscription update", async () => {
  let reject!: (reason: Error) => void;
  const product = new Promise<AppleAccessStatus>((_resolve, fail) => { reject = fail; });
  const fixture = await mountRecovery({ product });
  fixture.notify({ ...known, entitled: true }, "VERIFIED");
  reject(new Error("stale initialization error")); await flush();
  assert.equal(fixture.state.phase, "READY");
  assert.equal(fixture.state.status?.entitled, true);
  assert.equal(fixture.state.message, "");
  fixture.cleanup();
});

test("failed account verification hides an otherwise known product purchase and unmount suppresses late failures", async () => {
  const denied = await mountRecovery({ product: Promise.resolve(known), access: async () => { throw new Error("Pocket account verification unavailable"); } });
  await flush();
  assert.equal(denied.state.phase, "ERROR");
  assert.equal(nativeSubscriptionView(denied.state.status, denied.state.phase).showPurchase, false);
  denied.cleanup();

  let reject!: (reason: Error) => void;
  const product = new Promise<AppleAccessStatus>((_resolve, fail) => { reject = fail; });
  const removed = await mountRecovery({ product });
  removed.cleanup(); const writes = removed.state.writes;
  reject(new Error("late failure after leaving the app")); await flush();
  assert.equal(removed.state.writes, writes);
});

async function actualBridge(verifyStatus: (status: AppleAccessStatus) => Promise<AppleAccessStatus>) {
  const source = await readFile(new URL("../app/pocket/apple-storekit.ts", import.meta.url), "utf8");
  const start = source.indexOf("export async function subscribeAppleAccessChanges");
  const end = source.indexOf("/** Every billed route", start);
  assert.ok(start >= 0 && end > start, "the actual event bridge must be present");
  let emit!: (status: AppleAccessStatus) => void;
  const native = { addListener: async (_event: string, callback: (status: AppleAccessStatus) => void) => { emit = callback; return { remove: async () => {} }; } };
  const code = stripTypeScriptTypes(source.slice(start, end).replace(/^export /, ""));
  const subscribe = new Function("native", "App", "verifyStatus", "isAppleNativeApp", "webStatus", "APPLE_MONTHLY_PRODUCT_ID", code + "\nreturn subscribeAppleAccessChanges;")(native, { addListener: async () => ({ remove: async () => {} }) }, verifyStatus, () => true, { ...known, isNative: false }, known.productId) as NonNullable<Parameters<typeof mountRecovery>[0]["subscribe"]>;
  return { subscribe, emit: (status: AppleAccessStatus) => emit(status) };
}

test("actual bridge pending → rejection keeps local entitlement cleared and exposes recovery without purchase", async () => {
  let reject!: (reason: Error) => void;
  const verification = new Promise<AppleAccessStatus>((_resolve, fail) => { reject = fail; });
  const bridge = await actualBridge(() => verification);
  const fixture = await mountRecovery({ product: new Promise(() => {}), subscribe: bridge.subscribe });
  bridge.emit({ ...known, entitled: true });
  assert.equal(fixture.state.phase, "CHECKING");
  assert.equal(fixture.state.status?.entitled, false);
  assert.equal(nativeSubscriptionView(fixture.state.status, fixture.state.phase).showPurchase, false);
  reject(new Error("server verification unavailable")); await flush();
  assert.equal(fixture.state.phase, "ERROR");
  assert.equal(fixture.state.status?.entitled, false);
  const view = nativeSubscriptionView(fixture.state.status, fixture.state.phase);
  assert.equal(view.showPurchase, false); assert.equal(view.showRetry, true);
  assert.match(fixture.state.message, /Contact support before purchasing again/);
  fixture.cleanup();
});

test("actual bridge pending → verified accepts only the server result and ignores an obsolete verification", async () => {
  const resolves: Array<(value: AppleAccessStatus) => void> = [];
  const bridge = await actualBridge(() => new Promise(resolve => resolves.push(resolve)));
  const fixture = await mountRecovery({ product: new Promise(() => {}), subscribe: bridge.subscribe });
  bridge.emit({ ...known, entitled: true }); await flush();
  bridge.emit({ ...known, entitled: true }); await flush();
  resolves[0]({ ...known, entitled: true }); await flush();
  assert.equal(fixture.state.phase, "CHECKING", "an earlier event cannot finish the current verification");
  assert.equal(fixture.state.status?.entitled, false);
  resolves[1]({ ...known, entitled: true }); await flush();
  assert.equal(fixture.state.phase, "READY");
  assert.equal(fixture.state.status?.entitled, true);
  assert.equal(nativeSubscriptionView(fixture.state.status, fixture.state.phase).heading, "APPLE ACCESS VERIFIED");
  assert.equal(nativeSubscriptionView(fixture.state.status, fixture.state.phase).showPurchase, false);
  fixture.cleanup();
});

test("an unmarked legacy event remains unverified and cannot reopen a purchase offer", async () => {
  const fixture = await mountRecovery({ product: new Promise(() => {}) });
  fixture.notify({ ...known, entitled: true });
  assert.equal(fixture.state.phase, "CHECKING");
  assert.equal(fixture.state.status?.entitled, false);
  assert.equal(nativeSubscriptionView(fixture.state.status, fixture.state.phase).showPurchase, false);
  fixture.cleanup();
});

test("failed native listener registration holds access and rejects a later successful initialization", async () => {
  let resolve!: (value: AppleAccessStatus) => void;
  const product = new Promise<AppleAccessStatus>(done => { resolve = done; });
  let accessChecks = 0;
  const fixture = await mountRecovery({
    product,
    access: async () => { accessChecks++; return { ...known, entitled: true }; },
    subscribe: async () => { throw new Error("Native lifecycle updates unavailable"); },
  });
  await flush();
  assert.equal(fixture.state.phase, "ERROR");
  assert.equal(fixture.state.status, null);
  assert.equal(nativeSubscriptionView(fixture.state.status, fixture.state.phase).showPurchase, false);
  assert.equal(nativeSubscriptionView(fixture.state.status, fixture.state.phase).showRetry, true);
  resolve(known); await flush();
  assert.equal(fixture.state.phase, "ERROR", "a listenerless initialization cannot restore a stale verified badge or purchase offer");
  assert.equal(fixture.state.status, null);
  assert.equal(accessChecks, 0, "superseded product initialization must not start another account check");
  fixture.cleanup();
});

test("listener registration failure after a verified initialization clears the existing access presentation", async () => {
  let reject!: (error: Error) => void;
  const registration = new Promise<{ remove: () => Promise<void> }>((_resolve, fail) => { reject = fail; });
  const fixture = await mountRecovery({ product: Promise.resolve(known), subscribe: () => registration });
  await flush();
  assert.equal(fixture.state.phase, "READY");
  assert.equal(fixture.state.status?.entitled, true);
  reject(new Error("Native updates registration failed late")); await flush();
  assert.equal(fixture.state.phase, "ERROR");
  assert.equal(fixture.state.status, null);
  assert.equal(nativeSubscriptionView(fixture.state.status, fixture.state.phase).showPurchase, false);
  fixture.cleanup();
});
