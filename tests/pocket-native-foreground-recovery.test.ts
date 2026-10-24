import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import type { AppleAccessStatus, AppleAccessVerificationPhase } from "../app/pocket/apple-storekit.ts";

const product = "com.nashaimarkets.pocketbullseye.monthly";
const status: AppleAccessStatus = { isNative: true, entitled: true, freeUseConsumed: true, productId: product, displayName: "Pocket Bullseye Monthly", displayPrice: "£4.99", productAvailable: true, signedTransactionInfo: "signed-fixture" };
const flush = () => new Promise<void>(resolve => setImmediate(resolve));
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

async function actualForegroundBridge(options: {
  verify?: (value: AppleAccessStatus) => Promise<AppleAccessStatus>;
  readStatus?: () => Promise<AppleAccessStatus>;
  registrationError?: boolean;
  isNative?: boolean;
  appState?: () => Promise<{ isActive: boolean }>;
  registration?: Promise<void>;
} = {}) {
  const source = await readFile(new URL("../app/pocket/apple-storekit.ts", import.meta.url), "utf8");
  const start = source.indexOf("export async function subscribeAppleAccessChanges");
  const end = source.indexOf("/** Every billed route", start);
  assert.ok(start >= 0 && end > start, "exercise the actual exported native subscription bridge");
  let notify!: (value: AppleAccessStatus) => void;
  let lifecycle: ((value: { isActive: boolean }) => void) | null = null;
  const observations: Array<{ status: AppleAccessStatus; phase?: AppleAccessVerificationPhase }> = [];
  const state = { storeRemoved: 0, appRemoved: 0, reads: 0, verifies: [] as AppleAccessStatus[], registrations: 0, stateReads: 0 };
  const native = {
    addListener: async (_name: string, callback: typeof notify) => { notify = callback; state.registrations++; return { remove: async () => { state.storeRemoved++; } }; },
    getStatus: async () => { state.reads++; return options.readStatus ? options.readStatus() : status; },
  };
  const App = { getState: async () => { state.stateReads++; return options.appState ? options.appState() : { isActive: true }; }, addListener: async (_name: string, callback: NonNullable<typeof lifecycle>) => {
    if (options.registrationError) throw new Error("Lifecycle listener unavailable");
    await options.registration;
    lifecycle = callback; state.registrations++;
    return { remove: async () => { state.appRemoved++; } };
  } };
  const verifyStatus = async (value: AppleAccessStatus) => {
    state.verifies.push(value);
    return options.verify ? options.verify(value) : { ...value, entitled: false };
  };
  const code = stripTypeScriptTypes(source.slice(source.indexOf("async function nativeMetadata"), source.indexOf("async function account")) + source.slice(start, end).replace(/^export /, ""));
  const subscribe = new Function("native", "App", "verifyStatus", "isAppleNativeApp", "webStatus", "APPLE_MONTHLY_PRODUCT_ID", code + "\nreturn subscribeAppleAccessChanges;")(
    native, App, verifyStatus, () => options.isNative !== false, { ...status, isNative: false, entitled: false, signedTransactionInfo: undefined }, product,
  ) as (callback: (value: AppleAccessStatus, phase?: AppleAccessVerificationPhase) => void) => Promise<{ remove: () => Promise<void> }>;
  return {
    state, observations,
    subscribe: () => subscribe((value, phase) => observations.push({ status: value, phase })),
    emit: (value = status) => notify(value),
    lifecycle: (isActive: boolean) => { assert.ok(lifecycle, "native app lifecycle must be subscribed; otherwise a stale READY result survives resume"); lifecycle({ isActive }); },
  };
}

test("background invalidates in-flight verification and holds local access until foreground recheck", async () => {
  const verification = deferred<AppleAccessStatus>();
  const fixture = await actualForegroundBridge({ verify: () => verification.promise });
  const handle = await fixture.subscribe();
  fixture.emit();
  fixture.lifecycle(false);
  verification.resolve(status); await flush();
  assert.equal(fixture.observations.at(-1)?.phase, "VERIFYING");
  assert.equal(fixture.observations.at(-1)?.status.entitled, false);
  assert.equal(fixture.observations.filter(value => value.phase === "VERIFIED").length, 0);
  await handle.remove();
});

