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


## Incremental wick-pixel checkpoint — 2026-10-02

Implementation preview commit: `66eeb523660d3c111ac0cee01e6e284e0a76988c`.

`candle-pixels.ts` now independently reads conservative red/green connected candle shapes from the original raster. It requires a sufficiently continuous stem and visible wick/body width difference, and rejects body-only rectangles, clipped edges, unsupported colours and oversized merged structures. Association uses the reported point's location inside one component; distant annotations at the same x cannot provide evidence. This detector is deliberately limited and can withhold genuine structures; it is not a general candle recognizer or proof of order-book liquidity.

`preciseLiquidityZones` requires same-resolution pixel evidence for every reported touch, at least two distinct component witnesses, the correct high/low wick, and no more than two original pixels between both the reported touch and actual endpoint and between the endpoint and the original exact price interval. All earlier identity/scale/side/coverage/high-confidence gates remain. No dropping unsupported third touches, widening bands, extrapolation, repairing prices or searching for a nearby candle just because its price fits. Missing or ambiguous pixel evidence withholds the overlay. The component reuses its existing original canvas read; no extra provider request is introduced.

Archived MetaTrader touch rows around 803.44 pixels actually end at 830 and 818 pixels (about 27 and 15 pixels away); these do not qualify. The original IG 4h has merged/indistinguishable shapes, and its archived purported third high lacks a supported endpoint. The new detector found 17 conservative components on IG (1179x2556) and 22 on MetaTrader (790x1670), taking 52ms and 37ms locally. These are component counts and local timings, not recall, accuracy or iPhone latency measurements.

Checks: 1,112 unit tests, 21 render tests, TypeScript check, verified build and rendered-artifact test passed. Tests include independent raster-to-band positive support, a body crossing without a wick at the band, displaced endpoints, missing/wrong-size pixels, duplicate and ambiguous components, unsupported styles, unsupported third touches and exact interval preservation.

Actual browser preview: https://nash-ai-markets-dybq7loys-nash-ai-markets.vercel.app/pocket . One fresh original IG 4h scan completed in 27.8s and reported two liquidity candidates. The levels view retained six calibrated levels and 11 independent labels. Liquidity reached OVERLAY WITHHELD, with the new independent-wick explanation, zero liquidity SVGs and the original 1179x2556 source image. This proves this preview's fail-closed path, not positive liquidity placement or broad detection accuracy. Browser proof: `liquidity-wick-preview-1790921702598.jpg`, separately saved.

Next: independently annotated real positive/negative wick references across platforms and JPEG, then a successful live positive band with controls and chart switching. Native execution remains unverified: this Linux workspace has no Xcode/iOS simulator or attached iPhone/iPad. Keep Apple release on HOLD and preserve production/review pins. Do not repeatedly rescan to force a passing candidate.
