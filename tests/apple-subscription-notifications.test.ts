import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildApplePocketSubscriptionAlertEmail } from "../app/lib/launch-email.ts";
import { isInitialAppleSubscription, verifyAppleSignedData } from "../app/lib/server/apple-signed-data.ts";

test("only Apple's initial subscription event qualifies as a new subscriber", () => {
  assert.equal(isInitialAppleSubscription({ notificationType: "SUBSCRIBED", subtype: "INITIAL_BUY" }), true);
  assert.equal(isInitialAppleSubscription({ notificationType: "DID_RENEW", subtype: "" }), false);
  assert.equal(isInitialAppleSubscription({ notificationType: "SUBSCRIBED", subtype: "RESUBSCRIBE" }), false);
});

test("malformed or unsigned Apple payloads are rejected", () => {
  assert.throws(() => verifyAppleSignedData("not-a-jws", "not-a-certificate"), /Invalid Apple JWS/);
});

test("Apple owner alert contains a safe transaction reference without claiming an email address", () => {
  const email = buildApplePocketSubscriptionAlertEmail({
    productId: "pocket.monthly",
    originalTransactionId: "2000000000000000",
    environment: "Production",
    dashboardUrl: "https://example.test/admin/commercial",
  });
  assert.match(email.subject, /App Store subscription/);
  assert.match(email.text, /2000000000000000/);
  assert.match(email.text, /does not include the subscriber's email address/);
});

test("Apple webhook verifies nested signed data, deduplicates events and alerts only initial buys", async () => {
  const route = await readFile(new URL("../app/api/apple/subscriptions/route.ts", import.meta.url), "utf8");
  const migration = await readFile(new URL("../supabase/migrations/20260918195717_apple_subscription_events.sql", import.meta.url), "utf8");
  assert.match(route, /verifyAppleSignedData<AppleNotification>/);
  assert.match(route, /verifyAppleSignedData<AppleTransaction>/);
  assert.match(route, /isInitialAppleSubscription/);
  assert.match(route, /insertError\.code !== "23505"/);
  assert.match(route, /apple-owner-alert:/);
  assert.match(migration, /notification_uuid text primary key/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /revoke all .* anon, authenticated/);
});
