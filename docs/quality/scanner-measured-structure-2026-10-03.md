# Scanner measurement investigation — 3 October 2026

## Result and delivery

Portrait orientation is not the demonstrated cause. All ten supplied original PNGs (1179×2556) contain measurable candle components. The user-visible update adds original-screenshot capture guidance, accepts portrait and landscape, gives repairs from preflight quality flags, and identifies the failed liquidity touch. The existing strict drawing requirements remain unchanged. An experimental measured-swing detector is isolated under `prototype/chart-extraction/`; it does not drive customer drawings.

The previous inline source-chart visibility fix remains included. Preview only; installed iPhone clients stay on their reviewed deployment. Accuracy and native release validation are still incomplete; do not promote this as a perfected scanner.

## Exact original-chart replay

Two fresh, one-shot analysis requests against the known preview were successful (HTTP 200), without retries to obtain a favourable result. They used original screenshots but did not reproduce the browser preflight/ruler path. Independent local OCR and original-raster checks then replayed the actual drawing gates:

| Source | Measured components using report bounds | Independently verified axis labels | Reported pattern | Liquidity result |
| --- | ---: | ---: | --- | --- |
| US 500 DFB, 30m | 65 | 7 | Bull flag, LOW | One HIGH candidate at 7728.5–7730.5 passes local price/side/candle checks |
| Oil US Crude DFB, 4h | 168 | 12 | Descending triangle, LOW | HIGH candidate at 8750–8800 held: touch 3 differs from the measured endpoint by 2.0416 original pixels |

Both patterns remain undrawn because LOW confidence does not satisfy the pattern gate. The oil tolerance is 2 original pixels. The first two touches differ by approximately 0.437 and 0.254 pixels; the third fails. US 500 touch errors are approximately 0.218, 0.630 and 0.272 pixels. These are placement checks, not proof of actual orders, classification accuracy, or predictive value. The local US 500 success is not a browser or iPhone end-to-end pass.

A separate manually bounded diagnostic replay found 59–65 US 500 components and 165–210 oil components per image. The measured-swing prototype finds 6–22 local swings per chart; repeated swing bands are found in four of the five oil charts and none of these US 500 charts. These are unlabelled historical structures, not named patterns or verified liquidity. Manual bounds, clipped edge candles, missing body widths and no annotated ground truth prevent a recall claim. No threshold was lowered just to force drawings.

## Recommended architecture

1. Prefer authoritative OHLC from the exact broker instrument, timeframe, timestamp/session and bid/ask/mid basis. IG documents historical price endpoints keyed by instrument EPIC and resolution. Do not substitute futures or index data for the displayed DFB quote. Historical quota/licensing and instrument entitlement must be established before connecting a feed.
2. For screenshots, detect plot bounds, read multiple independent axis labels, measure actual original candle endpoints, and retain immutable candle IDs and source-image provenance. Keep extraction uncertainty separate from interpretation confidence. Reject incompatible scales, partial candles and uncertain associations.
3. Detect pivots and candidate structures using defined geometry, separation, prominence and reactions. Have the interpreter reference measured candle IDs rather than inventing percentage coordinates. Verify those IDs against the original raster on the authoritative path; browser-supplied JSON alone must not become trusted evidence.
4. Keep historical repeated highs/lows, inferred stop-risk areas, forming patterns, confirmed patterns and rejected candidates distinguishable. Expose the evidence and specific failed condition. Never make an empty or held result look like an all-clear.
5. Build an annotated corpus covering IG thin bars and candlesticks, light/dark themes, portrait/landscape, crops and alternate brokers. Separate tuning and held-out sets, include negative examples, and report per-family precision/recall, endpoint error, abstention rate, source/timeframe mismatch and repeat-run stability. Confidence must be calibrated against these labels rather than taken as a model probability.
6. Verify the complete browser upload → preflight → analysis → OCR → source-timeframe selection → overlay path, then the installed iPhone path. Ship only after the labelled accuracy and source-binding checks pass.

The prototype implements conservative local swings with three neighbours on either side, prominence and spacing requirements, exact endpoints, non-chained same-side bands and intervening reactions. It is deliberately not integrated into the customer classifier until validated. It neither reconstructs complete OHLC nor establishes named-pattern semantics.

## Primary resources reviewed

- [IG historical price API](https://labs.ig.com/rest-trading-api-reference.html): exact EPIC/resolution and date-range endpoints.
- [Microsoft Research, ChartSense](https://www.microsoft.com/en-us/research/publication/chartsense-interactive-data-extraction-chart-images/): chart-specific extraction of underlying data, including interactive correction. General chart extraction research does not establish candlestick scanner accuracy.
- [SciPy find_peaks](https://docs.scipy.org/doc/scipy/reference/generated/scipy.signal.find_peaks.html): local extrema filtered using prominence and minimum distance. The prototype is TypeScript, not a SciPy dependency, and does not reproduce its full algorithm.
- [Lo, Mamaysky and Wang, Foundations of Technical Analysis](https://www.mit.edu/~alo/Papers/techanal.html): systematic pattern recognition and statistical evaluation rather than subjective shape assertions.
- [ChartQA, ACL Findings 2022](https://aclanthology.org/2022.findings-acl.177/): combines visual features and underlying chart tables; not a trading-specific benchmark.
- [CME futures order types](https://www.cmegroup.com/education/courses/futures-trading-mechanics-and-regulation/futures-order-types): stop orders enter the book after activation, so ordinary visible depth does not reveal all stops. Candles cannot demonstrate hidden orders.

These sources support the architectural direction, not a guarantee of profitable predictions or perfection. Unverified repository accuracy claims were not adopted as release evidence.

## Validation

19 focused tests passed for capture guidance, preflight, strict liquidity placement and the measured prototype. All 25 existing render checks passed. TypeScript and the verified production build passed; build artifact and rendered HTML checks are recorded with the deployment checkpoint. Raw customer charts, model responses and signed precision receipts are excluded from git.

## Deployed browser verification

Implementation commit: `9044ba72b396aa9601c51aaedb8c8e85f5937b52`. Ready preview: https://nash-ai-markets-89t46euw1-nash-ai-markets.vercel.app/pocket . The repository tree matched the API-created tree, and every uploaded blob matched its local Git hash.

The expanded capture guide visibly confirms portrait acceptance and optional landscape. One actual browser upload of original US 500 30m passed preflight: US 500 (DFB), 30m, 7723.23. Privacy acknowledgement and JUST ANALYSE used the normal controls. The subsequent complete report FAILED; no result was saved. Runtime evidence shows precision completed in 13.584 seconds, whereas the primary report terminated incomplete at 72.712 seconds with max_output_tokens (14,000 output tokens, 2,922 output characters). Bounded recovery started after the slow-report threshold and did not finish within the request deadline. The browser correctly retained the original upload and displayed that the service did not finish. No retry was made to obtain a favourable result.

This is a separate reliability failure from candle/axis placement. Prioritise independent, source-bound structured scanner results with their own completion states so a failed long narrative cannot discard completed validated scans. Do not reuse partial narrative JSON or uncalibrated precision output as a finished report. The code checks passing do not override this failed real browser flow. Positive pattern/liquidity browser overlays and native validation remain unverified.

Additional checks passed: 18 liquidity guard tests, 17 pattern/independent-rescan tests, and one rendered HTML artifact check. The screenshot and private diagnostic archive retain the failed real-browser evidence.
