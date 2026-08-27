import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("Apple subscription identifiers stay aligned across TypeScript and StoreKit", async () => {
  const client = await readFile(new URL("app/pocket/apple-storekit.ts", root), "utf8");
  const native = await readFile(new URL("ios/App/App/PocketStoreKitPlugin.swift", root), "utf8");
  assert.match(client, /com\.nashaimarkets\.pocketbullseye\.monthly/);
  assert.match(native, /Transaction\.currentEntitlements/);
  assert.match(native, /AppStore\.sync\(\)/);
  assert.match(native, /transaction\.finish\(\)/);
});

test("one free completed analysis is enforced only inside the native Apple app", async () => {
  const pocket = await readFile(new URL("app/pocket/PocketBullseye.tsx", root), "utf8");
  assert.match(pocket, /freeUseConsumed && !appleAccess\.entitled/);
  assert.match(pocket, /await consumeAppleFreeUse\(\)/);
  assert.match(pocket, /isAppleNativeApp\(\) && !appleAccess/);
});

test("Apple paywall contains purchase, restore, renewal and legal disclosures", async () => {
  const paywall = await readFile(new URL("app/pocket/AppleSubscriptionPaywall.tsx", root), "utf8");
  assert.match(paywall, /purchaseAppleSubscription/);
  assert.match(paywall, /restoreAppleSubscription/);
  assert.match(paywall, /renews automatically/);
  assert.match(paywall, /href="\/terms"/);
  assert.match(paywall, /href="\/privacy"/);
});
