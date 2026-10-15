import assert from "node:assert/strict";
import test from "node:test";
import { verifyPocketAppleAccess } from "../app/lib/server/pocket-apple-access.ts";

const userId = "7a9d6268-93d5-43ec-bd05-15f074e35bcc";
const transaction = { bundleId: "com.nashaimarkets.pocketbullseye", productId: "com.nashaimarkets.pocketbullseye.monthly", environment: "Sandbox", appAccountToken: userId, originalTransactionId: "10001", transactionId: "10002", type: "Auto-Renewable Subscription", expiresDate: 2000 };
const deps = (overrides = {}) => ({ environment: "Sandbox", now: () => 1000, verifyTransaction: async () => transaction, verifyRenewal: async () => ({ originalTransactionId: "10001", environment: "Sandbox", productId: transaction.productId, gracePeriodExpiresDate: 2000 }), getStatuses: async () => ({ bundleId: transaction.bundleId, environment: "Sandbox", data: [{ lastTransactions: [{ status: 1, originalTransactionId: "10001", signedTransactionInfo: "fresh" }] }] }), ...overrides });

test("Apple access requires signed proof bound to the authenticated account and current Apple status", async () => {
  assert.equal(await verifyPocketAppleAccess(userId, "proof", deps()), true);
  for (const change of [{ appAccountToken: undefined }, { appAccountToken: "another-user" }, { productId: "another-product" }, { bundleId: "another-app" }, { environment: "Production" }, { revocationDate: 500 }, { isUpgraded: true }, { type: "Consumable" }, { originalTransactionId: undefined }]) {
    let calls = 0;
    assert.equal(await verifyPocketAppleAccess(userId, "proof", deps({ verifyTransaction: async () => ({ ...transaction, ...change }), getStatuses: async () => { calls++; throw new Error("must not refresh unbound proof"); } })), false);
    assert.equal(calls, 0);
  }
});
test("expired/refunded/retry/unknown status and missing signed current evidence deny replay", async () => {
  for (const status of [2, 3, 5, 0, undefined]) assert.equal(await verifyPocketAppleAccess(userId, "old", deps({ getStatuses: async () => ({ bundleId: transaction.bundleId, environment: "Sandbox", data: [{ lastTransactions: [{ status, originalTransactionId: "10001", signedTransactionInfo: "fresh" }] }] }) })), false);
  for (const change of [{ expiresDate: 999 }, { expiresDate: NaN }, { expiresDate: undefined }, { appAccountToken: "other" }, { originalTransactionId: "other" }, { revocationDate: 900 }]) {
    assert.equal(await verifyPocketAppleAccess(userId, "old", deps({ verifyTransaction: async (jws: string) => jws === "old" ? transaction : ({ ...transaction, ...change }) })), false);
  }
});
test("grace requires independently verified matching unexpired renewal evidence", async () => {
  const statuses = { bundleId: transaction.bundleId, environment: "Sandbox", data: [{ lastTransactions: [{ status: 4, originalTransactionId: "10001", signedTransactionInfo: "fresh", signedRenewalInfo: "renewal" }] }] };
  assert.equal(await verifyPocketAppleAccess(userId, "proof", deps({ getStatuses: async () => statuses })), true);
  for (const renewal of [{ originalTransactionId: "different", environment: "Sandbox", productId: transaction.productId, gracePeriodExpiresDate: 2000 }, { originalTransactionId: "10001", environment: "Production", gracePeriodExpiresDate: 2000 }, { originalTransactionId: "10001", environment: "Sandbox", productId: transaction.productId, gracePeriodExpiresDate: 999 }]) assert.equal(await verifyPocketAppleAccess(userId, "proof", deps({ getStatuses: async () => statuses, verifyRenewal: async () => renewal })), false);
});
test("Apple outages/signature failures propagate to fail-closed access guard; empty/oversized proof makes no Apple call", async () => {
  await assert.rejects(() => verifyPocketAppleAccess(userId, "proof", deps({ verifyTransaction: async () => { throw new Error("bad signature"); } })));
  await assert.rejects(() => verifyPocketAppleAccess(userId, "proof", deps({ getStatuses: async () => { throw new Error("Apple down"); } })));
  for (const proof of ["", "x".repeat(16001)]) assert.equal(await verifyPocketAppleAccess(userId, proof, deps({ verifyTransaction: async () => { throw new Error("must not verify"); } })), false);
});

test("legacy purchases require independently recorded ownership, never proof possession or a conflicting token", async () => {
  const legacy = { ...transaction, appAccountToken: undefined };
  assert.equal(await verifyPocketAppleAccess(userId, "legacy", deps({ verifyTransaction: async () => legacy })), false);
  assert.equal(await verifyPocketAppleAccess(userId, "legacy", deps({ verifyTransaction: async () => legacy, isLegacyOwner: async (original: string, id: string) => original === "10001" && id === userId })), true);
  assert.equal(await verifyPocketAppleAccess(userId, "legacy", deps({ verifyTransaction: async () => legacy, isLegacyOwner: async () => false })), false);
  let lookups = 0;
  assert.equal(await verifyPocketAppleAccess(userId, "wrong", deps({ verifyTransaction: async () => ({ ...transaction, appAccountToken: "different" }), isLegacyOwner: async () => { lookups++; return true; } })), false);
  assert.equal(lookups, 0);
});

test("grace renewal must also match Pocket product and account when supplied", async () => {
  const statuses = { bundleId: transaction.bundleId, environment: "Sandbox", data: [{ lastTransactions: [{ status: 4, originalTransactionId: "10001", signedTransactionInfo: "fresh", signedRenewalInfo: "renewal" }] }] };
  for (const change of [{ productId: "wrong-product" }, { appAccountToken: "other-user" }]) {
    assert.equal(await verifyPocketAppleAccess(userId, "proof", deps({ getStatuses: async () => statuses, verifyRenewal: async () => ({ originalTransactionId: "10001", environment: "Sandbox", productId: transaction.productId, gracePeriodExpiresDate: 2000, ...change }) })), false);
  }
});