test("resume reads fresh native evidence and accepts only the current Pocket server result", async () => {
  const fresh = { ...status, signedTransactionInfo: "fresh-signed-fixture" };
  const fixture = await actualForegroundBridge({ readStatus: async () => fresh });
  const handle = await fixture.subscribe();
  fixture.lifecycle(false); fixture.lifecycle(true);
  assert.equal(fixture.observations.at(-1)?.phase, "VERIFYING");
  assert.equal(fixture.observations.at(-1)?.status.entitled, false);
  await flush();
  assert.equal(fixture.state.reads, 1);
  assert.equal(fixture.state.verifies[0], fresh);
  assert.equal(fixture.observations.at(-1)?.phase, "VERIFIED");
  assert.equal(fixture.observations.at(-1)?.status.entitled, false, "a cancelled/expired subscription or different session cannot reuse native entitlement");
  await handle.remove();
});

test("failed native resume checks expose ERROR rather than stale verified access", async () => {
  const fixture = await actualForegroundBridge({ readStatus: async () => { throw new Error("StoreKit offline"); } });
  const handle = await fixture.subscribe();
  fixture.lifecycle(false); fixture.lifecycle(true); await flush();
  assert.equal(fixture.observations.at(-1)?.phase, "ERROR");
  assert.equal(fixture.observations.at(-1)?.status.entitled, false);
  assert.equal(fixture.state.verifies.length, 0);
  await handle.remove();
});

test("a newer StoreKit event supersedes an older foreground snapshot", async () => {
  const read = deferred<AppleAccessStatus>();
  const fixture = await actualForegroundBridge({ readStatus: () => read.promise, verify: async value => ({ ...value, entitled: value.signedTransactionInfo === "latest" }) });
  const handle = await fixture.subscribe();
  fixture.lifecycle(false); fixture.lifecycle(true);
  fixture.emit({ ...status, signedTransactionInfo: "latest" }); await flush();
  assert.equal(fixture.observations.at(-1)?.status.entitled, true);
  const count = fixture.observations.length;
  read.resolve({ ...status, signedTransactionInfo: "obsolete" }); await flush();
  assert.equal(fixture.observations.length, count, "older foreground status cannot overwrite a newer subscription event");
  await handle.remove();
});

test("background StoreKit updates stay unverified and resume rechecks rather than publishing access", async () => {
  const fixture = await actualForegroundBridge();
  const handle = await fixture.subscribe();
  fixture.lifecycle(false); fixture.emit(); await flush();
  assert.equal(fixture.observations.at(-1)?.phase, "VERIFYING");
  assert.equal(fixture.observations.at(-1)?.status.entitled, false);
  assert.equal(fixture.state.verifies.length, 0);
  fixture.lifecycle(true); await flush();
  assert.equal(fixture.state.verifies.length, 1);
  await handle.remove();
});

test("teardown removes both native listeners and suppresses all late foreground results", async () => {
  const read = deferred<AppleAccessStatus>();
  const fixture = await actualForegroundBridge({ readStatus: () => read.promise });
  const handle = await fixture.subscribe();
  fixture.lifecycle(false); fixture.lifecycle(true);
  await handle.remove();
  const count = fixture.observations.length;
  read.resolve(status); await flush();
  fixture.lifecycle(true); fixture.emit(); await flush();
  assert.equal(fixture.observations.length, count);
  assert.equal(fixture.state.storeRemoved, 1);
  assert.equal(fixture.state.appRemoved, 1);
});

test("partial listener registration failure removes the registered StoreKit listener", async () => {
  const fixture = await actualForegroundBridge({ registrationError: true });
  await assert.rejects(fixture.subscribe(), /Lifecycle listener unavailable/);
  assert.equal(fixture.state.storeRemoved, 1);
  fixture.emit(); await flush();
  assert.equal(fixture.observations.filter(value => value.phase === "VERIFIED").length, 0);
});

test("web subscription controls never register native lifecycle or StoreKit listeners", async () => {
  const fixture = await actualForegroundBridge({ isNative: false });
  const handle = await fixture.subscribe();
  await handle.remove();
  assert.equal(fixture.state.registrations, 0);
  assert.equal(fixture.observations.length, 0);
});

test("initial background state holds StoreKit events until a real foreground transition", async () => {
  const fixture = await actualForegroundBridge({ appState: async () => ({ isActive: false }) });
  const handle = await fixture.subscribe();
  fixture.emit(); await flush();
  assert.equal(fixture.state.stateReads, 1);
  assert.equal(fixture.state.verifies.length, 0);
  assert.equal(fixture.observations.at(-1)?.phase, "VERIFYING");
  assert.equal(fixture.observations.at(-1)?.status.entitled, false);
  fixture.lifecycle(true); await flush();
  assert.equal(fixture.state.verifies.length, 1);
  await handle.remove();
});

