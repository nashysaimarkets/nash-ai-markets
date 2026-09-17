# Pocket Bullseye purchase recovery — build 39 preparation

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

The 19 existing focused purchase/review tests pass. Native policy tests cover 15 active, expired, expiry-boundary, revoked, replaced, mismatched, missing-expiry and current-entitlement cases; they must execute on the Mac build runner. Typecheck, security, full release gates, signed native compilation and Apple processing remain to be recorded. These checks do not simulate a real App Store purchase.

Build 39 is not yet uploaded or submitted. Record the exact web deployment, native build commit, Apple build identifier and TestFlight state only after verification. All five physical-device release checks remain required before App Review, as specified by CUSTOMER_JOURNEY_BATCH.md.
