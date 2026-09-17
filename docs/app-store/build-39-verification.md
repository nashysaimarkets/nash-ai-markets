# Pocket Bullseye 1.2.12 (39) — transaction recovery verification

## Device evidence

The owner's 72.37-second recording `ScreenRecording_09-17-2026 19-36-45_1.mp4` on 17 September 2026 shows TestFlight installing 1.2.12 (38). At approximately 58 seconds, Subscribe changes to CONNECTING TO APPLE. By 59 seconds the app displays “Apple has not confirmed an active subscription yet”; no purchase confirmation is visible. At 64–66 seconds Restore displays Apple's password prompt. At 67 seconds the app reports Restore cancelled; the password field was empty in the visible prompt. At 68 seconds Check Apple Access reports no active subscription.

The Subscribe outcome maps to the native purchase promise resolving `entitled=false`, not to a dead button or the previous provider-credit failure. In build 38 this follows a verified purchase transaction that fails the active-transaction checks and an empty current-entitlement result. The recording does not reveal the transaction's product, expiry or revocation status. An old inactive transaction is a leading explanation, not a proven transaction-level diagnosis. Restore cancellation is independently visible and does not explain the earlier Subscribe result. No successful purchase or active-purchase restore was recorded.

## Repair scope

- Start StoreKit's transaction update listener when the native plugin loads. Verify and process this product's outstanding transactions and later approvals; forward current access to the UI.
- Before a new user-initiated purchase, reconcile verified unfinished transactions and recover existing active access without starting another purchase. No automatic purchase retries or free-use resets.
- Reject expired, revoked, replaced, mismatched or undated purchase results with specific recovery text rather than resolving a generic inactive status. Continue accepting Apple's current entitlements during Billing Grace Period.
- Unlock the visible paywall when a verified native update supplies active access. Remove the listener on unmount.
- Keep Apple-supplied price/currency. The recorded USD session and prior verified GBP 4.99 product configuration do not establish the cause of the storefront mismatch.

Apple's [transaction updates documentation](https://developer.apple.com/documentation/storekit/transaction/updates) requires listening from launch to receive unfinished and out-of-app transactions. Its [unfinished transaction sequence](https://developer.apple.com/documentation/storekit/transaction/unfinished) supports reconciliation later in a session. These documented lifecycle gaps were found in the source; device success still requires verification.

## Verification boundary

The 19 existing focused purchase/review tests pass. The Mac runner passed all 15 native policy cases covering active, expired, expiry-boundary, revoked, replaced, mismatched, missing-expiry and current entitlements. All 1,068 unit tests, typecheck, security, web build, immutable-pin verification, Capacitor synchronization, signing and native archive passed. These checks do not simulate a real App Store purchase.

Apple accepted build 39 without upload errors at 18:58:56 UTC on 17 September. Read-only verification confirms VALID and active in internal TestFlight. It has not been submitted to App Review. All five physical-device release checks remain required before App Review, as specified by CUSTOMER_JOURNEY_BATCH.md.

## Pinned candidate

- Repair and web source: `31f8261013da992ba45f05be6e53253675caa9ec`.
- READY deployment: `dpl_EmjS25nuAQE6i7kDPA9BMPtaowb4`; exact served revision verified 17 September 2026.
- Web URL: https://nash-ai-markets-q9jd3ysxt-nash-ai-markets.vercel.app/pocket.
- Type checking and the secret-pattern scan passed locally.
- Read-only Apple preflight: `6aac36b79b5911cdc535057e`, completed in 29 seconds from the repair revision. Build 38 remains VALID and in internal TestFlight; 1.2.12 is an editable draft, and 1.2.11 remains public.

## Native upload

- Native source: `2cfa1ea428a1e7bc77be544dd5eb31c3dc8558db`.
- Staging run: `6aac378569aec796c74123fa`, started from that exact source.
- Apple upload accepted at 18:58:56 UTC; delivery UUID `691ad00d-2939-4300-a2ba-488770e1debc`.
- Read-only status run `6aac38fe35c948ed346cfd2b` finished in 30 seconds from the exact native source: Apple build `691ad00d-2939-4300-a2ba-488770e1debc`, version 1.2.12 (39), VALID, unexpired, internal IN_BETA_TESTING and external READY_FOR_BETA_SUBMISSION.
- Actual purchase and active-purchase restore on build 39 remain unverified. No review was cancelled or submitted; public version remains 1.2.11. The existing App Store draft has not been reattached from build 38 during this verification task.

## Draft preparation follow-up — 17 September, 20:13 BST

Guarded draft workflow `6aac3bc5d2ea6c284fcfc693` completed in 38 seconds from source `72d09a1f6c32cbb41c9ba654ad79156a952dc08d`. It read Apple's current versions and review submissions before each mutation, verified the exact valid build, and attached build 39 to the existing 1.2.12 draft `05285e9d-04f6-49d9-9ff3-ef5dca520ac0`. It also saved and read back the en-GB release notes at localization `3dce39fe-727b-46fd-8c51-62d0c87c8249`.

The final readback reported `DRAFT VERIFIED: 1.2.12 (39); en-GB notes saved; AFTER_APPROVAL` and `NOT SUBMITTED: physical iPhone customer-journey validation remains required`. The draft remains PREPARE_FOR_SUBMISSION. No new binary was created, no review was submitted or cancelled, and the immutable web pin is unchanged.

### Remaining phone verification

Install 1.2.12 (39) in TestFlight and confirm that exact version before testing. At the paywall, tap Subscribe once and complete Apple's sign-in or confirmation privately. Record whether an Apple purchase sheet appears, whether access unlocks, and the exact error if it does not. Do not record credentials or treat the USD label alone as the transaction result.

All five release checks remain pending on this candidate: purchase, purchase cancellation, restoration of an existing active purchase, correct one-free-analysis consumption, and analytics opt-out. A cancelled Apple sign-in or a no-active-subscription response is not successful restoration. These must be observed on the phone; the browser and automated policy tests cannot supply that evidence. The draft is prepared, so after those checks pass the next publishing action is the guarded submission workflow.