test("backgrounding before lifecycle registration completes cannot be mistaken for an initial active app", async () => {
  const registration = deferred<void>();
  const fixture = await actualForegroundBridge({ registration: registration.promise, appState: async () => ({ isActive: false }) });
  const subscribing = fixture.subscribe(); await flush();
  fixture.emit(); await flush();
  assert.equal(fixture.state.verifies.length, 0, "foreground state is unknown until the post-registration snapshot");
  registration.resolve(); const handle = await subscribing; await flush();
  fixture.emit(); await flush();
  assert.equal(fixture.state.verifies.length, 0);
  assert.equal(fixture.state.stateReads, 1);
  await handle.remove();
});

test("a late active snapshot cannot overwrite a newer background event", async () => {
  const snapshot = deferred<{ isActive: boolean }>();
  const fixture = await actualForegroundBridge({ appState: () => snapshot.promise });
  const handle = await fixture.subscribe();
  fixture.lifecycle(false); snapshot.resolve({ isActive: true }); await flush();
  fixture.emit(); await flush();
  assert.equal(fixture.state.verifies.length, 0);
  assert.equal(fixture.observations.at(-1)?.phase, "VERIFYING");
  await handle.remove();
});

test("a late inactive snapshot cannot undo a newer foreground event or duplicate its status check", async () => {
  const snapshot = deferred<{ isActive: boolean }>();
  const fixture = await actualForegroundBridge({ appState: () => snapshot.promise, verify: async value => value });
  const handle = await fixture.subscribe();
  fixture.lifecycle(true); await flush();
  assert.equal(fixture.observations.at(-1)?.phase, "VERIFIED");
  snapshot.resolve({ isActive: false }); await flush();
  assert.equal(fixture.state.reads, 1);
  assert.equal(fixture.observations.at(-1)?.phase, "VERIFIED");
  await handle.remove();
});

test("initial app state rejection and malformed state expose recovery without verifying native access", async () => {
  for (const appState of [async () => { throw new Error("State unavailable"); }, async () => ({ isActive: undefined }) as unknown as { isActive: boolean }]) {
    const fixture = await actualForegroundBridge({ appState });
    const handle = await fixture.subscribe(); await flush();
    assert.equal(fixture.observations.at(-1)?.phase, "ERROR");
    assert.equal(fixture.observations.at(-1)?.status.entitled, false);
    assert.equal(fixture.state.verifies.length, 0);
    await handle.remove();
    assert.equal(fixture.state.storeRemoved, 1);
    assert.equal(fixture.state.appRemoved, 1);
  }
});

test("unmount during initial app state lookup prevents any later native read or presentation update", async () => {
  const snapshot = deferred<{ isActive: boolean }>();
  const fixture = await actualForegroundBridge({ appState: () => snapshot.promise });
  const handle = await fixture.subscribe();
  await handle.remove(); const count = fixture.observations.length;
  snapshot.resolve({ isActive: true }); await flush();
  assert.equal(fixture.observations.length, count);
  assert.equal(fixture.state.reads, 0);
  assert.equal(fixture.state.verifies.length, 0);
});

async function actualDirectVerification(appState: () => Promise<{ isActive: boolean }>, entitled = true) {
  const source = await readFile(new URL("../app/pocket/apple-storekit.ts", import.meta.url), "utf8");
  const start = source.indexOf("async function verifyStatus");
  const end = source.indexOf("export async function getAppleProductStatus", start);
  assert.ok(start >= 0 && end > start, "exercise the shared direct purchase/restore verification boundary");
  const code = stripTypeScriptTypes(source.slice(source.indexOf("async function nativeMetadata"), source.indexOf("async function account")) + source.slice(start, end));
  return new Function("account", "App", code + "\nreturn verifyStatus;")(async () => ({ entitled }), { getState: appState }) as (value: AppleAccessStatus) => Promise<AppleAccessStatus>;
}

test("direct purchase/restore results cannot publish access when the current app state is inactive, unknown or unavailable", async () => {
  for (const appState of [
    async () => ({ isActive: false }),
    async () => ({ isActive: undefined }) as unknown as { isActive: boolean },
    async () => { throw new Error("App state unavailable"); },
  ]) {
    const verify = await actualDirectVerification(appState);
    await assert.rejects(verify(status));
  }
});

test("direct active-app verification still trusts the current server entitlement rather than StoreKit local flags", async () => {
  const verify = await actualDirectVerification(async () => ({ isActive: true }), false);
  assert.equal((await verify(status)).entitled, false);
});
