# Build 41 — accessible Apple Restore

Prepared on 17 September 2026 after the owner reported that purchase and usage-count opt-out worked on build 40, but purchase cancellation and Restore were unavailable after subscribing. He did not recall a free analysis on that build. Historical evidence is preserved separately; unavailable checks are not marked passed.

## Scope

The native home and results screens now contain a compact Apple subscription panel with an always-reachable Restore Purchases button. It displays Apple-reported active access or the existing device free-use state, keeps the button guarded during an operation and shows completion, cancellation, inactive-access and slow-response messages. Existing bounded error diagnostics are available after a failure.

The change reuses the existing StoreKit restore operation. It does not initiate purchases, cancel a subscription, reset the free-use Keychain flag, bypass entitlements or substitute a currency. An active subscription still cannot be used to exercise Apple's new-purchase cancellation sheet; that requires an unsubscribed test session. A fresh-device free allowance still requires separate physical testing. Source inspection shows that the same device free-use flag persists across updates; this may explain the owner's experience, but does not establish what happened on his phone.

## Verified source and web pin

- Web source: `77850015745fdc375b50812afca47b7d68f332bf`
- READY deployment: `dpl_2HQNM98VpghFUBBWcs4V77iFnZ9k`
- Immutable URL: https://nash-ai-markets-rc1olosmo-nash-ai-markets.vercel.app/pocket
- The served-revision verifier passed before selecting this pin.
- Native version: 1.2.12 (41).

## Local verification

- Five new executable restore/render checks passed: active/free/unknown-state reachability, duplicate taps, inactive results, cancellation preserving access and unmount safety.
- Seven existing purchase-flow checks passed.
- Twelve existing StoreKit contract checks passed.
- The existing initial-scan test passed for readable, unreadable, poor and failed analysis outcomes; only a readable result consumes the free use.
- TypeScript checking, secret-pattern scan and ten release/device guard tests passed.
- The local mobile-layout fixture could not be opened in the cloud browser (connection refused), so visual inspection is not claimed. Static render and interaction-handler checks are automated evidence only, not physical StoreKit or iPhone evidence.

No build 41 physical-device checks, upload, processing or App Review submission are established by preparation alone. Those states must be recorded from actual results below.

## Apple preflight and signed staging

Read-only Apple status run `6aac51a72622d87f8ba76715` succeeded in 41 seconds before build 41 staging. It confirmed that 1.2.12 was PREPARE_FOR_SUBMISSION, public 1.2.11 was READY_FOR_DISTRIBUTION / READY_FOR_SALE and build 40 was VALID, unexpired and IN_BETA_TESTING internally. The preflight did not change Apple records.

TestFlight-only run `6aac529bf2361f8c4a9a6de3` started on 17 September at 21:50 BST from native commit `292637011733caac5b37bcb0c5ce719b3ff78d55`, using `pocket-bullseye-ios-stage-next` with `submit_to_app_store: false`.

The remote release checks passed all 1,076 unit tests with zero failures, cancellations or skips, along with type checking and the secret-pattern scan. Native checks passed 15 purchase-state cases and 10 bounded diagnostic cases. Web production build, verified revision synchronization and signing-profile application also completed. Archive/export, upload and Apple processing results are recorded below only after verification.

Apple accepted the signed 1.2.12 (41) upload at `2026-09-17T20:56:43.957Z` with no errors. Delivery UUID: `4731641e-3416-485d-823a-3dc3bcffab35`. Native archive/export succeeded. The staging run reported build completed successfully and entered post-processing for TestFlight notes. This upload receipt alone does not establish Apple processing or tester availability.

Read-only Apple run `6aac54784515b5cc087e3ae7` finished successfully in 39 seconds from the same native source. It verified exact build ID `4731641e-3416-485d-823a-3dc3bcffab35`, version 41, processingState VALID and expired false. Internal TestFlight state is IN_BETA_TESTING; external state is READY_FOR_BETA_SUBMISSION. This establishes internal TestFlight availability, not the individual tester's installation or a physical transaction.

The same read confirmed 1.2.12 PREPARE_FOR_SUBMISSION with AFTER_APPROVAL and public 1.2.11 READY_FOR_DISTRIBUTION / READY_FOR_SALE. The build-41 device checks remain pending. The next direct owner check is TestFlight 1.2.12 (41) → open the app → Apple subscription → Restore Purchases. Expected active-entitlement message: “Restore complete. Your subscription is active.” Purchase cancellation and fresh free-use checks require an unsubscribed test session; the existing working subscription should not be cancelled or repurchased to exercise Restore.

## App Store draft saved

Guarded draft-only run `6aac553ec4068f7444dda646` finished successfully in 35 seconds from saved verification commit `9d65df523a8994728d238ad17d513c0bd74c3961`. It passed the review-preservation guard, attached build 41 to existing version ID `05285e9d-04f6-49d9-9ff3-ef5dca520ac0`, saved the exact en-GB release notes and verified AFTER_APPROVAL plus PREPARE_FOR_SUBMISSION. The log explicitly confirms DRAFT VERIFIED: 1.2.12 (41) and NOT SUBMITTED pending physical iPhone validation. No existing review was cancelled or withdrawn.

The upload and draft work are complete. The project gate in `docs/app-store/CUSTOMER_JOURNEY_BATCH.md`, enforced by `scripts/submit-staged-iphone.py`, still requires actual purchase, cancellation, restore, free-use and opt-out evidence for this candidate. The build 40 owner reports remain preserved separately. No unavailable check or automated test has been substituted for a physical-device pass.

## Owner Restore confirmation

Following the build 41 instructions, the owner reported: “Restore complete. Your subscription is active.” The active-purchase Restore check is now passed on this candidate. This is owner-reported physical-device evidence. New purchase, purchase-sheet cancellation, fresh free-use and analytics opt-out remain unverified on build 41. No App Review submission has been performed based on this single pass.

## Owner subscribed-analysis and opt-out confirmation

The owner replied “1 & 2: thumbs up” to completing a chart analysis without another subscription prompt and checking that usage counts remain off on build 41. Recorded subscribed-analysis access and analytics opt-out persistence as passed. Together with the earlier Restore pass, this establishes the reported returning-subscriber flow. New purchase, purchase-sheet cancellation and fresh-user free-use remain unverified; no historical purchase pass is relabelled as a new build 41 transaction. App Review submission remains pending those checks under the existing project release gate.

## Explicit owner release exception

Chris replied “No. Can you release it anyway?” after being told that fresh-user free-analysis, new purchase and purchase-sheet cancellation checks remained unverified. This explicitly authorizes submission of build 41 without those remaining manual checks. They stay recorded as not-tested. The exception is bound to version 1.2.12, build 41, its exact web revision and Apple build ID; it cannot authorize a future candidate or override a failed test. Apple processing/identity and active-review preservation checks remain enforced. Automatic release remains AFTER_APPROVAL.
