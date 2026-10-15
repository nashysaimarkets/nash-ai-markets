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
  const data = event.data;
  if (!/^[0-9a-f-]{36}$/i.test(event.notificationUUID ?? "") || event.version !== "2.0"
    || !Number.isSafeInteger(event.signedDate) || event.signedDate! <= 0
    || !event.notificationType || !data || data.bundleId !== POCKET_APPLE_BUNDLE_ID
    || data.environment !== deps.environment || (deps.environment === "Production" && data.appAppleId !== deps.appId)) throw new Error("Apple event identity mismatch");
  let originalTransactionId: string | null = null;
  if (data.signedTransactionInfo) {
    const transaction = await deps.verifyTransaction(data.signedTransactionInfo);
    if (transaction.bundleId !== POCKET_APPLE_BUNDLE_ID || transaction.productId !== POCKET_APPLE_PRODUCT_ID
      || transaction.environment !== deps.environment || transaction.type !== "Auto-Renewable Subscription"
      || !transaction.originalTransactionId || !transaction.transactionId) throw new Error("Apple event transaction mismatch");
    originalTransactionId = transaction.originalTransactionId;
  } else if (event.notificationType !== "TEST") throw new Error("Apple event missing signed transaction");
  return { id: event.notificationUUID!, environment: deps.environment, type: event.notificationType,
    subtype: event.subtype ?? null, signedDate: event.signedDate!, originalTransactionId,
    digest: createHash("sha256").update(proof).digest("hex") };
}
