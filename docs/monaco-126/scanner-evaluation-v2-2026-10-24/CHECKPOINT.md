# Pocket Bullseye: revised scanner evaluation

## Current result — 24 October 2026

**One revised chart has completed; its execution and accounting passed, but its chart geometry failed. The remaining five cases are on HOLD.** A narrow bounds repair is now being prepared offline in an isolated branch. That repair is not yet independently verified and is not claimed fixed in this checkpoint.

The completed result and exact next step are in [execution/FIRST-CASE-OUTCOME.md](execution/FIRST-CASE-OUTCOME.md) and [execution/EXECUTION-CHECKPOINT.md](execution/EXECUTION-CHECKPOINT.md). These supersede earlier scope-approval, branch-permission, missing-key, uninstalled-migration and zero-new-call descriptions.

The owner explicitly approved up to six revised cases, at most USD 1.98 additional inside the existing USD 5 ceiling, beginning with one case and reviewing it before any later case. [Scope approval 6384333029](https://github.com/nashysaimarkets/nash-ai-markets/issues/126#issuecomment-6384333029) and [exact branch/start approval 6384437116](https://github.com/nashysaimarkets/nash-ai-markets/issues/126#issuecomment-6384437116) are recorded and were acted on. No repeat spending or permission request is pending.

## The completed first case

Case `v2-d001`, source case `d001`, attempt `v2-d001-attempt-1`, ran once in [run 40095819408](https://github.com/nashysaimarkets/nash-ai-markets/actions/runs/40095819408), job 120877741515. All three provider responses completed and parsed as JSON. Main used 2,268 output tokens; primary precision used 2,090; rescue used 1,792. Both precision responses exceed the former 1,400-token cap, and the 4,000-token limit allowed this case to finish the diagnostic path.

Completion did not establish placement accuracy. All four raw main levels fail the preserved 1-original-pixel tolerance, with vertical errors of about 42.50, 28.00, 13.50 and 52.50 pixels. The main plot rectangle is inverted. Both precision outputs contain fraction-sized coordinates despite the full-image percentage contract; even a hypothetical multiplication by 100 leaves their anchors and levels outside tolerance. Accepted fallback/calibration code selects invalid main bounds, fabricates a 101% bottom edge and removes every level. The final liquidity chain is blocked. Empty output receives no accuracy or true-negative credit; copied confirmed current price is not an independent visual reading.

The [outcome review](execution/OUTCOME-v2-d001-40095819408-REVIEW.json), [independent original-calibration calculation](execution/GEOMETRY-v2-d001-40095819408-REVIEW.json) and [causal review](execution/CAUSAL-v2-d001-40095819408-REVIEW.json) preserve the distinction between complete provider output, objective geometry failure and deterministic application handling. Pattern/support/resistance/liquidity semantics remain unscored. No held-out evaluation or deployed HTTP latency measurement occurred.

## Source and evidence stay fixed

| Role | Immutable identity |
| --- | --- |
| Evaluated application from draft PR144 | `2812bfbc6e8f62e93d0bc56957fd5ce71cc819dc` |
| Accepted evaluation runtime from draft PR145 | `20783ed5e8eb95a11df86b0d60766ffcbbf4fa79` |
| First-case static evidence | `0d510d37af89e09b0360e1f1a555304d8ba46190` |
| Executed wrapper | `6702f4c153b18b4caa1df82565c8bbf24bfb573b` |
| Plan SHA256 | `cb2a6588759abd36b0cacf5972515dbd2a114d52c9e3224754d01af6b8a3e109` |

The six original images, source inputs, reference coordinates and scoring protocol are unchanged. New case IDs `v2-d001` through `v2-d006` map explicitly to source IDs `d001` through `d006`; none resumes an original attempt. Main remains capped at 7,000 output tokens; precision at 4,000. The model remains `gpt-5-mini-2025-08-07`, default tier, low reasoning effort, structured responses and storage disabled. Rescue eligibility and zero automatic retries remain unchanged.

All six original main request bodies were byte-identical; each of the twelve revised precision/rescue bodies differed only in output cap. [MATERIAL-REVIEW.json](MATERIAL-REVIEW.json), [PLAN.json](PLAN.json) and [PREPARATION-RECEIPT.json](PREPARATION-RECEIPT.json) preserve those preparation facts. The plan’s original HOLD/preparation status is not runtime permission; the recorded owner approval, exact static admission and owner-installed per-run permit supplied the separate execution authority.

## Ledger and cleanup

**The additive v2 migration and first-case admission are already installed and consumed. Do not reinstall, reset, rerun the workflow, replay case 1 or reuse its attempt.** All original history remains unchanged; one new case has three submitted/receipted calls and one completed account, with no unresolved submission or stop.

| Commitment or bound | USD |
| --- | ---: |
| Original six commitments retained | 1.5064 |
| Full first revised-case reservation retained | 0.3300 |
| Current combined commitments | 1.8364 |
| Maximum additional scope originally approved | 1.9800 |
| Original plus all six revised maximum | 3.4864 |
| Existing shared ceiling | 5.0000 |

These are conservative commitments and limits, not actual charges. Actual billed cost remains unknown. The observed first-case usage implies a USD 0.0145015 estimate at the previously verified default prices; this releases no hold. [COST-BOUND.json](COST-BOUND.json) and the recorded [execution price recheck](execution/CURRENT-PRICE-RECHECK.json) retain the price basis. The pinned model’s recorded deprecation does not authorize substitution.

Owner observations after the run verify NOLOGIN and zero sessions. All six temporary environment branch permissions were removed at 13:09:05 UTC. The original branch rule, required owner review, disabled administrator bypass and existing secret values remain intact. The next five cases are unadmitted and held; existing recorded approval is not a command to dispatch them automatically.

Genuine private results are saved separately as recorded in [execution/PRIVATE-RESULTS-ARCHIVE.json](execution/PRIVATE-RESULTS-ARCHIVE.json). The prepared private six-input archive remains 3,198,762 bytes, SHA256 `f3dbd600484f8639f0cc25d31242051efa0a7d99f93789d8ba78a08e8dd06933`, persistent identity `libfile_8978b600f01c8191a7fb222dc24d104f`. This documentation publishes no provider bodies, chart inputs, private keys or live transport URLs.

## Reuse completed engineering evidence

Exact runtime source `20783ed5e8eb95a11df86b0d60766ffcbbf4fa79`, tree `3f4c1742692db36257237fe35a0e780077098e00`, passed [free CI 40093995597](https://github.com/nashysaimarkets/nash-ai-markets/actions/runs/40093995597), job 120872330390: **44 offline tests across seven suites plus 14 disposable PostgreSQL 17 scenarios**, zero failures or skips. The secret-pattern check passed across 1,396 candidates. [FREE-CI.json](FREE-CI.json), `ci/`, [FINAL-INDEPENDENT-ACCEPTANCE.json](FINAL-INDEPENDENT-ACCEPTANCE.json) and [SOURCE-IDENTITY.json](SOURCE-IDENTITY.json) preserve that source-specific evidence, including earlier failures and their fixes. Those preparation tests used synthetic responses and localhost PostgreSQL, not paid scanner answers.

The [protected-path rehearsal](INDEPENDENT-PROTECTED-CONTROL.json) used the original private first-case input with fake SQL/provider/artifact effects and one documented in-memory fingerprint substitution. It remains a rehearsal, distinct from the now-completed genuine run. It was not repeated for this outcome publication.

The prior app acceptance remains [run 40091820993](https://github.com/nashysaimarkets/nash-ai-markets/actions/runs/40091820993): 147 affected tests, 12 actual Chromium lifecycle checks, project typechecking and production compilation. [Image-source run 40091824575](https://github.com/nashysaimarkets/nash-ai-markets/actions/runs/40091824575) used the same app source. These engineering proofs do not grant scanner semantic or held-out acceptance.

## Resume

Continue the isolated offline repair with the retained case. Keep the evaluated runtime, paid result and original oracle immutable. Independently review the new bounds behavior and its user-visible consequences before considering another admitted case. A fail-closed bounds fix by itself is not accurate pixel extraction.

Read the latest Issue126 claim before writes; root remains the sole integration/execution writer under claim 6384437116 until explicitly released. No tests were rerun for this documentation bundle. No production deployment, main merge, store release, new credential or schedule change occurred in this first-case continuation. Schedules remain OFF.
