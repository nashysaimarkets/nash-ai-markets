# Native acceptance — 19 October 2026

Execution contract: [issue 126](https://github.com/nashysaimarkets/nash-ai-markets/issues/126). Root is the only integration writer on `monaco-master-126-20261019-b02d5dd`, [draft PR 127](https://github.com/nashysaimarkets/nash-ai-markets/pull/127). Observed PR head: `db3b66992d8a83266e37cb450de3c893e7ace860`; later commits need their own exact-SHA checkpoint. This independent QA task made no native source, store, credential, device, backend or production changes.

Reuse the detailed [native integration acceptance plan](../quality/pocket-native-integration-acceptance-2026-10-11.md). This file records new inventory and present evidence; it does not replace that plan or claim native acceptance.

## Separate identities and runtimes

| Surface | Verified source/contract identity | Present acceptance |
| --- | --- | --- |
| Current iOS source | Version `1.2.14`, build `47`; bundle `com.nashaimarkets.pocketbullseye`; product `com.nashaimarkets.pocketbullseye.monthly`; App Store ID `6806004581` | Source inventory only. No current signed archive or generated native pin was available in this checkout. Source build numbers do not identify a distributed binary. |
| New native web pin | `CAPACITOR_SERVER_URL` requires HTTPS `/pocket`, credential-free URL and immutable deployment; `CAPACITOR_SERVER_REVISION` requires a full Git SHA. Existing verifier compares `/api/pocket/build-manifest`. | A new candidate binary's actual URL, deployment ID, artifact hash and embedded configuration remain **BLOCKED** until a signed archive is inspected. `/pocket-next` preview is not automatically the native `/pocket` entrypoint. |
| Live Sites | Owner contract identifies `appgprj_6a6efa569218819185b3eefd3c508e66`, v179/env34, shared-live Supabase `pxlqvaddvghjjhenqmdh`. UUID-bound paid admission was already accepted. | Preserved evidence, not re-tested here. It proves admission, not StoreKit or scanner accuracy. This backend cannot be treated as a disposable staging database. |
| Native Node/Vercel backend | Independently pinned native runtime, distinct from Sites. Historical owner context names original Supabase `opmgzchnmcgnsfwpmysc`; current signed binary/backend binding was not reverified. | Node source tests do not establish a deployed backend or prove that a native binary uses it. Require read-only manifest/environment identity evidence for the exact native pin. Do not copy Sites credentials or assume source trees are interchangeable. |

Preserve public Pocket Bullseye identity and the original £4.99 founding subscription. Never repurchase to prove access. Store product/customer records were not changed.

## Android source recovered

An exact `android` branch search exhausted its continuation and found two existing branches. The absence of `android/` from PR127 is not absence from the repository.

| Existing branch | Observed immutable head | Scope |
| --- | --- | --- |
| `feat/pocket-android-1.2.7-2026-09-07` | `5a5e491bf85042937a6099a19effbc0b9e8933be` | Latest dated Android branch found; commit dated 7 September 2026. Actual Android source inspected read-only. |
| `feat/pocket-android-worldwide-2026-09-01` | `50f37e5619de375f217ff09b03b6566ca381ce35` | Older branch located; native implementation not independently audited in this task. |

At the inspected September 7 head:

- `android/app/build.gradle`: package `com.nashaimarkets.pocketbullseye`, version `1.2.7`, versionCode `23`, Google Play Billing `9.1.0`; `android/variables.gradle`: minSdk24, compile/targetSdk36. These are source pins, not a current Play policy or accepted-binary finding.
- Manifest disables backup and cleartext traffic. `MainActivity` registers `PocketPlayBillingPlugin`. Release signing uses concealed Codemagic environment values and rejects an explicitly requested signed release if they are incomplete; no values or signing material were accessed.
- [Recorded Android pin](https://github.com/nashysaimarkets/nash-ai-markets/blob/5a5e491bf85042937a6099a19effbc0b9e8933be/docs/google-play/release-pin.json): web revision `1910054be660e3e21f1722e91de50a1de3e76934`, deployment `dpl_AfKt7LBnzCWLiyXJdZhHNACsdxQx`, URL `https://nash-ai-markets-bzlm3v8pb-nash-ai-markets.vercel.app/pocket`, recorded 7 September 2026. It explicitly says native device tests pending, `playVersionCodeVerified:false`, and scope limited to manifest/initial upload screen. That historical URL was not opened or revalidated.
- [Java billing bridge](https://github.com/nashysaimarkets/nash-ai-markets/blob/5a5e491bf85042937a6099a19effbc0b9e8933be/android/app/src/main/java/com/nashaimarkets/pocketbullseye/PocketPlayBillingPlugin.java) uses `pocket_bullseye_monthly`, handles pending/acknowledgement/status/restore and returns a purchase token. Its purchase flow does not bind a server-verified Pocket account; local preferences track free use. The reviewed [JavaScript bridge](https://github.com/nashysaimarkets/nash-ai-markets/blob/5a5e491bf85042937a6099a19effbc0b9e8933be/app/pocket/native-subscription.ts) directly accepts native `entitled`/free-use values and has an entitled web fallback. Do not transplant those stale authorization paths into the hardened candidate.
- Existing `tests/android-play-billing-contract.test.ts` asserts source strings, assets and pipeline setup. It was inspected, not executed here; it is not signed purchase, server receipt verification, ownership, signing or device evidence. No APK/AAB or Play Console state was inspected.

## Evidence classification

| Evidence | Observed result | Limit |
| --- | --- | --- |
| Independent affected Node tests | **REAL PASS**:73 commerce/auth/calibration cases and23 UI/helper/workflow/native-source cases; zero skips | Counts overlap other programme runs. Dependencies/provider/native events are mocked or source-inspected; do not add counts or call these real purchases. |
| SQL identity guard reproduction | **REAL PASS**, isolated in-memory PostgreSQL: historical function mutates the foreign-bound row; proposed additive successor rejects it and preserves the row | Minimal synthetic tables; founding award side effect stubbed. No hosted migration, lock-window or role/privilege acceptance. |
| Browser/synthetic UI | Root's separately recorded actual browser loaded the candidate and no-credit demo | No physical iPhone, StoreKit, Android purchase or provider accuracy finding. Reuse root's final screenshot/SHA evidence. |
| Signed native/real store lifecycle | **BLOCKED** | Linux runner has no Xcode/xcrun/iPhone or Android device/adb. No signed archive, real restore, renewal, expiry, grace, refund or account-switch test was performed. |
| Native initial/event recovery | **REAL PASS** at source/mock scope:9/9 frozen recovery tests plus the independent actual-effect red/green harness | Preserves server verification. No signed/native/device claim. Exact reviewed files below. |

### Independent native recovery proof

The initial repair exposed a second race: `subscribeAppleAccessChanges` cleared local entitlement before server verification, but the UI treated that intermediate event as READY and offered a purchase. The independent actual-effect harness reproduced `phase:READY`, `showPurchase:true`, with no StoreKit/API call. Baseline source hashes were controls `b9bd608f9991e0e8be84ededf09ed461210c1cdd42144aabab0c259c1801b30e` and bridge `147015b843b7047839f1a2b50aea0007a8bd0cf0bbd8e750e661076007ef87dc`.

UI engineer's frozen correction adds a compatible optional VERIFYING/VERIFIED/ERROR callback phase. Intermediate and unmarked events clear entitlement and remain CHECKING; failed server checks expose retry without purchase; only a verified result sets READY. Superseded replies and unmounted listeners remain ignored. Independent review and9/9 recovery tests passed; no API authorization/price/product/store setting changed.

| Frozen file | Independently matched SHA-256 |
| --- | --- |
| `app/pocket/NativeSubscriptionControls.tsx` | `b83a3075818cf8d9936468a5c077e9955841e0ddcc0f9a974faa8d2e4b0b3078` |
| `app/pocket/apple-storekit.ts` | `b4b334dfecb5a4174f3a38896f5b90cd4c19f5b9195427f689ee52ecefc7b307` |
| `tests/pocket-native-subscription-recovery.test.ts` | `a7237795ad6ccc642387735038d26263faa22f94a428e0c25c2383f6806a0007` |

Stable independent harness: `qa-tools/native-subscription-event-phase.mjs`. Against frozen `ui-staging` with `--expect-safe`, all four checks passed: pending purchase hidden, failed verification exposes retry, verified state accepted, unknown phase held. The harness executes actual effect/helper source with synthetic events; the9-case suite additionally exercises the actual bridge into the actual controls with mocked verification. These are regression proofs, not signed Apple acceptance. Final root integration must preserve these hashes or review the changed delta.

The final lint follow-up uses `useSyncExternalStore` for fixed-session Capacitor platform identity with a null server snapshot, keeping hydration consistent. Effect dependencies include platform identity and retry attempt; retry resets presentation from its event handler. Independent review found phase/proof gating unchanged, and the9/9 recovery tests plus actual-effect four-invariant harness passed again against the final hashes above.

## Essential resumption actions

1. **Native release lab:** use the existing authorised Mac/Xcode/signing resources and a physical iPhone. Inspect one signed archive's bundle/build/product and immutable web pin, then execute the existing plan against that exact SHA. Secure sandbox credentials remain in the authorised device/provider workflow, never chat/repository. Record cancellation, background return, large images, five-slot replacement and real StoreKit purchase/restore/account-switch/grace/refund/expiry evidence.
2. **Android engineer:** recover the existing September branch into an isolated owned successor; reconcile its wrapper/assets with current guarded server admission. Establish server-verified Google receipt/account ownership and lifecycle handling before any access can depend on a purchase. Keep first-free OFF. This QA task created no Android project or implementation.
3. **Google/Android owner resources:** supply authorised existing Play Console application/product/base-plan/test-track and upload-signing access through secure tooling; inspect accepted versionCode, app-signing identity and a signed AAB/APK, then run a physical-device/licence-tester purchase/restore/pending/expiry/refund/account-switch flow. Console access and code presence are separate gates. No store upload or purchase was initiated.
4. **Release owner:** native StoreKit/Google acceptance, precise shared-live migration approval and final production/store decision remain separate from offline code success. Preserve v179's UUID-paid guard and customer binding; rollback means a reviewed guarded version with scanners disabled, never an unguarded historical authorization path.

Next checkpoint: root publishes this inventory and frozen native recovery review with the exact final PR127 SHA. No new native release claim follows from this document.
