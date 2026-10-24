# First revised scanner case: execution complete, geometry failed

**The first revised chart completed. The other five paid cases are on HOLD while the demonstrated geometry defects are repaired offline.** This is one measured development case, not scanner accuracy acceptance.

## Exact run and evidence

Case `v2-d001` / source `d001` / attempt `v2-d001-attempt-1` ran once in GitHub run **40095819408**, job **120877741515**, and completed successfully on 24 October 2026 at 13:01:03 UTC. Its wrapper is `6702f4c153b18b4caa1df82565c8bbf24bfb573b`, accepted evaluation runtime is `20783ed5e8eb95a11df86b0d60766ffcbbf4fa79`, and static evidence commit is `0d510d37af89e09b0360e1f1a555304d8ba46190`. The evaluated app remains `2812bfbc6e8f62e93d0bc56957fd5ce71cc819dc`.

The [independent outcome review](OUTCOME-v2-d001-40095819408-REVIEW.json) reconciles the official run, all output archive/envelope/raw hashes, actual submissions and receipts, completed accounting, and cleanup. [Sanitized official run](OFFICIAL-RUN-SUMMARY.json), [job](OFFICIAL-JOB-SUMMARY.json) and [artifact](OFFICIAL-ARTIFACT-SUMMARY.json) metadata preserve their original source-file hashes without publishing download or transport URLs.

## Completion improved; placement did not

| Pass | Output cap | Actual output tokens | Provider result |
| --- | ---: | ---: | --- |
| Main | 7,000 | 2,268 | Completed; JSON parsed |
| Primary precision | 4,000 | 2,090 | Completed; JSON parsed |
| Rescue precision | 4,000 | 1,792 | Completed; JSON parsed |

Both precision responses exceeded the former 1,400-token limit. The revised budget allowed this case to reach the completed diagnostic path. That observation does not establish completion or accuracy on the remaining cases.

Four raw main levels missed their original image rows by **42.4994, 28.0006, 13.5000 and 52.5006 pixels**. All four fail the unchanged **1-original-pixel tolerance**. Its two axis anchors miss by 40.0000 and 52.5006 pixels. The [independent geometry review](GEOMETRY-v2-d001-40095819408-REVIEW.json) recalculated those errors from the preserved calibration, without changing the image, oracle or tolerance.

The [causal review](CAUSAL-v2-d001-40095819408-REVIEW.json) identifies both incorrect provider geometry and defective application handling. Both precision responses supplied fraction-sized coordinates despite instructions for full-image percentages. A hypothetical multiplication by 100 still leaves every precision anchor and level outside tolerance; that conversion was analysis only and was not applied to any response or score.

The main response separately supplied inverted bounds, with top 100 and bottom 20. Both precision scales fail the existing span check. The fallback then accepts the main scale from its two ordered anchors without validating its plot rectangle. Calibration computes `max(top + 1, bottom)` and creates bottom **101**, outside the image, then removes all levels. The result retains incorrect anchors and model-derived scale readability. Postprocessed output contains **zero levels**, and the liquidity chain is blocked by `PLOT_BOUNDS_UNVERIFIED`.

Zero retained levels is not evidence of correct absence. The zero current-price error comes from copied user-confirmed metadata, not an independent visual reading. Pattern, support/resistance and liquidity semantics remain unscored. The original 44 held-out cases were not read or executed.

## Accounting and cleanup

The owner ledger contains one new claim, one completed account, three submissions and three receipts; there are no missing receipts, stops or revocations. The original six-case history remains unchanged at digest `4031aa388eecdac651a539a1af5ed861f0edc1944c748917001ba6546e4c2e64`. See the [ledger summary](LEDGER-RECONCILIATION-SUMMARY.json).

| Accounting item | USD |
| --- | ---: |
| Original commitments preserved | 1.5064 |
| Full first revised-case reservation retained | 0.3300 |
| Combined commitments | 1.8364 |
| Remaining below the shared ceiling | 3.1636 |
| Shared ceiling | 5.0000 |

Actual billed cost remains unknown. The recorded 8,806 input and 6,150 output tokens imply a **USD 0.0145015 usage-price estimate** at the previously verified public default rates; this is not a billing attestation and releases no hold. The observed sequential diagnostic execution was approximately **57.78 seconds**, including its accounting and retention work. Deployed HTTP latency was not measured.

[Runner cleanup](CLEANUP-v2-d001-40095819408.json) verified NOLOGIN, zero sessions, zero memberships and restricted privilege flags at 13:01:35 UTC, corroborated by the 13:01:59 owner reconciliation. [Temporary branch permission cleanup](BRANCH-PERMISSIONS-CLEANUP-v2-d001.json) removed all six temporary rules at 13:09:05 UTC. The original branch rule and required owner review remain; administrator bypass remains disabled and secret values were unchanged.

Genuine responses and diagnostics are retained in the [private archive](PRIVATE-RESULTS-ARCHIVE.json). This publication contains sanitized measurements and receipts, not provider bodies, chart inputs, private keys or live transport URLs.

## Next action

Keep `v2-d002` through `v2-d006` on HOLD. A narrow bounds repair is being prepared on an isolated branch using these retained bytes. **That repair is not yet independently verified and is not claimed fixed here.** Preserve the frozen evaluation runtime, original diagnostic tolerance, raw responses and financial history. No new spending or permission request is pending from this first-case review.

**The v2 migration and first-case admission have already been executed. Do not reinstall, reset, rerun this workflow, replay this case, or reuse its attempt.** Any later case requires its own current identity, evidence and operator reassessment; no later case is admitted by this outcome.
