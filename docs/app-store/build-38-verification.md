# Pocket Bullseye 1.2.12 (38) — candidate preparation

Prepared 17 September 2026. Build 38 is not yet uploaded, submitted or tested on an iPhone.

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
