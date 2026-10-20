"use client";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { App } from "@capacitor/app";
import type { PluginListenerHandle } from "@capacitor/core";

export const APPLE_MONTHLY_PRODUCT_ID = "com.nashaimarkets.pocketbullseye.monthly";
export type AppleAccessStatus = { isNative: boolean; entitled: boolean; freeUseConsumed: boolean; productId: string; displayName: string; displayPrice: string; productAvailable?: boolean; signedTransactionInfo?: string };
export type AppleAccessVerificationPhase = "VERIFYING" | "VERIFIED" | "ERROR";
type NativePlugin = {
  getStatus(options: { productId: string }): Promise<AppleAccessStatus>;
  purchase(options: { productId: string; appAccountToken: string }): Promise<AppleAccessStatus>;
  restore(options: { productId: string }): Promise<AppleAccessStatus>;
  addListener(event: "accessChanged", listener: (status: AppleAccessStatus) => void): Promise<PluginListenerHandle>;
};
const native = registerPlugin<NativePlugin>("PocketStoreKit");
export const isAppleNativeApp = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";
const webStatus: AppleAccessStatus = { isNative: false, entitled: false, freeUseConsumed: true, productId: APPLE_MONTHLY_PRODUCT_ID, displayName: "Pocket Bullseye Monthly", displayPrice: "" };

async function account(proof?: string) {
  const response = await fetch("/api/pocket/apple-account", { cache: "no-store", headers: proof ? { "x-pocket-apple-transaction": proof } : {} });
  const body = await response.json() as { appAccountToken?: string; entitled?: boolean; error?: string };
  if (!response.ok || !body.appAccountToken) throw new Error(body.error || "Sign in to verify your Pocket account.");
  return body;
}
async function verifyStatus(status: AppleAccessStatus): Promise<AppleAccessStatus> {
  // StoreKit's local entitled/free-use flags cannot authorize server analysis.
  const verified = await account(status.signedTransactionInfo);
  // Restore remains available during initialization. Its direct return must
  // not bypass the subscription bridge's unknown/background presentation hold.
  const currentAppState = await App.getState();
  if (currentAppState?.isActive !== true) throw new Error("Return to the app and retry the Apple access check.");
  return { ...status, entitled: verified.entitled === true };
}
export async function getAppleProductStatus(): Promise<AppleAccessStatus> {
  if (!isAppleNativeApp()) return webStatus;
  const status = await native.getStatus({ productId: APPLE_MONTHLY_PRODUCT_ID });
  return { ...status, entitled: false };
}
export async function getAppleAccessStatus(): Promise<AppleAccessStatus> {
  if (!isAppleNativeApp()) return webStatus;
  return verifyStatus(await native.getStatus({ productId: APPLE_MONTHLY_PRODUCT_ID }));
}
export async function purchaseAppleSubscription(): Promise<AppleAccessStatus> {
  if (!isAppleNativeApp()) throw new Error("Apple purchases are available in the iPhone app.");
  const identity = await account();
  return verifyStatus(await native.purchase({ productId: APPLE_MONTHLY_PRODUCT_ID, appAccountToken: identity.appAccountToken! }));
}
export async function restoreAppleSubscription(): Promise<AppleAccessStatus> {
  if (!isAppleNativeApp()) return webStatus;
  return verifyStatus(await native.restore({ productId: APPLE_MONTHLY_PRODUCT_ID }));
}

/** StoreKit events and foreground return immediately clear UI access, then
 * independently refresh server verification. Background work cannot restore
 * a previously verified badge before the current Pocket session is checked. */
export async function subscribeAppleAccessChanges(onStatus: (status: AppleAccessStatus, verification?: AppleAccessVerificationPhase) => void): Promise<PluginListenerHandle> {
  let revision = 0;
  let active = true;
  let foreground: boolean | null = null;
  let lifecycleEvents = 0;
  let latest: AppleAccessStatus = { ...webStatus, isNative: true };
  if (!isAppleNativeApp()) return { remove: async () => { active = false; } };
  const pending = () => onStatus({ ...latest, entitled: false }, "VERIFYING");
  const refresh = (read: () => Promise<AppleAccessStatus>) => {
    const current = ++revision;
    pending();
    void Promise.resolve().then(read).then(status => {
      if (!active || !foreground || current !== revision) return null;
      latest = status;
      return verifyStatus(status);
    }).then(verified => {
      if (verified && active && foreground && current === revision) onStatus(verified, "VERIFIED");
    }).catch(() => {
      if (active && foreground && current === revision) onStatus({ ...latest, entitled: false }, "ERROR");
    });
  };
  // The bridge owns foreground admission from the first synchronous callback.
  // This also supersedes the controls' parallel legacy initialization path.
  pending();
  const observeAppState = (state: { isActive: unknown }) => {
    if (!active) return;
    if (typeof state?.isActive !== "boolean") {
      foreground = null; revision++;
      onStatus({ ...latest, entitled: false }, "ERROR");
      return;
    }
    foreground = state.isActive;
    if (!foreground) { revision++; pending(); return; }
    // Expiry, cancellation and Pocket session changes need not emit a new
    // StoreKit transaction. Refresh both native evidence and server access.
    refresh(() => native.getStatus({ productId: APPLE_MONTHLY_PRODUCT_ID }));
  };
  const listener = await native.addListener("accessChanged", status => {
    if (!active) return;
    latest = status;
    if (!foreground) { revision++; pending(); return; }
    refresh(async () => status);
  });
  let appListener: PluginListenerHandle;
  try {
    appListener = await App.addListener("appStateChange", state => {
      if (!active) return;
      lifecycleEvents++;
      observeAppState(state);
    });
  } catch (error) {
    active = false; revision++;
    await listener.remove();
    throw error;
  }
  // appStateChange does not replay current state. An app already in the
  // background must remain unknown/held until this observation completes.
  // Any event since registration is newer authority than this initial snapshot.
  void Promise.resolve().then(() => App.getState()).then(state => {
    if (active && lifecycleEvents === 0) observeAppState(state);
  }).catch(() => {
    if (active && lifecycleEvents === 0) {
      foreground = null; revision++;
      onStatus({ ...latest, entitled: false }, "ERROR");
    }
  });
  return { remove: async () => {
    active = false; revision++;
    await Promise.all([listener.remove(), appListener.remove()]);
  } };
}

/** Every billed route rechecks this evidence server-side, including restoration,
 * expiration and revocation. No proof is cached in local storage or used alone.
 * A native web subscriber may omit Apple evidence and use the existing guard. */
export async function pocketAuthenticatedFetch(input: string, init: RequestInit = {}): Promise<Response> {
  init.signal?.throwIfAborted();
  if (!isAppleNativeApp()) return fetch(input, init);
  const status = await native.getStatus({ productId: APPLE_MONTHLY_PRODUCT_ID });
  init.signal?.throwIfAborted();
  const headers = new Headers(init.headers);
  if (status.signedTransactionInfo) headers.set("x-pocket-apple-transaction", status.signedTransactionInfo);
  return fetch(input, { ...init, headers });
}
