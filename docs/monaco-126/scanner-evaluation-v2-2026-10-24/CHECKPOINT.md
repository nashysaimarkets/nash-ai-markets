# Pocket Bullseye: revised scanner evaluation

## Current state

The app repairs are implemented and independently checked in [draft PR144](https://github.com/nashysaimarkets/nash-ai-markets/pull/144). This successor prepares a separately identified evaluation of that exact app source. It does not change the app or declare its chart accuracy accepted.

Preparation has produced six private, single-chart bundles and 18 exact possible request bodies. No provider request or hosted database call was made for this preparation. Paid execution remains **HOLD pending a new, explicit scope approval** and the final named-run admission. The new ledger migration is proposed code only and is not installed.

The app source tested in PR144 is `2812bfbc6e8f62e93d0bc56957fd5ce71cc819dc`; its final documentation checkpoint is `b118c7a38a35514eb4cbd4cc86b3341de91a5ca5`. The successor begins from that checkpoint and leaves the app files unchanged.

## What is being compared

The six original chart images, source inputs, reference coordinates and scoring protocol are preserved. Fresh attempt IDs are `v2-d001` through `v2-d006`, each mapped explicitly to source chart `d001` through `d006`. None resumes or resets an original send identity.

The precision output cap is 4,000 tokens; the main cap remains 7,000. The model snapshot remains `gpt-5-mini-2025-08-07`, with the default service tier, low reasoning effort, structured responses and storage disabled. The exact repaired source supplies the request bodies and response handling. Incomplete model responses are retained as evidence, not parsed as completed results. Existing rescue eligibility remains unchanged, with at most one rescue per case and no automatic retries.

The new evaluation must establish whether responses complete and whether the resulting coordinates meet the unchanged original-image diagnostics. A syntactically complete response, a successful test suite, or an empty result does not establish geometric or semantic accuracy. Pattern/support/resistance interpretation still lacks independent semantic labels; this work cannot award semantic acceptance or true-negative credit.

## Scope and cost

[Original owner approval 6165012632](https://github.com/nashysaimarkets/nash-ai-markets/pull/112#issuecomment-6165012632) allowed six runs under a cumulative USD 5 ceiling. Those six runs are complete. The next evaluation therefore requires a scope extension; the original six-run approval is not reused as permission for six more runs.

| Item | Conservative maximum |
| --- | ---: |
| Original six commitments retained | USD 1.5064 |
| Each new named case, including optional rescue | USD 0.3300 |
| Up to six new cases | USD 1.9800 |
| Original plus proposed new maximum | USD 3.4864 |
| Existing cumulative ceiling | USD 5.0000 |

These are reserved upper bounds, not a statement of actual charges. No original hold is released, no historical receipt is rewritten, and no second allowance is created. The proposed ledger retains the full USD 0.33 hold for every claimed case, including an unused rescue or an ambiguous outcome. It serializes old and new financial changes against the same original allowance.

The price calculation and source URLs are recorded in [COST-BOUND.json](COST-BOUND.json). Current official model documentation lists the pinned snapshot as deprecated; no replacement model is silently selected. Availability and price must be checked again before execution.

## Concrete prepared material

- [PLAN.json](PLAN.json), SHA256 `cb2a6588759abd36b0cacf5972515dbd2a114d52c9e3224754d01af6b8a3e109`, contains only identities, hashes and bounds. It is explicitly not execution authority.
- [PREPARATION-RECEIPT.json](PREPARATION-RECEIPT.json) records all six bundle hashes and 18 scoped request pins. Raw chart images, request bodies and source data remain private.
- Private input archive: `pocket-bullseye-scanner-evaluation-v2-prepared-inputs-2026-10-24.zip`, 3,198,762 bytes, SHA256 `f3dbd600484f8639f0cc25d31242051efa0a7d99f93789d8ba78a08e8dd06933`. It contains nine files and no credentials or result-decryption key. Persistent identity: `libfile_8978b600f01c8191a7fb222dc24d104f`.

## Execution boundary

The entry accepts one named case per invocation. A future owner scope approval must identify the new evaluation, retained cumulative ceiling and maximum additional exposure. Separately reviewed admission must bind the exact executable source, plan, runtime, existing project/key identity, input bundle, output recipient, workflow run/job and first attempt. Missing or conflicting evidence returns HOLD before client or credential use.

The database must enforce the same binding again before every submission. A claim can be consumed once. A submitted call with an unknown outcome keeps its hold and cannot be retried or resurrected. The next case requires retained provider receipts, a retained diagnostic, conservative accounting and a new operator reassessment. Revocation, cancellation, expiry and disagreement stop further dispatch.

The hosted path reuses the accepted locked SDK versions, TLS settings and authenticated encryption. New evaluation metadata is inside the authenticated retained payload. An original source chart ID may label a physical encrypted artifact, but never substitutes for the new evaluation or attempt identity. Old bare payloads cannot count as new evaluation receipts.

## Verification and remaining work

Free acceptance is in progress. The new workflow uses only synthetic requests and disposable localhost PostgreSQL 17, with no protected environment or provider/hosted database secrets. Its strict TAP verifier rejects failed, empty, cancelled or skipped suites. Final CI and independent-review receipts will be added after the complete implementation is frozen and checked.

The prior app acceptance remains [run 40091820993](https://github.com/nashysaimarkets/nash-ai-markets/actions/runs/40091820993): 147 affected tests, 12 actual Chromium lifecycle checks, project typechecking and production compilation. [Image-source acceptance 40091824575](https://github.com/nashysaimarkets/nash-ai-markets/actions/runs/40091824575) used the same executable tree; paid corpus accuracy remained untested. These results are not new live scanner results.

No production/main deployment, new credentials, hosted database activation, additional corpus cases or schedule changes are part of this preparation. Schedules remain off. The last independently recorded runner state is NOLOGIN with zero sessions after the original six-run cleanup; this preparation has not changed it.
