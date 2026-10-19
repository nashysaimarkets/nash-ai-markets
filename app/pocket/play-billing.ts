import { Capacitor, registerPlugin } from "@capacitor/core";
import { blockedNativeAccess } from "./native-subscription-policy";

export const GOOGLE_MONTHLY_PRODUCT_ID = "pocket_bullseye_monthly";

export type PlayAccessStatus = {
  isNative: boolean;
  entitled: boolean;
  freeUseConsumed: boolean;
  productId: string;
  displayName: string;
  displayPrice: string;
  purchaseToken?: string;
  orderId?: string;
  pending?: boolean;
};

type PlayBillingPlugin = {
  getStatus(options: { productId: string }): Promise<PlayAccessStatus>;
  purchase(options: { productId: string }): Promise<PlayAccessStatus>;
  restore(options: { productId: string }): Promise<PlayAccessStatus>;
  consumeFreeUse(): Promise<{ freeUseConsumed: boolean }>;
};

const NativePlayBilling = registerPlugin<PlayBillingPlugin>("PocketPlayBilling");

export function isGoogleNativeApp() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

export async function getPlayAccessStatus(): Promise<PlayAccessStatus> {
  if (!isGoogleNativeApp()) throw new Error("Google Play Billing is available only in the Android app.");
  return blockedNativeAccess(await NativePlayBilling.getStatus({ productId: GOOGLE_MONTHLY_PRODUCT_ID }), "google");
}

export async function purchasePlaySubscription(): Promise<PlayAccessStatus> {
  throw new Error("Google Play purchases are unavailable until Pocket can verify current-account ownership. Restore an existing purchase or contact support before purchasing again.");
}

export async function restorePlaySubscription(): Promise<PlayAccessStatus> {
  if (!isGoogleNativeApp()) throw new Error("Google Play Billing is available only in the Android app.");
  return blockedNativeAccess(await NativePlayBilling.restore({ productId: GOOGLE_MONTHLY_PRODUCT_ID }), "google");
}

export async function consumePlayFreeUse(): Promise<void> {
  // First-free remains OFF. Device preferences cannot authorize or reset use.
}

