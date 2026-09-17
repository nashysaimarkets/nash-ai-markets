# Pocket Bullseye 1.2.12 (38) — candidate preparation

Verified 17 September 2026. Build 38 is uploaded, VALID and active in internal TestFlight. It has not been submitted to App Review or physically validated on an iPhone.

## Verified source and Apple state

- Web revision: `fea69217e6855ba6c161a782ae8027f953682c31`.
- READY immutable deployment: `dpl_B25udymh7Ttp3L6YxCkjNEEKZQAX`, https://nash-ai-markets-hqg42hl69-nash-ai-markets.vercel.app/pocket.
- The exact served build-manifest revision passed `scripts/verify-capacitor-server.mjs` at 17:57 UTC on 17 September.
- Read-only Apple status run `6aac2a4ea07116fe7f0f0c76` confirmed the latest uploaded build was 37, VALID and in internal TestFlight. Version 1.2.12 remained `PREPARE_FOR_SUBMISSION` with release after approval; 1.2.11 remained public. No review was active or withdrawn.

## Change and recovery evidence

For known native access with the free analysis consumed and no active subscription, the main Unlock button opens subscription options immediately. Opening this screen no longer requires an uploaded chart, privacy consent, successful AI preflight or another Apple status lookup. Actual chart analysis retains its privacy, preflight and refreshed entitlement checks.

Known locked access no longer mounts the automatic chart preflight. Preflight resumes after successful unlock. The Apple purchase implementation and the one-free-use entitlement remain unchanged from build 37.

At `2026-09-17T17:58:26Z`, a fictional synthetic chart submitted through the normal app web interface on build 37's pinned deployment returned `/api/pocket/preflight` HTTP 200, `READY`, in 5585 ms. This confirms recovery from the earlier provider quota error for that one request. It does not prove a complete analysis, sustained capacity, chart accuracy or successful Apple payment.

The UI fix passed 22 focused existing tests, TypeScript checking and a temporary behavior check of the actual JSX: direct subscription opening, locked preflight suppression, resumption after unlock, six analysis prerequisites and review gating.

## Staging and submission boundary

Use `pocket-bullseye-ios-stage-next` on `fix/pocket-apple-purchases-2026-09-17`. It runs the existing dependency, type, unit, security, build, immutable-pin, Capacitor, signing and archive gates and uploads without App Review submission. Record the resulting native build commit separately from the pinned web revision.

Populate current Apple build and workflow identifiers only after the actual upload and processing result. Historical build 36/37 observations in `staged-release.json` are not validation of build 38.

Purchase, cancellation, restore, free-use consumption and analytics opt-out must all pass on this exact iPhone/TestFlight candidate before the guarded submission workflow can submit it. The physical purchase result and the phone's displayed currency remain unverified. Preserve any review that begins in the meantime and retain automatic release after approval.

## Upload and recovery verification

- Native build commit: `493c347fd4a53bc87e389fa7a110a6279919bca6`.
- Staging run: `6aac2b7d8631ce102a5d2a44`; Apple accepted the archive without errors at 18:08:13 UTC.
- Apple build ID: `1ba601b6-8de1-4200-84c6-0fba538ddb1e`.
- Read-only verification run `6aac2cf56cc33efcef3a6270` confirmed version 1.2.12 (38), VALID, unexpired, internal `IN_BETA_TESTING`, external `READY_FOR_BETA_SUBMISSION`. Version 1.2.12 remains an editable draft; 1.2.11 remains public.
- All 1,068 unit tests, type checking, secret-pattern scan, web build, served revision verification, Capacitor sync, signing, native archive and upload passed.
- The subsequent full fictional-chart analysis on build 37's pinned deployment also returned HTTP 200 and rendered the completed report. Server logs record completed precision and report, outcome completed, in 38,246 ms. This establishes service recovery for that test, not physical StoreKit validation or a trading-accuracy benchmark. Calendar context remained partial; no complete-calendar claim is made.

All five required physical-device checks remain not tested on build 38. No review was withdrawn and no App Review submission was made.

## Owner follow-up — 17 September, 19:19 BST

The owner reported “Still no change” and supplied `732E8AD7-DFE2-46C6-BC50-50D6E4272A0B.jpeg`. The paywall shows Apple's USD 4.99 metadata, the test-environment notice and enabled Subscribe/Restore buttons, without a pending state or error. The screenshot does not establish the installed build or show the outcome of a Subscribe tap. Treat the customer journey as unresolved; build upload and service recovery are not purchase validation.

Build 38's pinned deployment received successful `/api/pocket/activity` requests at 18:19:00, 18:19:20 and 18:19:46 UTC. These requests have no event names or device identity in the runtime logs and cannot be attributed to this phone.

A read-only query of the production-linked anonymous daily aggregates for 17 September and platform `apple` returned: 8 app opens, 8 paywall views, 3 purchase starts and 3 incomplete purchases. No completed-purchase, failed-purchase or completed-restore rows were returned. These are daily counts across clients, with no event timestamps or build identifiers. `is_test=false` is an analytics flag, not evidence of real payments; native TestFlight status is not propagated into it. An incomplete result can mean cancellation or a returned inactive entitlement. Do not infer that this owner cancelled, that build 38 failed three times, or that Apple displayed a purchase sheet.

The audited paywall handler, action coordinator, bridge registration, Swift purchase flow and hit-testing styles did not establish a new defect. No speculative code change or replacement binary was prepared. The next needed evidence is one short recording showing the installed TestFlight version/build, opening the app, tapping Subscribe once and waiting at least 15 seconds for a prompt, pending state or error. Do not record credentials. All five physical-device release checks remain incomplete.
