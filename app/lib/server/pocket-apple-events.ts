import { createHash } from "node:crypto";
import type { JWSTransactionDecodedPayload, ResponseBodyV2DecodedPayload } from "@apple/app-store-server-library";
import { POCKET_APPLE_BUNDLE_ID, POCKET_APPLE_PRODUCT_ID } from "./pocket-apple-access.ts";
export type AppleEventDependencies = {
  environment: string; appId: number;
  verifyNotification: (proof: string) => Promise<ResponseBodyV2DecodedPayload>;
  verifyTransaction: (proof: string) => Promise<JWSTransactionDecodedPayload>;
};
/** Verified event history is an audit trail, never a cached entitlement grant.
 * All scans still fetch current independently signed Apple statuses. */
export async function verifyPocketAppleEvent(proof: string, deps: AppleEventDependencies) {
  if (!proof || proof.length > 64000) throw new Error("Invalid Apple notification");
  const event = await deps.verifyNotification(proof);
  const summaryOnly = event.notificationType === "RENEWAL_EXTENSION" && event.subtype === "SUMMARY";
  // Apple V2 SUMMARY is signed by the notification verifier, but has summary
  // rather than data and no per-customer signed transaction to grant access.
  const data = event.data;
  const summary = summaryOnly ? event.summary : undefined;
  const identity = summaryOnly ? summary : data;
  if (!/^[0-9a-f-]{36}$/i.test(event.notificationUUID ?? "") || event.version !== "2.0"
    || !Number.isSafeInteger(event.signedDate) || event.signedDate! <= 0
    || !event.notificationType || !identity || (summaryOnly && !!data) || (!summaryOnly && !!event.summary)
    || identity.bundleId !== POCKET_APPLE_BUNDLE_ID
    || identity.environment !== deps.environment
    || (deps.environment === "Production" && identity.appAppleId !== deps.appId)
    || (summaryOnly && summary?.productId !== POCKET_APPLE_PRODUCT_ID)) throw new Error("Apple event identity mismatch");
  let originalTransactionId: string | null = null;
  if (data?.signedTransactionInfo) {
    const transaction = await deps.verifyTransaction(data.signedTransactionInfo);
    if (transaction.bundleId !== POCKET_APPLE_BUNDLE_ID || transaction.productId !== POCKET_APPLE_PRODUCT_ID
      || transaction.environment !== deps.environment || transaction.type !== "Auto-Renewable Subscription"
      || !transaction.originalTransactionId || !transaction.transactionId) throw new Error("Apple event transaction mismatch");
    originalTransactionId = transaction.originalTransactionId;
  } else if (!summaryOnly && event.notificationType !== "TEST") throw new Error("Apple event missing signed transaction");
  return { id: event.notificationUUID!, environment: deps.environment, type: event.notificationType,
    subtype: event.subtype ?? null, signedDate: event.signedDate!, originalTransactionId,
    digest: createHash("sha256").update(proof).digest("hex") };
}
