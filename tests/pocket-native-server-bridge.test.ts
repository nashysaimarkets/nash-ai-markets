import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("native purchases bind the verified Pocket account and return signed Apple evidence", async () => {
  const native = await readFile(new URL("../ios/App/App/PocketStoreKitPlugin.swift", import.meta.url), "utf8");
  assert.match(native, /UUID\(uuidString: call.getString\("appAccountToken"\)/);
  assert.match(native, /purchase\(confirmIn: scene, options: \[\.appAccountToken\(accountToken\)\]\)/);
  assert.match(native, /purchase\(options: \[\.appAccountToken\(accountToken\)\]\)/);
  assert.match(native, /payload\["signedTransactionInfo"\] = result.jwsRepresentation/);
  assert.match(native, /AppStore\.sync\(\)/);
});
test("native billed requests carry signed evidence without accepting device entitled/free-use flags", async () => {
  const bridge = await readFile(new URL("../app/pocket/apple-storekit.ts", import.meta.url), "utf8");
  assert.match(bridge, /x-pocket-apple-transaction/);
  assert.match(bridge, /\/api\/pocket\/apple-account/);
  assert.match(bridge, /appAccountToken/);
  assert.doesNotMatch(bridge, /entitled: true/);
  assert.doesNotMatch(bridge, /localStorage/);
  for (const path of ["PocketBullseye.tsx", "ChartPreflightPanel.tsx", "OptionsWallCheck.tsx", "CryptoDerivativesCheck.tsx"]) {
    const source = await readFile(new URL(`../app/pocket/${path}`, import.meta.url), "utf8");
    assert.match(source, /pocketAuthenticatedFetch\(/, `${path} must pass signed proof to its billed route`);
  }
});
