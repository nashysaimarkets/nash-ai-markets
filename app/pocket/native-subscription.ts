import { Capacitor } from "@capacitor/core";
import { APPLE_MONTHLY_PRODUCT_ID, getAppleAccessStatus, restoreAppleSubscription } from "./apple-storekit";
import { GOOGLE_MONTHLY_PRODUCT_ID, getPlayAccessStatus, restorePlaySubscription } from "./play-billing";
import { blockedNativeAccess, type NativeAccessStatus, type NativeStore } from "./native-subscription-policy";
export type { NativeAccessStatus, NativeStore } from "./native-subscription-policy";

export function nativeStore(): NativeStore {
  if (!Capacitor.isNativePlatform()) return "web";
  if (Capacitor.getPlatform() === "ios") return "apple";
  if (Capacitor.getPlatform() === "android") return "google";
  return "web";
}

export function isNativePocketApp() { return nativeStore() !== "web"; }

/** Store metadata and browser fallbacks cannot prove current-account admission.
 * This source HOLD has no credential, token, email or account-selection cache. */
export async function getNativeAccessStatus(): Promise<NativeAccessStatus> {
  const store = nativeStore();
  const metadata = store === "apple" ? await getAppleAccessStatus()
    : store === "google" ? await getPlayAccessStatus() : null;
  return blockedNativeAccess(metadata, store);
}

export async function purchaseNativeSubscription(): Promise<NativeAccessStatus> {
  throw new Error("Purchases are unavailable while Pocket account ownership verification is unresolved. Restore an existing purchase or contact support before purchasing again.");
}

/** Restore is available as recovery only and cannot unlock this branch. */
export async function restoreNativeSubscription(): Promise<NativeAccessStatus> {
  const store = nativeStore();
  const metadata = store === "apple" ? await restoreAppleSubscription()
    : store === "google" ? await restorePlaySubscription() : null;
  return blockedNativeAccess(metadata, store);
}

/** Compatibility no-op: first-free stays OFF; no device credit is reset. */
export async function consumeNativeFreeUse(): Promise<void> {}

export function nativeProductIdFor(store: NativeStore) {
  return store === "google" ? GOOGLE_MONTHLY_PRODUCT_ID : APPLE_MONTHLY_PRODUCT_ID;
}

