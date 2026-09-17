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

Twenty-two focused purchase/contract/review tests, TypeScript checking, secret-pattern scan and diff checks passed locally. Three new JS tests cover diagnostic parsing, malformed/error payloads, privacy, bounded chains and honest unknown-error messages. Ten native Foundation checks are added to the existing Mac release gate to verify nested errors, associated errors, negative codes, privacy and serialization. The native execution and upload results are recorded below; these tests cannot verify an actual Apple purchase.

Build 39 is the last observed installed version; build 40 installation has not yet been observed. Build 40 is diagnostic; no successful purchase or active-purchase restore has been demonstrated. All five phone checks must pass on the eventual release candidate before App Review.

## Staging source and preflight

The immutable web deployment `dpl_AwEYLDNAhnxC2eixpkJM74BZgzAW` is READY at https://nash-ai-markets-qj5du30qn-nash-ai-markets.vercel.app/pocket and its manifest verifies source `6c96f9be394d0dc05d7b2da4e2a028fddaa7c82d`. Build 40 pins that verified revision.

Read-only Apple workflow `6aac41737992a5c0dfbef8c3` ran from that source at 20:37 BST on 17 September: 1.2.12 remains PREPARE_FOR_SUBMISSION, 1.2.11 is READY_FOR_DISTRIBUTION, and candidate 39 remains VALID / IN_BETA_TESTING. The existing Apple draft still selects build 39; changing the repository candidate to 40 does not change the Apple draft. No review submission is being replaced.

## Native staging result

Staging-only workflow `6aac43159fdc32ad3d4f990b` ran from native source `bc7eb41300c3a78e37f4b5bb70e9eae20ccb5b1a`, starting at 20:44 BST. All 1,071 unit tests, TypeScript checking, secret-pattern scan, 15 native subscription-state cases and 10 native diagnostic checks passed. Web build, immutable revision verification, Capacitor sync, signing, native compilation, archive and export succeeded. Apple accepted 1.2.12 (40) at 19:49:36 UTC with no upload errors; delivery UUID `0397facd-949e-4bac-bf87-7b429d0bdc4e`. TestFlight readiness requires the separate read-only Apple check below. No App Review submission was requested.

## Independent Apple availability verification

Read-only workflow `6aac44a96145703c9436e5b4` ran from `bc7eb41300c3a78e37f4b5bb70e9eae20ccb5b1a` at 20:51 BST, finishing in 31 seconds. It confirmed exact build 1.2.12 (40), Apple ID `0397facd-949e-4bac-bf87-7b429d0bdc4e`, VALID and unexpired, internal IN_BETA_TESTING and external READY_FOR_BETA_SUBMISSION. Version 1.2.12 remains PREPARE_FOR_SUBMISSION and public version remains 1.2.11. The existing draft still selects 39; it was not modified during this diagnostic task. No App Review submission or review cancellation occurred.

Next phone check: update to 1.2.12 (40) in TestFlight, tap Subscribe once and complete any Apple prompt privately. If it fails, expand Apple error details · Subscribe and capture that panel. The screenshot will identify the operation, native codes and returned storefront/currency without credentials. All five device checks remain not-tested for build 40.
