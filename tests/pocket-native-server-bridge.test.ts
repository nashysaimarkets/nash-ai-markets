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

test("fresh purchase and subscription updates deliver their exact verified JWS before the entitlement stream catches up", async () => {
  const source = await readFile(new URL("../ios/App/App/PocketStoreKitPlugin.swift", import.meta.url), "utf8");
  const purchase = source.slice(source.indexOf("case .success(let verification):"), source.indexOf("case .pending:"));
  assert.match(purchase, /completedVerification: verification/);
  const updates = source.slice(source.indexOf("for await result in Transaction.updates"), source.indexOf("deinit"));
  assert.match(updates, /completedVerification: result/);
  assert.match(source, /payload\["signedTransactionInfo"\] = completedVerification.jwsRepresentation/);
});

test("native accessChanged notifications are server verified and listener lifecycle is wired into customer controls", async () => {
  const bridge = await readFile(new URL("../app/pocket/apple-storekit.ts", import.meta.url), "utf8");
  assert.match(bridge, /addListener\("accessChanged"/);
  assert.match(bridge, /subscribeAppleAccessChanges/);
  const controls = await readFile(new URL("../app/pocket/NativeSubscriptionControls.tsx", import.meta.url), "utf8");
  assert.match(controls, /subscribeAppleAccessChanges/);
  assert.match(controls, /listener\?\.remove\(\)/);
});

test('native Swift package and JavaScript bridge use the same patched Capacitor release', async () => {
  const pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
  const swift=await readFile(new URL('../ios/App/CapApp-SPM/Package.swift',import.meta.url),'utf8');
  const version=pkg.dependencies['@capacitor/ios'];
  assert.equal(version,'8.5.3');
  assert.equal(pkg.dependencies['@capacitor/core'],version);
  assert.equal(pkg.devDependencies['@capacitor/cli'],version);
  assert.ok(swift.includes(`capacitor-swift-pm.git", exact: "${version}"`));
});
