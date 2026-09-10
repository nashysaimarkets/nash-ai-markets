# Pocket Bullseye precision-preserving speed work

## Scope and preserved interface

The user approved backend speed work and explicitly prohibited layout changes. Native PocketBullseye JSX was compared through the TypeScript AST against the accepted 394a7dc version: every layout expression is byte-for-byte identical. No CSS, page layout, upload control or cinematic sequence changed.

## Implemented

- Full-report Fast and full-report parallel Fast profiles preserve Sol medium reasoning, Terra low reasoning, the complete strict report schema, all precision checks and existing timeout/recovery budgets. They do not use compact report expansion.
- Reusable precision receipts are authenticated with a purpose-separated HMAC. They bind the exact screenshot bytes, annotation model, confirmed current price, precision instructions and schema. Receipts expire after 15 minutes. Only complete evidence with no precision-rescue reasons is issued after an identity-verified result. Every reused result passes the same checks again; calibration and final trust gates still run.
- Corrections bypass receipt reuse; clarity crops also require fresh extraction. Edited screenshots, changed models/prompts, expired receipts and modified signatures cannot reuse evidence. No shared image cache is introduced. Receipts remain in the current browser session.
- Deterministic browser measurements are reused for unchanged screenshots, with the source role rebound to the selected image. The session cache holds at most five measured images.
- A single work queue shares an in-flight timeframe request. Selecting another timeframe cancels unrelated background work and puts the selected timeframe first. Reset aborts old work; stale results cannot replace a newer session.
- Other uploaded reports prepare while the first result is visible. This is limited by the normal scan allowance, reserves the last request for an explicit action, pauses before starting work in hidden tabs and requires an active subscription inside the native Apple app. It never opens a background paywall or consumes the free Apple analysis.
- Completed timeframe reports are reused by the existing selector. A timeframe still being prepared may require a wait. The four-request service allowance was not increased or bypassed; background preparation cannot promise all five timeframes at once.
- Existing targeted report and precision recovery is retained. The full report continues to examine the supplied screenshots; the new reuse specifically avoids repeated precision extraction and browser pixel measurement.

## Validation

989 unit tests (including two integration tests) and 12 rendering tests passed. The integration tests exercise the real route's signed-reuse path and the actual background effect's entitlement/allowance checks. TypeScript and the Sites build passed. Native preview 3a9ac24f7df31b72d889f9f8aa4fb0e66928f594 built successfully.

The real-chart trial uses the two previously approved customer screenshots through the new project preview and existing AI provider. Raw screenshots, precision receipts and private reports are not committed to this repository. Only aggregate performance and validation findings may be added below.

## Rollout criteria

Compare baseline, full-report Fast, full-report parallel Fast and a switched primary with signed evidence. Verify exact source identity/timeframes/current-price markers, source-owned geometry, visible indicator absence, full report fields, final gates and actual provider tiers. Do not claim general accuracy or p95 from one pair. Publish an accelerated default only after checking the results; preserve baseline as an operator rollback setting.

## Completed trial and selected default

One approved real-chart pair, four sequential requests on the same deployment on 9 September 2026. Each request used the normal service allowance and returned HTTP 200. Fresh runs supplied no precision receipts; provider prompt caching still varied between runs.

| Mode | Client round trip | Server scan | Provider responses |
| --- | ---: | ---: | ---: |
| Baseline | 186.48 s | 170.74 s | 3 plus one timed-out attempt |
| Full-report priority, sequential | 96.05 s | 82.42 s | 3 |
| Full-report priority, parallel | 49.38 s | 37.21 s | 3 |
| Switched primary, verified precision reuse | 63.71 s | 52.59 s | 1 |

The parallel result was 73.5% faster in this trial. This is not a latency guarantee: the baseline included timeout recovery, prompt-cache hits differed, and only one pair was tested. There is no five-chart or p95 claim.

All priority responses actually returned the priority service tier. Full-report parallel is now the default; POCKET_SCAN_PROFILE=baseline is the operator rollback. Models, reasoning settings, strict full-report schema, precision calibration and final trust gates are preserved. No compact transport is enabled by default.

The switched result had the correct selected timeframe/current-price marker and reused both primary and context extraction, confirmed by route diagnostics and exactly one provider response. It still needed 52.6 seconds of report generation. Background preparation removes that wait only when the requested report has finished. Context with missing identity remained excluded under the existing compatibility rule. The parallel result passed identity, scale and two-sided level checks; this verifies retained safeguards, not independent proof of perfect analysis or identical model geometry.

Corrections and explicit refreshes also rotate the full-report cache namespace, preventing earlier stored reports from reappearing in other timeframe selections after an evidence correction.

Paid processing and background report preparation may increase spend. Baseline token accounting is incomplete because the timed-out attempt returned no usage, so no cost-saving percentage is asserted. No rate limits, entitlements or Apple submission configuration changed.
