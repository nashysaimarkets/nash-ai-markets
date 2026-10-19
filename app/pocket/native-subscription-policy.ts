export type NativeStore = "apple" | "google" | "web";
export type NativeAccessStatus = {
  isNative: boolean; store: NativeStore; entitled: boolean; freeUseConsumed: boolean;
  productId: string; displayName: string; displayPrice: string;
  pending?: boolean; purchaseFound?: boolean; serverVerificationRequired?: true;
  // Legacy optional shapes remain source-compatible but are never emitted.
  transactionId?: string; originalTransactionId?: string; purchaseToken?: string; orderId?: string;
};

const label = (value: unknown, fallback: string) => typeof value === "string" && value.trim()
  ? value.trim().slice(0, 160) : fallback;

/** This historical branch has no compatible current-account admission route.
 * Store metadata is recovery information, never scanner authority, ownership
 * proof, device free-use credit or permission to offer a new purchase.
 * Lifting HOLD requires a separately reviewed guarded-backend integration. */
export function blockedNativeAccess(value: unknown, store: NativeStore): NativeAccessStatus {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    isNative: store !== "web", store, entitled: false, freeUseConsumed: true,
    productId: store === "google" ? "pocket_bullseye_monthly" : "com.nashaimarkets.pocketbullseye.monthly",
    displayName: label(source.displayName, "Pocket Bullseye Monthly"),
    displayPrice: label(source.displayPrice, ""),
    pending: source.pending === true, purchaseFound: source.purchaseFound === true,
    serverVerificationRequired: true,
  };
}
