import type { AppleAccessStatus } from "./apple-storekit";

export type NativeSubscriptionPhase = "CHECKING" | "READY" | "ERROR";

/** Presentation only. Native access still requires the unchanged server proof. */
export function nativeSubscriptionView(status: AppleAccessStatus | null, phase: NativeSubscriptionPhase) {
  const productKnown = phase === "READY" && status?.isNative === true
    && status.productAvailable === true && Boolean(status.displayPrice.trim());
  return {
    heading: phase === "CHECKING" ? "CHECKING APPLE ACCESS" : phase === "ERROR" ? "APPLE ACCESS CHECK UNAVAILABLE"
      : status?.isNative && status.entitled ? "APPLE ACCESS VERIFIED" : "APPLE SUBSCRIPTION",
    productLabel: productKnown ? `${status!.displayName} · ${status!.displayPrice} per month` : null,
    showPurchase: Boolean(productKnown && !status?.entitled),
    showRetry: phase === "ERROR" || (phase === "READY" && !productKnown),
  };
}
