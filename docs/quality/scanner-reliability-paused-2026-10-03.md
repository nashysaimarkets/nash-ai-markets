# Scanner reliability — paused at user request

Paused 3 October 2026 at approximately 20:08 Europe/London. Do not resume implementation, scans or deployments until the user requests it.

## Saved state

Base commit: 91379c9ecc8d48d4dd115987bc9221f69f807e75. Current verified code preview remains https://nash-ai-markets-89t46euw1-nash-ai-markets.vercel.app/pocket . Latest change is unfinished and untested: app/api/pocket/report-transport.ts adds optional bounded numeric text and optional preservation of semantic keys. It is NOT wired into the report or precision routes. Default behaviour remains unchanged. No calibration, confidence, source, entitlement or pixel threshold was changed.

The attempted edit exporting calibratePatterns failed to match the patch; that file was not changed. No independent-scanner API payload or UI implementation exists yet. No subagent/Astra was used. The user asked whether Astra is needed; response was that changing models alone cannot fix the pipeline, and fixes require measured evidence.

## Reproduced failure

Original US 500 (DFB) 30m browser upload passed preflight with current price 7723.23, but the full report failed. Runtime logs for deployment dpl_EDDNoZ52h51QteTpTjg6aMQ2sMak show precision complete at 13,584ms; report ended incomplete at 72,712ms, max_output_tokens, 14,000 output tokens and 2,922 output characters. Slow-report recovery started at 60,351ms. Recovery timed out at 110,352ms; API returned 503. Precision and report are joined with Promise.all, discarding completed precision on narrative failure. Existing private evidence archive includes original local replays and browser failure screenshot.

The local replay previously proved one US 500 30m liquidity candidate passes original axis/candle placement checks; Oil 4h third touch misses by 2.0416 pixels vs 2-pixel strict limit. Both reported patterns were LOW confidence. These are limited placement diagnostics, not general accuracy or native/browser positive overlay validation.

## Proposed implementation, not yet completed

1. Constrain numeric wire representation while preserving finite numeric values, numeric ranges, all report fields, complete-response validation and existing response types. Review bounded transport carefully: parent compile currently overwrites child descriptions; numeric hints must survive. Add meaningful round-trip, overflow/underflow, wrong type, integer/range, chunk and model-schema tests. Do not round or repair uncertain values.
2. Preserve completed independently source-bound scanner results when a long narrative fails. Return a separate narrow scanner result, never a fabricated full Analysis, grade, verdict or partial narrative JSON. Extend the precision schema with explicitly independently read timeframe/evidence quality and at most one primary pattern if needed; existing precision lacks them, so cannot safely label it a finished pattern scan now.
3. Apply current identity/timeframe/scale/candle gates to standalone results. Keep the exact source image association and reset on upload, source/correction changes, cancellation or stale session. Never trust browser-supplied metadata alone. Preserve Apple free-use and subscription gating before exposing useful scanner results.
4. Consider a separate pattern viewer rather than synthesizing missing Analysis fields. LiquidityGuardOverlay already accepts a narrow geometry source. Reuse strict pattern pixel checks; do not weaken the two-pixel rule to populate results.
5. Verify completed report and independent-scanner failure paths using actual originals without repeated retries until a favourable result. Existing release HOLD remains; no native or production promotion.

## Primary sources reviewed this turn

- https://developers.openai.com/api/docs/guides/structured-outputs : incomplete max_output_tokens responses must be handled; string pattern and numeric bounds are supported.
- https://developers.openai.com/api/docs/guides/images-vision : exact spatial localization and resized images remain limitations.
- https://arxiv.org/abs/2503.23131 : RefChartQA studies grounding chart answers; general chart research does not establish trading-scanner accuracy.

The investigation skill was read and used for runtime-log triage. No further tests or deployment of this unfinished change were performed before pausing. Resume from this checkpoint rather than repeating scans or claiming reliability resolved.
