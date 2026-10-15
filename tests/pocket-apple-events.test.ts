import assert from "node:assert/strict";
import test from "node:test";
import { verifyPocketAppleEvent } from "../app/lib/server/pocket-apple-events.ts";
const tx = { bundleId: "com.nashaimarkets.pocketbullseye", productId: "com.nashaimarkets.pocketbullseye.monthly", environment: "Sandbox", originalTransactionId: "10001", transactionId: "10002", type: "Auto-Renewable Subscription" };
const event = { notificationUUID: "83ed6b0b-1a45-43ec-bd05-15f074e35bcc", notificationType: "REFUND", signedDate: 1000, version: "2.0", data: { bundleId: tx.bundleId, environment: "Sandbox", signedTransactionInfo: "tx" } };
const deps = (notification = event, transaction = tx) => ({ environment: "Sandbox", appId: 123, verifyNotification: async () => notification, verifyTransaction: async () => transaction });
test("Apple events require verified outer and inner identities, produce only minimal audit records", async () => {
  const result = await verifyPocketAppleEvent("signed", deps());
  assert.equal(result.originalTransactionId, tx.originalTransactionId);
  assert.equal(result.type, "REFUND");
  assert.equal("signedTransactionInfo" in result, false);
  for (const change of [{ productId: "other" }, { bundleId: "other" }, { environment: "Production" }, { originalTransactionId: "" }]) await assert.rejects(() => verifyPocketAppleEvent("signed", deps(event, { ...tx, ...change })));
  for (const change of [{ notificationUUID: "" }, { signedDate: NaN }, { version: "1.0" }, { data: { ...event.data, bundleId: "other" } }]) await assert.rejects(() => verifyPocketAppleEvent("signed", deps({ ...event, ...change })));
});
test("signature failures, unsigned input and missing transaction never become entitlements", async () => {
  await assert.rejects(() => verifyPocketAppleEvent("", deps()));
  await assert.rejects(() => verifyPocketAppleEvent("signed", { ...deps(), verifyNotification: async () => { throw new Error("invalid signature"); } }));
  await assert.rejects(() => verifyPocketAppleEvent("signed", deps({ ...event, data: { ...event.data, signedTransactionInfo: "" } })));
});

test("signed Apple RENEWAL_EXTENSION SUMMARY is acknowledged for audit only", async () => {
  const summary = {
    notificationUUID: "83ed6b0b-1a45-43ec-bd05-15f074e35bcd",
    notificationType: "RENEWAL_EXTENSION", subtype: "SUMMARY",
    version: "2.0", signedDate: 2000,
    summary: {
      bundleId: tx.bundleId, productId: tx.productId, environment: "Sandbox",
      requestIdentifier: "ebd10108-625d-4998-8efb-742a9076e73a",
      succeededCount: 5, failedCount: 0,
    },
  };
  const verified = {
    environment: "Sandbox", appId: 123,
    verifyNotification: async () => summary,
    verifyTransaction: async () => { throw new Error("A SUMMARY must never verify a transaction or grant access"); },
  };
  const audit = await verifyPocketAppleEvent("signed-summary", verified);
  assert.equal(audit.type, "RENEWAL_EXTENSION");
  assert.equal(audit.subtype, "SUMMARY");
  assert.equal(audit.originalTransactionId, null);
  assert.equal("summary" in audit, false);
  for (const change of [
    {bundleId:"com.other"},
    {productId:"other"},
    {environment:"Production"},
  ]) {
    await assert.rejects(() => verifyPocketAppleEvent("signed-summary", {
      ...verified, verifyNotification: async () => ({...summary, summary:{...summary.summary,...change}}),
    }), /identity mismatch/i);
  }
  await assert.rejects(() => verifyPocketAppleEvent("signed-summary", {
    ...verified, verifyNotification: async () => ({...summary, subtype:"OTHER"}),
  }));
  await assert.rejects(() => verifyPocketAppleEvent("signed-summary", {
    ...verified, verifyNotification: async () => ({...summary, data:event.data}),
  }));
});
