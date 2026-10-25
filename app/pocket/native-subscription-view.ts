import type { AppleAccessStatus } from "./apple-storekit";

export type NativeSubscriptionPhase = "CHECKING" | "READY" | "ERROR";

/** Presentation only. Native access still requires the unchanged server proof. */
export function nativeSubscriptionView(status: AppleAccessStatus | null, phase: NativeSubscriptionPhase) {
  const productKnown = phase === "READY" && status?.isNative === true
    && status.productAvailable === true && Boolean(status.displayPrice.trim());
  return {
    heading: phase === "CHECKING" ? "CHECKING APPLE ACCESS" : phase === "ERROR" ? "APPLE ACCESS CHECK UNAVAILABLE"
      : status?.isNative && status.entitled ? (status.accessSource === "web" ? "EXISTING SUBSCRIPTION VERIFIED" : "APPLE ACCESS VERIFIED") : "APPLE SUBSCRIPTION",
    productLabel: productKnown && status?.accessSource !== "web" ? `${status!.displayName} · ${status!.displayPrice} per month` : null,
    showPurchase: Boolean(productKnown && !status?.entitled && !status?.signedTransactionInfo),
    showRetry: phase === "ERROR" || (phase === "READY" && !productKnown),
  };
}
