# Pocket Bullseye 1.2.12 (40) — Apple error diagnostics

## Evidence and scope

The owner clarified that he manually closed Apple's password prompts in the build 39 recording. He subsequently supplied `92F9380D-4724-4B18-8F21-BA96E9AE9685.jpeg` at 20:27 BST on 17 September 2026. It shows the paywall, Apple test environment, USD 4.99 and the error “Unable to Complete Request”. The still image does not identify whether Subscribe or Restore produced the error or establish the native error domain/code.

The native bridge passed only `localizedDescription` and a generic operation code to the UI. It discarded the underlying StoreKit error chain. This is a confirmed diagnostic gap; the precise purchase failure remains unresolved.

An independent developer [reports the same AppStore.sync error on iOS 26.6.2](https://origin-devforums.apple.com/forums/thread/846100), including StoreKit.StoreKitError code 2, but no resolution. A separate [TestFlight currency report](https://origin-devforums.apple.com/forums/thread/845478) describes USD product metadata despite a European storefront. These firsthand reports are relevant comparisons, not Apple-confirmed causes for this user's phone. The app's UK product configuration was previously verified at GBP 4.99. Do not force GBP or claim this is a confirmed Apple outage.

## Changes

- Preserve a bounded chain of native error domains and numeric codes, including StoreKit-associated system/network errors that are absent from NSError.userInfo.
- Provide the failed operation/stage, native build, iOS version, sandbox/production context and already-cached storefront/currency in an expandable Apple error details panel.
- Allowlist every exported diagnostic field and error domain. Do not export userInfo, account identifiers, receipts, transaction IDs, request URLs or arbitrary descriptions in that panel. No new telemetry endpoint or automatic diagnostic upload.
- Distinguish an Apple purchase failure from a restore failure in the generic error copy. Do not infer the underlying cause or whether money changed hands from an unknown error.
- Read only local or cached metadata when reporting errors; never start another StoreKit request to construct an error report. Existing entitlement checks, Apple prices and one-free-use rules are unchanged.

## Verification

Twenty-two focused purchase/contract/review tests, TypeScript checking, secret-pattern scan and diff checks passed locally. Three new JS tests cover diagnostic parsing, malformed/error payloads, privacy, bounded chains and honest unknown-error messages. Ten native Foundation checks are added to the existing Mac release gate to verify nested errors, associated errors, negative codes, privacy and serialization. Native execution and upload status must be recorded after staging; these tests cannot verify an actual Apple purchase.

Build 39 remains the installed, unsubmitted candidate until this build is uploaded and available. Build 40 is diagnostic; no successful purchase or active-purchase restore has been demonstrated. All five phone checks must pass on the eventual release candidate before App Review.
