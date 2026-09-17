import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";
import { createAppleActionCoordinator } from "./apple-purchase-flow";

export const APPLE_MONTHLY_PRODUCT_ID = "com.nashaimarkets.pocketbullseye.monthly";

export type AppleAccessStatus = {
  isNative: boolean;
  entitled: boolean;
  freeUseConsumed: boolean;
  productId: string;
  displayName: string;
  displayPrice: string;
  productAvailable?: boolean;
  currencyCode?: string;
  storefrontCountryCode?: string;
  isSandbox?: boolean;
  transactionId?: string;
  originalTransactionId?: string;
};

type AppleStoreKitPlugin = {
  addListener(event: "accessChanged", listener: (status: AppleAccessStatus) => void): Promise<PluginListenerHandle>;
  getStatus(options: { productId: string }): Promise<AppleAccessStatus>;
  purchase(options: { productId: string }): Promise<AppleAccessStatus>;
  restore(options: { productId: string }): Promise<AppleAccessStatus>;
  consumeFreeUse(): Promise<{ freeUseConsumed: boolean }>;
  recordSuccessfulAnalysis(): Promise<AppleReviewPromptStatus>;
  requestReviewIfEligible(): Promise<AppleReviewPromptStatus>;
};

export type AppleReviewPromptStatus = {
  successfulAnalysisCount: number;
  eligible: boolean;
  requested?: boolean;
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

export async function watchAppleAccess(listener: (status: AppleAccessStatus) => void): Promise<PluginListenerHandle | null> {
  if (!isAppleNativeApp()) return null;
  return NativeAppleStoreKit.addListener("accessChanged", listener);
}

const appleActions = createAppleActionCoordinator<AppleAccessStatus>({
  purchase: () => isAppleNativeApp() ? NativeAppleStoreKit.purchase({ productId: APPLE_MONTHLY_PRODUCT_ID }) : Promise.reject(new Error("Open the iPhone app to subscribe through Apple.")),
  restore: () => isAppleNativeApp() ? NativeAppleStoreKit.restore({ productId: APPLE_MONTHLY_PRODUCT_ID }) : Promise.reject(new Error("Open the iPhone app to restore Apple purchases.")),
});

export const pendingAppleAction = appleActions.pending;
export const purchaseAppleSubscription = () => appleActions.run("purchase");
export const restoreAppleSubscription = () => appleActions.run("restore");

export async function consumeAppleFreeUse(): Promise<void> {
  if (!isAppleNativeApp()) return;
  await NativeAppleStoreKit.consumeFreeUse();
}

export async function recordAppleSuccessfulAnalysis(): Promise<AppleReviewPromptStatus | null> {
  if (!isAppleNativeApp()) return null;
  return NativeAppleStoreKit.recordSuccessfulAnalysis();
}

export async function requestAppleReviewIfEligible(): Promise<AppleReviewPromptStatus | null> {
  if (!isAppleNativeApp()) return null;
  return NativeAppleStoreKit.requestReviewIfEligible();
}
