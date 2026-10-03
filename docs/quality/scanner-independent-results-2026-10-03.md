# Scanner delivery repair — 3 October 2026

## Reproduced fault
An original US 500 DFB 30m screenshot passed preflight. Precision completed in 13.584 seconds; the written report exhausted its output allowance and recovery deadline, returning HTTP 503 and discarding finished scans. Do not confuse a delivery fix with measured semantic accuracy.

## Changes
Numeric wire fields use bounded numeric text decoded and validated back to their original numeric types. Required fields, model choices, report reasoning, source roles and original ranges remain enforced. Incomplete JSON is rejected. Precision independently reads timeframe, chart quality and a primary pattern. Completed precision survives a failed narrative through a separate scanner result carrying no invented verdict, score or trade plan. Original chart display, endpoint checks, cancellation and native access safeguards remain.

## Validation before preview
Typecheck; 1,149 unit tests; 26 render tests; production build and rendered HTML check passed. Tests cover invalid numeric output, missing evidence, conflicting identity/timeframe, report failure, native unlock failure and stale chart sessions. Preview browser verification is pending; no production or Apple release claim.

## Evidence direction
Structured Outputs documentation requires explicit handling of incomplete output. Vision documentation warns about exact spatial localization. Exact broker candles plus independently labeled holdout charts are the stronger future foundation. Screenshots can support hypotheses about stop-risk areas, not establish hidden resting orders. Landscape alone does not resolve delivery or interpretation.

References: https://developers.openai.com/api/docs/guides/structured-outputs ; https://developers.openai.com/api/docs/guides/images-vision ; https://labs.ig.com/rest-trading-api-reference.html ; https://arxiv.org/abs/2503.23131
