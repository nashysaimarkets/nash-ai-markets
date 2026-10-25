import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";
import { createScreenshotComparison } from "../app/pocket/screenshot-comparison-session.ts";

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
  for (const path of ["PocketBullseye.tsx", "ChartPreflightPanel.tsx"]) {
    const source = await readFile(new URL(`../app/pocket/${path}`, import.meta.url), "utf8");
    assert.match(source, /pocketAuthenticatedFetch\(/, `${path} must pass signed proof to its billed route`);
  }
  for (const path of ["OptionsWallCheck.tsx", "CryptoDerivativesCheck.tsx"]) {
    const source = await readFile(new URL(`../app/pocket/${path}`, import.meta.url), "utf8");
    assert.match(source, /useScreenshotComparison</, `${path} must use the shared authenticated comparison path`);
  }
  const hook = await readFile(new URL("../app/pocket/use-screenshot-comparison.ts", import.meta.url), "utf8");
  assert.match(hook, /fetch: pocketAuthenticatedFetch/);
});

test("the real shared comparison transport adds fresh native JWS and preserves cancellation", async () => {
  const source = await readFile(new URL("../app/pocket/apple-storekit.ts", import.meta.url), "utf8");
  const code = stripTypeScriptTypes(source.slice(source.indexOf("export async function pocketAuthenticatedFetch")).replace(/^export /, ""));
  let proof = "signed-synthetic-one";
  let lastError = "";
  const calls: { url: string; init: RequestInit }[] = [];
  // The shared bridge now checks Android first. Supply the actual iOS platform
  // fixture instead of silently catching a missing isGoogleNativeApp binding.
  const authenticated = new Function("isAppleNativeApp", "native", "APPLE_MONTHLY_PRODUCT_ID", "fetch", "isGoogleNativeApp", "playAuthenticatedFetch", code + ";return pocketAuthenticatedFetch;")(
    () => true, { getStatus: async () => ({ signedTransactionInfo: proof, entitled: true, freeUseConsumed: false }) }, "existing-product",
    async (url: string, init: RequestInit) => { calls.push({ url, init }); return Response.json({ result: { symbol: "AAPL" } }); },
    () => false, () => { throw new Error("The iOS fixture must not dispatch a Google request."); },
  ) as (url: string, init: RequestInit) => Promise<Response>;
  const session = createScreenshotComparison<{ symbol: string }>({ endpoint: "/api/pocket/options-wall", failureMessage: "Unavailable", fetch: authenticated,
    publish: state => { lastError = state.error; }, read: async () => "data:image/png;base64,test", validate: (raw): raw is { symbol: string } => Boolean(raw && typeof raw === "object" && "symbol" in raw) });
  await session.attach({ name: "chart", size: 1, type: "image/png" }); await session.check({ ticker: "AAPL" });
  assert.equal(lastError, "", "the actual native transport must complete, not swallow a fixture error");
  proof = "signed-synthetic-two"; await session.check({ ticker: "AAPL" });
  assert.equal(lastError, "", "fresh signed evidence must pass on the second request");
  assert.equal(calls.length, 2);
  assert.equal(new Headers(calls[0].init.headers).get("x-pocket-apple-transaction"), "signed-synthetic-one");
  assert.equal(new Headers(calls[1].init.headers).get("x-pocket-apple-transaction"), "signed-synthetic-two");
  assert.equal(calls[0].init.signal instanceof AbortSignal, true);
  assert.equal("entitled" in JSON.parse(String(calls[0].init.body)), false);
  assert.equal("freeUseConsumed" in JSON.parse(String(calls[0].init.body)), false);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(authenticated("/api/pocket/options-wall", { signal: controller.signal })); assert.equal(calls.length, 2);
  session.dispose();
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
