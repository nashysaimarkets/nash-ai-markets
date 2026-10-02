# Liquidity precision checkpoint — 2026-10-02

Branch: `design/source-chart-levels`; PR95. Preview only. Production and Apple review pins remain unchanged.

## Implementation

Liquidity Guard now uses the original selected chart's report, not the combined multi-timeframe report. It shares independent original-pixel axis OCR with source levels. Identical concurrent reads share a worker; only verified results are cached in memory for two minutes. Cancellation of one consumer does not stop another, and the last consumer cancels the worker.

Drawing requires verified instrument/timeframe identity, clear candles, a linear price axis, at least three independently read prices matching the model, at least 20% image-height coverage and a maximum 1.5-original-pixel fit residual. Prices must be inside coverage, zones must be HIGH-confidence, on the stated side of the current price, with at least two distinct reported touches lying within the interval plus two original pixels. No extrapolation, price repair, forced zones, minimum-height band inflation or supposed verified candle markers.

The map has a restrained navy presentation, thin mathematically placed bands, controls and evidence beneath the original chart. Reported clusters remain provisional until axis verification. The copy distinguishes visually inferred stop-risk areas from actual resting orders; image calibration cannot establish order-book liquidity.

## Validation

Final local run: 1,104 unit tests and 20 render tests passed; TypeScript check and verified production build passed. Regression cases cover scale disagreement, nonlinear axes, wrong-side/uncovered/low-confidence zones, invalid/duplicate touches, original-resolution tolerance, exact interval endpoints and shared OCR cancellation/retry.

Replay of 24 existing original/JPEG variants is not 24 new AI scans and is not proof of liquidity detection accuracy. The pure gate retains one candidate on the original customer 4h image. Three MetaTrader variants pass geometry but have low identity confidence, so the UI still withholds them. Many older touch coordinates are too approximate for the new gate. JPEG calibration holds remain held; no precision thresholds were relaxed.

## Browser verification

The original 30m image completed a live scan in 29.1 seconds. The liquidity view correctly displayed NO CLEAR STOP-RISK CLUSTER, the source screenshot and its inference disclaimer, without an overlay.

Latest code preview: https://nash-ai-markets-mfzy2quds-nash-ai-markets.vercel.app/pocket (deployment commit 1a322e432b1ae663a3400764657971cefa462759).

The original 4h chart completed a fresh live analysis in 34.5 seconds and reported one candidate. Independent OCR accepted 11 axis labels (the levels view drew six calibrated levels), but the liquidity candidate failed the stricter price/side/touch-row gate and the browser correctly showed OVERLAY WITHHELD with zero overlay SVGs. The original source image and inference disclaimer remained visible. This verifies fail-closed behavior, not a successful live positive band; positive placement is covered by deterministic regression tests and the saved-report replay. A live positive-band interaction remains unverified.

Browser proof: liquidity-preview-1790919092014.jpg, saved separately. Do not commit customer screenshots or report receipts. Next investigation: improve independently supported candle-touch extraction rather than relaxing the two-pixel threshold or repeatedly rescanning until a candidate passes.
