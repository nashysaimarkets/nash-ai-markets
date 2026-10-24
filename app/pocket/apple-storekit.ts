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

/** Bounds read-only bridge metadata. Never wraps purchase/restore sheet operations. */
async function nativeMetadata<T>(pending: Promise<T>, late?: (value: T) => void): Promise<T> {
  let expired = false;
  let timer: ReturnType<typeof setTimeout>;
  try {
    return await new Promise<T>((resolve,reject) => {
      timer = setTimeout(() => { expired = true; reject(new Error("Apple metadata timed out.")); },10_000);
      pending.then(value => { if (expired) late?.(value); else resolve(value); },reject);
    });
  } finally { clearTimeout(timer!); }
}

async function account(proof?: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  const wait = <T,>(pending: Promise<T>): Promise<T> => new Promise((resolve, reject) => {
    const aborted = () => reject(new Error("Apple account verification timed out."));
    if (controller.signal.aborted) return aborted();
    controller.signal.addEventListener("abort", aborted, { once: true });
    pending.then(resolve, reject).finally(() => controller.signal.removeEventListener("abort", aborted));
  });
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try {
    if (proof !== undefined && (typeof proof !== "string" || proof.length > 24000 || /[\r\n\0]/.test(proof))) throw new Error("Invalid Apple account evidence.");
    const transport = fetch("/api/pocket/apple-account", {
      cache: "no-store", redirect: "error", credentials: "same-origin", signal: controller.signal,
      headers: proof ? { "x-pocket-apple-transaction": proof } : {},
    });
    void transport.then(response => { if (controller.signal.aborted) void response.body?.cancel().catch(() => {}); }, () => {});
    const response = await wait(transport);
    if (!response.ok || !response.body) throw new Error("Sign in to verify your Pocket account.");
    reader = response.body.getReader();
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) {
      const next = await wait(reader.read()); if (next.done) break;
      size += next.value.byteLength;
      if (size > 16384) throw new Error("Invalid Apple account response.");
      chunks.push(next.value);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    const body = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as { appAccountToken?: string; entitled?: boolean };
    if (!body || typeof body.appAccountToken !== "string" || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(body.appAccountToken) || typeof body.entitled !== "boolean") throw new Error("Invalid Apple account response.");
    return body;
  } finally {
    clearTimeout(timer); controller.abort();
    void reader?.cancel().catch(() => {});
  }
}
async function verifyStatus(status: AppleAccessStatus): Promise<AppleAccessStatus> {
  // StoreKit's local entitled/free-use flags cannot authorize server analysis.
  const verified = await account(status.signedTransactionInfo);
  // Restore remains available during initialization. Its direct return must
  // not bypass the subscription bridge's unknown/background presentation hold.
  const currentAppState = await nativeMetadata(App.getState());
  if (currentAppState?.isActive !== true) throw new Error("Return to the app and retry the Apple access check.");
  return { ...status, entitled: verified.entitled === true };
}
export async function getAppleProductStatus(): Promise<AppleAccessStatus> {
  if (!isAppleNativeApp()) return webStatus;
  const status = await nativeMetadata(native.getStatus({ productId: APPLE_MONTHLY_PRODUCT_ID }));
  return { ...status, entitled: false };
}
export async function getAppleAccessStatus(): Promise<AppleAccessStatus> {
  if (!isAppleNativeApp()) return webStatus;
  return verifyStatus(await nativeMetadata(native.getStatus({ productId: APPLE_MONTHLY_PRODUCT_ID })));
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
    void Promise.resolve().then(() => nativeMetadata(read())).then(status => {
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
  let listener: PluginListenerHandle;
  try { listener = await nativeMetadata(native.addListener("accessChanged", status => {
    if (!active) return;
    latest = status;
    if (!foreground) { revision++; pending(); return; }
    refresh(async () => status);
  }), handle => { void handle.remove().catch(() => {}); });
  } catch (error) { active = false; revision++; throw error; }
  let appListener: PluginListenerHandle;
  try {
    appListener = await nativeMetadata(App.addListener("appStateChange", state => {
      if (!active) return;
      lifecycleEvents++;
      observeAppState(state);
    }), handle => { void handle.remove().catch(() => {}); });
  } catch (error) {
    active = false; revision++;
    void listener.remove().catch(() => {});
    throw error;
  }
  // appStateChange does not replay current state. An app already in the
  // background must remain unknown/held until this observation completes.
  // Any event since registration is newer authority than this initial snapshot.
  void Promise.resolve().then(() => nativeMetadata(App.getState())).then(state => {
    if (active && lifecycleEvents === 0) observeAppState(state);
  }).catch(() => {
    if (active && lifecycleEvents === 0) {
      foreground = null; revision++;
      onStatus({ ...latest, entitled: false }, "ERROR");
    }
  });
  return { remove: async () => {
    active = false; revision++;
    await nativeMetadata(Promise.all([listener.remove(), appListener.remove()]));
  } };
}

/** Every billed route rechecks this evidence server-side, including restoration,
 * expiration and revocation. No proof is cached in local storage or used alone.
 * A native web subscriber may omit Apple evidence and use the existing guard. */
export async function pocketAuthenticatedFetch(input: string, init: RequestInit = {}): Promise<Response> {
  init.signal?.throwIfAborted();
  if (!isAppleNativeApp()) return fetch(input, init);
  // Native proof is private account evidence, not a general-purpose fetch header.
  // Resolve against a fixed sentinel so this boundary is also testable without DOM state.
  const target = new URL(input, "https://pocket-request.invalid");
  if (!input.startsWith("/api/pocket/") || input.includes("\\") || target.origin !== "https://pocket-request.invalid" ||
      target.hash || input.split("?")[0] !== target.pathname || !/^\/api\/pocket\/[a-z0-9/-]+$/i.test(target.pathname)) {
    throw new Error("Native account evidence requires a local Pocket API endpoint.");
  }
  const headers = new Headers(init.headers);
  headers.delete("x-pocket-apple-transaction");
  const options = { ...init, headers };
  // Some native bridges ignore AbortSignal; bound the wait and suppress late results.
  const controller = new AbortController();
  const cancel = () => controller.abort();
  options.signal?.addEventListener("abort", cancel, { once: true });
  const timer = setTimeout(cancel, 10_000);
  let status: AppleAccessStatus;
  try {
    status = await new Promise<AppleAccessStatus>((resolve, reject) => {
      const aborted = () => reject(new Error("Apple evidence check cancelled or timed out."));
      if (controller.signal.aborted || options.signal?.aborted) return aborted();
      controller.signal.addEventListener("abort", aborted, { once: true });
      native.getStatus({ productId: APPLE_MONTHLY_PRODUCT_ID }).then(resolve, reject)
        .finally(() => controller.signal.removeEventListener("abort", aborted));
    });
  } finally { clearTimeout(timer); options.signal?.removeEventListener("abort", cancel); }
  options.signal?.throwIfAborted();
  if (!status || (status.signedTransactionInfo !== undefined && (typeof status.signedTransactionInfo !== "string" || status.signedTransactionInfo.length > 24000 || /[\r\n\0]/.test(status.signedTransactionInfo)))) throw new Error("Invalid Apple account evidence.");
  if (status.signedTransactionInfo) headers.set("x-pocket-apple-transaction", status.signedTransactionInfo);
  // An API redirect must never forward signed evidence to another origin.
  return fetch(input, { ...options, redirect: "error", credentials: "same-origin" });
}
