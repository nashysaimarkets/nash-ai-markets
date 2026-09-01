import { Capacitor, registerPlugin } from "@capacitor/core";

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
  return NativePlayBilling.getStatus({ productId: GOOGLE_MONTHLY_PRODUCT_ID });
}

export async function purchasePlaySubscription(): Promise<PlayAccessStatus> {
  if (!isGoogleNativeApp()) throw new Error("Google Play Billing is available only in the Android app.");
  return NativePlayBilling.purchase({ productId: GOOGLE_MONTHLY_PRODUCT_ID });
}

export async function restorePlaySubscription(): Promise<PlayAccessStatus> {
  if (!isGoogleNativeApp()) throw new Error("Google Play Billing is available only in the Android app.");
  return NativePlayBilling.restore({ productId: GOOGLE_MONTHLY_PRODUCT_ID });
}

export async function consumePlayFreeUse(): Promise<void> {
  if (!isGoogleNativeApp()) return;
  await NativePlayBilling.consumeFreeUse();
}
