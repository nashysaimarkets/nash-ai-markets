import { Capacitor, registerPlugin } from "@capacitor/core";

export const APPLE_MONTHLY_PRODUCT_ID = "com.nashaimarkets.pocketbullseye.monthly";

export type AppleAccessStatus = {
  isNative: boolean;
  entitled: boolean;
  freeUseConsumed: boolean;
  productId: string;
  displayName: string;
  displayPrice: string;
  transactionId?: string;
  originalTransactionId?: string;
};

type AppleStoreKitPlugin = {
  getStatus(options: { productId: string }): Promise<AppleAccessStatus>;
  purchase(options: { productId: string }): Promise<AppleAccessStatus>;
  restore(options: { productId: string }): Promise<AppleAccessStatus>;
  consumeFreeUse(): Promise<{ freeUseConsumed: boolean }>;
};

const NativeAppleStoreKit = registerPlugin<AppleStoreKitPlugin>("PocketStoreKit");

const webStatus: AppleAccessStatus = {
  isNative: false,
  entitled: true,
  freeUseConsumed: false,
  productId: APPLE_MONTHLY_PRODUCT_ID,
  displayName: "Pocket Bullseye Monthly",
  displayPrice: "£4.99",
};

export function isAppleNativeApp() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";
}

export async function getAppleAccessStatus(): Promise<AppleAccessStatus> {
  if (!isAppleNativeApp()) return webStatus;
  return NativeAppleStoreKit.getStatus({ productId: APPLE_MONTHLY_PRODUCT_ID });
}

export async function purchaseAppleSubscription(): Promise<AppleAccessStatus> {
  if (!isAppleNativeApp()) return webStatus;
  return NativeAppleStoreKit.purchase({ productId: APPLE_MONTHLY_PRODUCT_ID });
}

export async function restoreAppleSubscription(): Promise<AppleAccessStatus> {
  if (!isAppleNativeApp()) return webStatus;
  return NativeAppleStoreKit.restore({ productId: APPLE_MONTHLY_PRODUCT_ID });
}

export async function consumeAppleFreeUse(): Promise<void> {
  if (!isAppleNativeApp()) return;
  await NativeAppleStoreKit.consumeFreeUse();
}
