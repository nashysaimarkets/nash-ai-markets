"use client";
import { Capacitor, registerPlugin } from "@capacitor/core";

export const APPLE_MONTHLY_PRODUCT_ID = "com.nashaimarkets.pocketbullseye.monthly";
export type AppleAccessStatus = { isNative: boolean; entitled: boolean; freeUseConsumed: boolean; productId: string; displayName: string; displayPrice: string; productAvailable?: boolean; signedTransactionInfo?: string };
type NativePlugin = {
  getStatus(options: { productId: string }): Promise<AppleAccessStatus>;
  purchase(options: { productId: string; appAccountToken: string }): Promise<AppleAccessStatus>;
  restore(options: { productId: string }): Promise<AppleAccessStatus>;
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
