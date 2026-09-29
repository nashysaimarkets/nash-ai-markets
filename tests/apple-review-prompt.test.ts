import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);

test("the native review request waits for two completed analyses and is one-shot", async () => {
  const swift = await readFile(new URL("ios/App/App/PocketStoreKitPlugin.swift", root), "utf8");

  assert.match(swift, /count >= 2/);
  assert.match(swift, /reviewRequestedKey/);
  assert.match(swift, /defaults\.set\(true, forKey: self\.reviewRequestedKey\)/);
  assert.match(swift, /AppStore\.requestReview\(in: scene\)/);
  assert.match(swift, /SKStoreReviewController\.requestReview\(in: scene\)/);
  assert.match(swift, /activationState == \.foregroundActive/);
});

test("completed chart analyses are counted separately from the deferred prompt", async () => {
  const client = await readFile(new URL("app/pocket/PocketBullseye.tsx", root), "utf8");
  const analyse = client.slice(client.indexOf("async function analyse()"), client.indexOf("async function askBullseye"));
  const startNew = client.slice(client.indexOf("function startNewChart()"), client.indexOf("const vaultStats"));

  assert.match(analyse, /recordAppleSuccessfulAnalysis\(\)/);
  assert.doesNotMatch(analyse, /requestAppleReviewIfEligible\(\)/);
  assert.match(startNew, /requestAppleReviewIfEligible\(\)/);
});

test("web builds never attempt to invoke the native review bridge", async () => {
  const bridge = await readFile(new URL("app/pocket/apple-storekit.ts", root), "utf8");

  assert.match(bridge, /if \(!isAppleNativeApp\(\)\) return null;/);
  assert.match(bridge, /NativeAppleStoreKit\.recordSuccessfulAnalysis\(\)/);
  assert.match(bridge, /NativeAppleStoreKit\.requestReviewIfEligible\(\)/);
});
