import { Capacitor } from "@capacitor/core";
import {
  APPLE_MONTHLY_PRODUCT_ID,
  consumeAppleFreeUse,
  getAppleAccessStatus,
  purchaseAppleSubscription,
  restoreAppleSubscription,
} from "./apple-storekit";
import {
  GOOGLE_MONTHLY_PRODUCT_ID,
  consumePlayFreeUse,
  getPlayAccessStatus,
  purchasePlaySubscription,
  restorePlaySubscription,
} from "./play-billing";

export type NativeStore = "apple" | "google" | "web";

export type NativeAccessStatus = {
  isNative: boolean;
  store: NativeStore;
  entitled: boolean;
  freeUseConsumed: boolean;
  productId: string;
  displayName: string;
  displayPrice: string;
  transactionId?: string;
  originalTransactionId?: string;
  purchaseToken?: string;
  orderId?: string;
  pending?: boolean;
};

const webStatus: NativeAccessStatus = {
  isNative: false,
  store: "web",
  entitled: true,
  freeUseConsumed: false,
  productId: APPLE_MONTHLY_PRODUCT_ID,
  displayName: "Pocket Bullseye Monthly",
  displayPrice: "£4.99",
};

export function nativeStore(): NativeStore {
  if (!Capacitor.isNativePlatform()) return "web";
  if (Capacitor.getPlatform() === "ios") return "apple";
  if (Capacitor.getPlatform() === "android") return "google";
  return "web";
}

export function isNativePocketApp() {
  return nativeStore() !== "web";
}

export async function getNativeAccessStatus(): Promise<NativeAccessStatus> {
  const store = nativeStore();
  if (store === "apple") return { ...(await getAppleAccessStatus()), store };
  if (store === "google") return { ...(await getPlayAccessStatus()), store };
  return webStatus;
}

export async function purchaseNativeSubscription(): Promise<NativeAccessStatus> {
  const store = nativeStore();
  if (store === "apple") return { ...(await purchaseAppleSubscription()), store };
  if (store === "google") return { ...(await purchasePlaySubscription()), store };
  return webStatus;
}

export async function restoreNativeSubscription(): Promise<NativeAccessStatus> {
  const store = nativeStore();
  if (store === "apple") return { ...(await restoreAppleSubscription()), store };
  if (store === "google") return { ...(await restorePlaySubscription()), store };
  return webStatus;
}

export async function consumeNativeFreeUse(): Promise<void> {
  const store = nativeStore();
  if (store === "apple") await consumeAppleFreeUse();
  if (store === "google") await consumePlayFreeUse();
}

export function nativeProductIdFor(store: NativeStore) {
  return store === "google" ? GOOGLE_MONTHLY_PRODUCT_ID : APPLE_MONTHLY_PRODUCT_ID;
}
