import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path: string) => readFile(new URL(path, root), "utf8");

test("Capacitor Android targets the current Play API level with the production package", async () => {
  const [variables, appGradle, manifest, activity] = await Promise.all([
    read("android/variables.gradle"),
    read("android/app/build.gradle"),
    read("android/app/src/main/AndroidManifest.xml"),
    read("android/app/src/main/java/com/nashaimarkets/pocketbullseye/MainActivity.java"),
  ]);
  assert.match(variables, /compileSdkVersion = 36/);
  assert.match(variables, /targetSdkVersion = 36/);
  assert.match(appGradle, /applicationId "com\.nashaimarkets\.pocketbullseye"/);
  assert.match(appGradle, /versionCode 11/);
  assert.match(appGradle, /versionName "1\.1"/);
  assert.match(appGradle, /com\.android\.billingclient:billing:9\.1\.0/);
  assert.match(manifest, /android:allowBackup="false"/);
  assert.match(manifest, /android:usesCleartextTraffic="false"/);
  assert.match(activity, /registerPlugin\(PocketPlayBillingPlugin\.class\)/);
});

test("Google Play subscription bridge handles status, purchase, restore, pending and acknowledgement", async () => {
  const [client, native, billing, terms, privacy] = await Promise.all([
    read("app/pocket/play-billing.ts"),
    read("app/pocket/native-subscription.ts"),
    read("android/app/src/main/java/com/nashaimarkets/pocketbullseye/PocketPlayBillingPlugin.java"),
    read("app/terms/page.tsx"),
    read("app/privacy/page.tsx"),
  ]);
  assert.match(client, /pocket_bullseye_monthly/);
  assert.match(client, /registerPlugin<PlayBillingPlugin>\("PocketPlayBilling"\)/);
  assert.match(native, /Capacitor\.getPlatform\(\) === "android"/);
  assert.match(native, /purchasePlaySubscription/);
  assert.match(native, /restorePlaySubscription/);
  assert.match(billing, /@CapacitorPlugin\(name = "PocketPlayBilling"\)/);
  assert.match(billing, /queryProductDetailsAsync/);
  assert.match(billing, /launchBillingFlow/);
  assert.match(billing, /queryPurchasesAsync/);
  assert.match(billing, /Purchase\.PurchaseState\.PENDING/);
  assert.match(billing, /acknowledgePurchase/);
  assert.match(billing, /PendingPurchasesParams\.newBuilder\(\)[\s\S]*enableOneTimeProducts\(\)/);
  assert.match(billing, /enableAutoServiceReconnection/);
  assert.match(billing, /purchaseToken/);
  assert.doesNotMatch(billing, /DEFAULT_DISPLAY_PRICE = "£4\.99"/);
  assert.match(terms, /subscriptions on Android/);
  assert.match(terms, /Google Play subscriptions/);
  assert.match(privacy, /Apple or Google processes subscription purchases/);
});

test("Android free analysis is persisted before its completed result is exposed", async () => {
  const [billing, pocket] = await Promise.all([
    read("android/app/src/main/java/com/nashaimarkets/pocketbullseye/PocketPlayBillingPlugin.java"),
    read("app/pocket/PocketBullseye.tsx"),
  ]);
  assert.match(billing, /putBoolean\(FREE_USE_KEY, true\)\.commit\(\)/);
  assert.match(billing, /freeUseConsumed/);
  const consume = pocket.indexOf("await consumeNativeFreeUse()");
  const expose = pocket.indexOf("setAnalysis(nextAnalysis)");
  assert.ok(consume >= 0 && expose > consume);
});

test("Android project contains adaptive icons, splash assets and the offline fallback", async () => {
  await Promise.all([
    access(new URL("android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml", root)),
    access(new URL("android/app/src/main/res/mipmap-anydpi-v26/ic_launcher_round.xml", root)),
    access(new URL("android/app/src/main/res/drawable/splash.png", root)),
    access(new URL("android/app/src/main/assets/public/index.html", root)),
  ]);
});

test("Codemagic has an isolated Android release verification workflow", async () => {
  const pipeline = await read("codemagic.yaml");
  const start = pipeline.indexOf("pocket-bullseye-android-verify:");
  const end = pipeline.indexOf("pocket-bullseye-ios-testflight:");
  assert.ok(start >= 0 && end > start);
  const android = pipeline.slice(start, end);
  assert.match(android, /android-verify-v\*/);
  assert.match(android, /npm run typecheck/);
  assert.match(android, /verify-capacitor-server\.mjs/);
  assert.match(android, /npx cap sync android/);
  assert.match(android, /\.\/gradlew bundleRelease lintRelease testReleaseUnitTest/);
  assert.match(android, /\.aab/);
  assert.doesNotMatch(android, /google_play:/);
});
