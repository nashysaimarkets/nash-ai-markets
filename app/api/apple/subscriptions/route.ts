import { NextResponse } from "next/server";
import { createAdminClient } from "../../../../utils/supabase/admin";
import { buildApplePocketSubscriptionAlertEmail } from "../../../lib/launch-email.ts";
import { APPLE_ROOT_CA_G3_PEM, isInitialAppleSubscription, verifyAppleSignedData, type AppleNotification, type AppleTransaction } from "../../../lib/server/apple-signed-data.ts";
import { dispatchLaunchEmail } from "../../../lib/server/resend-launch-email.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function requiredEnvironment() {
  const bundleId = process.env.APPLE_BUNDLE_ID?.trim() || "com.nashaimarkets.pocketbullseye";
  const productId = process.env.APPLE_POCKET_PRODUCT_ID?.trim() || "com.nashaimarkets.pocketbullseye.monthly";
  const additionalRoots = process.env.APPLE_ROOT_CA_PEM?.replace(/\\n/g, "\n").trim() ?? "";
  const rootPem = [APPLE_ROOT_CA_G3_PEM, additionalRoots].filter(Boolean).join("\n");
  return { bundleId, productId, rootPem };
}

function ownerEmail() {
  return process.env.BULLSEYE_ADMIN_EMAILS?.split(",").map((value) => value.trim().toLowerCase()).find(Boolean)
    || "hello@nashaimarkets.com";
}

function validId(value: unknown): value is string {
  return typeof value === "string" && value.length >= 3 && value.length <= 255;
}

export async function POST(request: Request) {
  let notification: AppleNotification;
  let transaction: AppleTransaction | null = null;
  let config: ReturnType<typeof requiredEnvironment>;
  try {
    config = requiredEnvironment();
    const body = await request.json() as { signedPayload?: unknown };
    if (typeof body.signedPayload !== "string" || body.signedPayload.length > 100_000) throw new Error("Invalid signed payload");
    notification = verifyAppleSignedData<AppleNotification>(body.signedPayload, config.rootPem);
    if (!validId(notification.notificationUUID) || notification.data?.bundleId !== config.bundleId) throw new Error("Apple notification identity mismatch");
    if (typeof notification.data.signedTransactionInfo === "string") {
      transaction = verifyAppleSignedData<AppleTransaction>(notification.data.signedTransactionInfo, config.rootPem);
      if (transaction.bundleId !== config.bundleId || transaction.environment !== notification.data.environment) {
        throw new Error("Apple transaction identity mismatch");
      }
    }
  } catch (error) {
    console.error("Apple subscription notification rejected", { category: "apple_subscription_verification_failure", message: error instanceof Error ? error.message : "unknown" });
    return NextResponse.json({ error: "Invalid Apple notification" }, { status: 400 });
  }

  const initialPocketPurchase = isInitialAppleSubscription(notification)
    && transaction?.productId === config.productId
    && validId(transaction.originalTransactionId)
    && validId(transaction.transactionId);
  const admin = createAdminClient();
  const event = {
    notification_uuid: notification.notificationUUID!,
    notification_type: notification.notificationType ?? "UNKNOWN",
    subtype: notification.subtype ?? null,
    environment: notification.data?.environment ?? transaction?.environment ?? "UNKNOWN",
    bundle_id: notification.data?.bundleId ?? transaction?.bundleId ?? config.bundleId,
    product_id: transaction?.productId ?? null,
    transaction_id: transaction?.transactionId ?? null,
    original_transaction_id: transaction?.originalTransactionId ?? null,
    app_account_token: transaction?.appAccountToken ?? null,
    purchase_date: transaction?.purchaseDate ? new Date(transaction.purchaseDate).toISOString() : null,
    expires_date: transaction?.expiresDate ? new Date(transaction.expiresDate).toISOString() : null,
    signed_date: notification.signedDate ? new Date(notification.signedDate).toISOString() : null,
    is_initial_purchase: initialPocketPurchase,
  };

  const { error: insertError } = await admin.from("apple_subscription_events").insert(event);
  if (insertError && insertError.code !== "23505") {
    console.error("Apple subscription event was not recorded", { category: "apple_subscription_storage_failure", code: insertError.code });
    return NextResponse.json({ error: "Event storage failed" }, { status: 500 });
  }

  if (initialPocketPurchase) {
    const { data: stored, error: lookupError } = await admin.from("apple_subscription_events")
      .select("owner_alert_sent_at")
      .eq("notification_uuid", notification.notificationUUID!)
      .single();
    if (lookupError) return NextResponse.json({ error: "Event lookup failed" }, { status: 500 });
    if (!stored.owner_alert_sent_at) {
      const result = await dispatchLaunchEmail({
        to: ownerEmail(),
        email: buildApplePocketSubscriptionAlertEmail({
          productId: transaction!.productId!,
          originalTransactionId: transaction!.originalTransactionId!,
          environment: event.environment,
          dashboardUrl: new URL("/admin/commercial", request.url).toString(),
        }),
        idempotencyKey: `apple-owner-alert:${notification.notificationUUID}`,
      });
      if (result.status !== "sent") {
        await admin.from("apple_subscription_events").update({ owner_alert_error: result.reason }).eq("notification_uuid", notification.notificationUUID!);
        return NextResponse.json({ error: "Owner alert failed" }, { status: 500 });
      }
      const { error: updateError } = await admin.from("apple_subscription_events").update({ owner_alert_sent_at: new Date().toISOString(), owner_alert_error: null }).eq("notification_uuid", notification.notificationUUID!);
      if (updateError) return NextResponse.json({ error: "Alert receipt failed" }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
