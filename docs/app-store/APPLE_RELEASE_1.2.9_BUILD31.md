# Pocket Bullseye 1.2.9 build 31 — release workflow queued

Verified 10 September 2026. The user approved opening Codemagic, replacing the pending Apple submission, and automatic release after Apple approval.

## Exact release

- Native build revision: `c6e45bad3cb43f67b828e9e50802411f1552f929`.
- Release branch: `release/pocket-ios-1.2.9-build31`.
- Web revision: `51c260fa80d40e47f94d1d9796f0eff2e0b94a16`.
- Vercel deployment: `dpl_2xDyeUVFwbwRptPuBd8THAggvGoz` (READY).
- Pinned URL: https://nash-ai-markets-q0asynfvc-nash-ai-markets.vercel.app/pocket
- The deployed build manifest returned the exact web revision.
- Codemagic release run: https://codemagic.io/app/6a90a2752815719e2161c656/build/6aa2dfe401c07ed7df662080
- Workflow `pocket-bullseye-ios-testflight`, display name “Pocket Bullseye — iOS TestFlight”, is the existing App Store publisher. Its checked configuration uses `submit_to_app_store: true`, `cancel_previous_submissions: true`, and `release_type: AFTER_APPROVAL`.

## Verification

- All 1,026 unit tests, TypeScript and modified-file lint pass.
- Full GitHub quality gate passed on the exact native revision: https://github.com/nashysaimarkets/nash-ai-markets/actions/runs/34500959740
- Live deployed preflight returned HTTP 200 / READY for two clearly labelled fictional DEMO INDEX illustrations (5M and 1H); both timeframe checks and instrument matching succeeded.
- Preflight server time: 5,055 ms. Request elapsed time including transport: 24.16 seconds.
- Live deployed full-parallel analysis returned HTTP 200, a complete 45-field analysis, both chart contributions and two patterns.
- Scan ID: `5cae9ff6-cb0d-40e6-9d3b-8cb1c254301c`.
- Analysis server time: 49,121 ms. Request elapsed time including transport: 71.19 seconds.
- Provider report completed without recovery; both precision passes and their rescues completed. Vercel recorded outcome `completed`, failure `null`.
- The synthetic fixtures lack a current-price marker. Current price remained unknown and context structural geometry was not confirmed. This test verifies live service completion, not real-market accuracy or the original five-image pack.
- The browser file chooser did not deliver an upload; verification used the public deployed API without credentials or fabricated entitlements. A separate attempt to use previously uploaded real trading charts was blocked by automatic approval review; the successful run used only inspected fictional illustrations.
- Five-image report-gap, active-recovery and absolute-deadline behaviour are covered by controlled timer regression tests documented in `docs/pocket-scan-completion-2026-09-10.md`.

## Apple state and submission

The read-only Apple status workflow completed at approximately 16:43 UTC:
https://codemagic.io/app/6a90a2752815719e2161c656/build/6aa2dc06b63daf86992dad05

It confirmed version 1.2.9 was IN_REVIEW with build 30 as the latest build and release type AFTER_APPROVAL. Version ID: `e84630c1-fac3-4229-b5e6-fe47ef722dd6`. Build 30 ID: `8253432b-54b1-4474-a78f-6a7efc19fd47`.

Build 31 release run `6aa2dfe401c07ed7df662080` is queued at the exact native revision above. Do not claim an App Store upload, acceptance, new review submission, or public release until its publishing and App Store distribution logs confirm them.

The earlier Codemagic access hold was superseded by explicit user approval. A later automatic-review objection to the workflow display name was resolved by reading the exact release branch configuration and verifying its App Store publishing settings before the successful start.
