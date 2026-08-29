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
  assert.match(native, /guard let product else/);
  assert.doesNotMatch(native, /displayPrice"\]?[\s\S]{0,80}\?\? "£4\.99"/);
});

test("the scene boots through the bridge that registers Pocket StoreKit", async () => {
  const [scene, bridge] = await Promise.all([
    readFile(new URL("ios/App/App/SceneDelegate.swift", root), "utf8"),
    readFile(new URL("ios/App/App/PocketBridgeViewController.swift", root), "utf8"),
  ]);
  assert.match(scene, /rootViewController = PocketBridgeViewController\(\)/);
  assert.doesNotMatch(scene, /rootViewController = CAPBridgeViewController\(\)/);
  assert.match(bridge, /registerPluginInstance\(PocketStoreKitPlugin\(\)\)/);
});

test("one free completed analysis is enforced only inside the native Apple app", async () => {
  const pocket = await readFile(new URL("app/pocket/PocketBullseye.tsx", root), "utf8");
  assert.match(pocket, /appleAccess\.freeUseConsumed/);
  assert.match(pocket, /!appleAccess\.entitled/);
  assert.match(pocket, /await consumeAppleFreeUse\(\)/);
  assert.match(pocket, /if \(isAppleNativeApp\(\)\)[\s\S]*await refreshAppleAccess\(\)/);
  const consume = pocket.indexOf("await consumeAppleFreeUse()");
  const expose = pocket.indexOf("setAnalysis(nextAnalysis)");
  assert.ok(consume >= 0 && expose > consume, "the free result must not be exposed before Keychain persistence succeeds");
});

test("every additional native AI request requires an Apple entitlement", async () => {
  const pocket = await readFile(new URL("app/pocket/PocketBullseye.tsx", root), "utf8");
  assert.match(pocket, /async function requireAppleEntitlementForAdditionalRequest\(\)/);
  assert.match(pocket, /const latest = await refreshAppleAccess\(\)/);
  for (const request of ["rescanLevelsOnly", "reanalyseResult", "reanalyseWithCorrection", "askBullseye"]) {
    const start = pocket.indexOf(`async function ${request}`);
    assert.notEqual(start, -1, `${request} must exist`);
    const body = pocket.slice(start, start + 500);
    assert.match(body, /await requireAppleEntitlementForAdditionalRequest\(\)/, `${request} must refresh and gate before requesting`);
  }
  assert.match(pocket, /currentAppleAccess = await refreshAppleAccess\(\)/);
  assert.match(pocket, /reviewTarget && currentAppleAccess\?\.isNative && !currentAppleAccess\.entitled/);
  assert.match(pocket, /appleCanRunPreflight \? <ChartPreflightPanel/);
  assert.match(pocket, /startNewChart[\s\S]*appleNeedsSubscription[\s\S]*setShowApplePaywall\(true\)/);
});

test("Apple paywall contains purchase, restore, renewal and legal disclosures", async () => {
  const paywall = await readFile(new URL("app/pocket/AppleSubscriptionPaywall.tsx", root), "utf8");
  assert.match(paywall, /purchaseAppleSubscription/);
  assert.match(paywall, /restoreAppleSubscription/);
  assert.match(paywall, /renews automatically/);
  assert.match(paywall, /one-month auto-renewable subscription/);
  assert.match(paywall, /RESTORE PURCHASES/);
  assert.match(paywall, /href="\/terms"/);
  assert.match(paywall, /href="\/privacy"/);
});

test("native Pocket does not render or share external web purchase paths", async () => {
  const [pocket, joinPage, foundingPage, webOnly] = await Promise.all([
    readFile(new URL("app/pocket/PocketBullseye.tsx", root), "utf8"),
    readFile(new URL("app/join/page.tsx", root), "utf8"),
    readFile(new URL("app/pocket/founding/page.tsx", root), "utf8"),
    readFile(new URL("app/pocket/founding/FoundingWebOnly.tsx", root), "utf8"),
  ]);
  assert.match(pocket, /if \(isAppleNativeApp\(\)\)[\s\S]*Invites to web membership offers are unavailable/);
  assert.match(pocket, /appleAccess && !appleAccess\.isNative \? <button[^>]+onClick=\{shareFoundingInvite\}/);
  assert.match(joinPage, /redirect\(`\/pocket\/founding/);
  assert.match(foundingPage, /<FoundingWebOnly><main/);
  assert.match(webOnly, /Capacitor\.isNativePlatform\(\)/);
  assert.match(webOnly, /router\.replace\("\/pocket"\)/);
  assert.match(webOnly, /if \(platform !== "web"\)/);
});

test("the app privacy manifest declares only the host UserDefaults reason", async () => {
  const [manifest, project] = await Promise.all([
    readFile(new URL("ios/App/App/PrivacyInfo.xcprivacy", root), "utf8"),
    readFile(new URL("ios/App/App.xcodeproj/project.pbxproj", root), "utf8"),
  ]);
  assert.match(manifest, /NSPrivacyAccessedAPICategoryUserDefaults/);
  assert.match(manifest, /CA92\.1/);
  assert.doesNotMatch(manifest, /FileTimestamp|DiskSpace|SystemBootTime|ActiveKeyboards/);
  assert.match(project, /PrivacyInfo\.xcprivacy in Resources/);
  assert.match(project, /PrivacyInfo\.xcprivacy \*\/ = \{isa = PBXFileReference/);
});

test("clean iOS CI builds dist before Capacitor sync", async () => {
  const [pipeline, capacitor, fallback, verifier, manifest] = await Promise.all([
    readFile(new URL("codemagic.yaml", root), "utf8"),
    readFile(new URL("capacitor.config.ts", root), "utf8"),
    readFile(new URL("ios/NativeWeb/index.html", root), "utf8"),
    readFile(new URL("scripts/verify-capacitor-server.mjs", root), "utf8"),
    readFile(new URL("app/api/pocket/build-manifest/route.ts", root), "utf8"),
  ]);
  const build = pipeline.indexOf("npm run build");
  const artifact = pipeline.indexOf("test -f dist/server/index.js");
  const verify = pipeline.indexOf("node scripts/verify-capacitor-server.mjs");
  const sync = pipeline.indexOf("npx cap sync ios");
  assert.ok(build >= 0 && artifact > build && verify > artifact && sync > verify);
  assert.match(capacitor, /webDir: "ios\/NativeWeb"/);
  assert.match(capacitor, /process\.env\.CAPACITOR_SERVER_URL/);
  assert.match(capacitor, /process\.env\.CAPACITOR_SERVER_REVISION/);
  assert.doesNotMatch(capacitor, /url: "https:\/\/pocket\.nashaimarkets\.com/);
  assert.match(verifier, /api\/pocket\/build-manifest/);
  assert.match(verifier, /payload\?\.revision !== expectedRevision/);
  assert.match(verifier, /hostname\.includes\("-git-"\)/);
  assert.match(manifest, /VERCEL_GIT_COMMIT_SHA/);
  assert.match(manifest, /cache-control": "no-store"/);
  assert.match(fallback, /No chart has been sent/);
});
