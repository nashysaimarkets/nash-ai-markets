# Pocket Bullseye 1.2.12 (36) — release checkpoint

Prepared 17 September 2026 following the owner’s request to update the Apple app after approving the full scanner promotion.

## Exact source and Apple state

- Web revision: `7b653be5a5da4ac03ff2eadc75c6860e33f3c97e`, the complete titanium/scanner upgrade from PR 84.
- Immutable deployment: https://nash-ai-markets-nbjyp5jnj-nash-ai-markets.vercel.app/pocket
- The release verifier confirmed the exact served manifest revision before preparation.
- Read-only Codemagic job `6aaba90067323faef997c249` on 17 September confirmed 1.2.11 released, 1.2.12 in PREPARE_FOR_SUBMISSION, and build 35 VALID/unexpired. No version is being withdrawn.
- Build 36 supersedes the unsubmitted build 35 candidate with the complete visual upgrade. The installed released client remains pinned to its reviewed revision.

## Validation and submission boundary

Use `pocket-bullseye-ios-stage-next` for the signed upload. It runs dependency, type, unit, security, build, immutable revision, Capacitor sync, signing and archive gates. It does not submit to review.

The customer-journey batch requires an iPhone/TestFlight check of purchase, cancellation, restore, free-use consumption and analytics opt-out. That physical-device check has not been observed and must be completed before App Review submission. App Store analytics privacy disclosures were reconciled on 15 September; verify if the data collection changes.

The guarded submission script retains automatic release after approval and preserves existing reviews. Populate staged-release.json only from the actual build and Apple processing result. Uploaded, submitted and released are separate states.

No physical-device testing, Apple approval, accuracy improvement or profit claim is implied by the promotional video. Its screenshots show the latest web UI with illustrative data.

## Signed upload completed

Codemagic build `6aabac25628e157fb1f8e449` built commit `6eab8f533258bf1a6034a2a7fa62edf84b9ff023` in 4m 1s. All 1,064 native unit tests passed, with zero failures. Type checking, secret-pattern scan (1,018 candidates), production build, immutable pin verification, Capacitor sync, signing and archive succeeded.

Apple accepted 1.2.12 (36) at 2026-09-17 09:05:54 UTC with no upload errors. Build/delivery ID: `b88d0cc0-f0ba-43be-b41c-69bc29c3c618`. Codemagic then found the build after processing and updated its en-GB TestFlight localization `195fba7d-dd6c-4947-81ce-91ec889ea9c2`.

This run did not submit to App Review. The physical iPhone checklist above remains outstanding.

Read-only status run `6aabb15c6d7a3277fbd1a812` confirmed build 36 `VALID`, unexpired, uploaded at 2026-09-17T02:07:37-07:00. Version 1.2.12 remains `PREPARE_FOR_SUBMISSION`; 1.2.11 is still the public release. The new build is available in TestFlight, not submitted or publicly released.

App Store Connect browser authentication did not complete. Do not claim that the App Store draft’s selected build, public release notes, screenshots or preview video were changed. The revised notes were saved to the TestFlight build successfully. The 60-second social promotion is not an Apple App Preview upload.
