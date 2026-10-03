# Scanner precision follow-up — 2026-10-02

Branch `design/source-chart-levels`, PR95. Implementation checkpoint `f721a94de0de460af1c396c6a335be8a782ec5c5`. Preview only; preserve production and Apple pins.

## Customer evidence and limitation

Four new attachments (IMG_6891–6894.jpeg) are readable locally. They are screenshots of the app's results, with embedded/reduced chart images and UI overlays, not the full-resolution chart inputs. They show liquidity candidates withheld by the price/side/wick gate and a daily pattern trace with oversized, vertically stretched endpoint circles. They do not prove no liquidity candidates were reported. Exact reproduction requires the original uploaded chart images and their scan reports; do not treat a cropped result screenshot as the original calibration reference.

## Confirmed faults addressed

- Liquidity withheld all drawable candidates without keeping their reported prices/evidence visible. The UI now shows each reported candidate explicitly as drawing unverified, before the original chart. It explains that no band was added; it does not label these as independently verified areas or actual resting orders. An absent drawable overlay is distinct from no reported candidates. A render regression covers this distinction.
- Pattern X-Ray accepted finite AI point coordinates without independent original-raster endpoint verification. `pixelCheckedPatterns` now requires every vertex to match exactly one distinct original candle endpoint within two original pixels, sequential historical x positions, the selected source/timeframe and reported MEDIUM/HIGH confidence. Clear candle/identity gates apply before extracting original pixels. Unsupported, ambiguous, duplicate, future-space, cross-source and displaced geometry remains undrawn; reported pattern interpretation remains available and explicitly unverified. Pixel matching does not establish the correctness of a pattern's semantic classification.
- Pattern circles used percentage coordinates in a nonuniform SVG viewBox, stretching into ovals on portrait charts. Paths now use the original raster dimensions; markers have a small raster-scaled radius and the source image retains its natural aspect ratio. The dedicated presentation removes scan/shade effects, oversized labels and glow in favour of a quiet navy view.
- Stem tie selection now chooses among equally strong columns that actually support both component endpoints. A regression covers a central pixel gap and adjacent equal-strength column missing the top endpoint. This does not turn the limited colour-component reader into a general candle recognizer.

## Validation

1,117 unit tests (concurrency four), 22 render tests, TypeScript check, verified build and rendered-artifact test passed. An initial unrestricted unit run ended without a complete summary, so it was not counted as a pass; a complete bounded-concurrency run supplied the recorded result. No price thresholds or liquidity gates were relaxed.

The revised original IG 4h pixel probe still finds only 17 conservative components; this is not a candle-recall measurement. The underlying liquidity detection/false-negative problem is NOT proven fixed. Proper endpoint extraction on compressed, touching and unsupported candle styles and genuine positive live overlays remain work in progress. Do not claim permanent accuracy or production readiness from these tests.

## Remaining work

The customer supplied original 15m/30m/1h/4h/daily inputs on 3 October; analyse those and retain exact scan reports; distinguish absent AI candidates, confidence/side rejection, price-band mismatch and component/touch association failure with exact receipts. Add independently annotated real positive/negative examples before changing candidate reconstruction. Verify successful live overlays, source switching and native iPhone/iPad execution. Do not retry scans until they happen to pass or draw inferred bands simply to populate the UI.


## Diagnostic and browser follow-up

Latest implementation commit: `aaa9ccf9891040d53acb3934659d027dd7bf4f8a`.

Each rejected liquidity candidate now has a specific explanation: confidence requirement, incomplete independently read scale coverage, wrong price side, excessive band extent, touch-row disagreement or missing distinct pixel endpoint witnesses. Global reader/identity holds retain their own explanation. Pattern summaries separate reported interpretations from pixel-checked drawings instead of reporting zero visible patterns when only geometry was withheld.

Actual browser scan on preview `f721a94d` used the older original daily IG chart, not the new result screenshots. It completed in 37.1s, independently read nine labels and drew four levels. It reported a HIGH high-cluster candidate at 7780–7815 and a MEDIUM/AMBIGUOUS rectangle/range. The liquidity band stayed withheld, while the new reported-candidate panel displayed its range and evidence. Pattern X-Ray withheld the unverified path, retained the reported interpretation and displayed the original unaltered chart in the quieter layout. This is negative-path verification, not proof of accurate positive detection or the customer's exact new inputs.

Two browser file-upload calls took unusually long (roughly five and eight minutes) while ordinary navigation and result controls responded normally. Do not attribute that to the application's scan API latency: the recorded first analysis audit was 37.1s. A notebook export displayed its prepared notification, but this browser did not deliver a download event/path; no exported scan receipt was claimed saved. The most recent diagnostic preview opened and its daily preflight identified US 500 (DFB), 1d and 7670.47. No repeated upload should be used to force a passing result.

Latest diagnostic preview (`aaa9ccf9`) completed a second real daily-chart analysis in 33.5s, reporting a HIGH 7775–7820 upper-high candidate. The browser displayed its precise hold reason: complete band outside independently read coverage (6400–7800). Nine axis labels and three source levels were verified. This confirms a concrete scale-coverage rejection on this older original; it is not proof of the rejection reasons for the customer's new originals. No positive liquidity overlay was verified. Screenshot: `scanner-hold-explanation-1790924906015.jpg`, saved separately. Latest verified preview URL: https://nash-ai-markets-gm0pqdtcr-nash-ai-markets.vercel.app/pocket .


## Original-chart follow-up — 2026-10-03

Original inputs IMG_6886–IMG_6890.png are now available privately (15m/30m/1h/4h/daily), each 1179×2556. The input block is resolved. Keep originals and detailed receipts out of this public repository.

Confirmed false-negative cause: many compressed IG candles are narrow, colour-connected vertical bars with no visible wick taper. The previous reader rejected them as rectangles. The reader now permits such exact endpoints only within a regular, separated run of at least eight bars with both colours and varying highs/lows. Isolated rectangles, irregular short sequences and shared-baseline histogram runs remain absent. A verified candle's high/low can legitimately coincide with its body edge; requiring a tapered wick at that particular endpoint wrongly rejected it. Liquidity now checks the measured high/low endpoint rather than requiring visible taper. Pattern verification already checks actual endpoints and benefits from the same improved reader.

With fixed diagnostic plot bounds (1–84% x, 12–85% y), component counts on the five originals changed: 15m 10→148, 30m 14→147, 1h 13→162, 4h 18→162, daily 56→56. These are component counts, NOT independently measured recall or an accuracy score. No endpoints are reconstructed from missing pixels, and ambiguous/merged components remain unsupported. No price, OCR residual, two-pixel association or source-identity tolerances changed.

One fresh API analysis of the new 4h original completed HTTP200 in 50.022s. It reported a HIGH 7700 candidate and a LOW/AMBIGUOUS range. Replaying the exact receipt through original-raster OCR verified seven labels and 164 candles using the actual returned bounds. The band remains correctly withheld: reported touch y=40.6% differs by about 26 original pixels from independently measured 7700 row y=39.593%. Its reported x positions correspond to actual highs at 989, 830 and 978 pixels, rather than one shared high row. LOW pattern geometry remains withheld. Do not use increased candle counts to approve this unsupported candidate.

Validation: 1,120 unit tests (concurrency four), 22 render tests, TypeScript check, verified build and one rendered-artifact test passed. New regressions cover compressed regular candles, isolated/short/irregular/unicolour rectangles, volume baselines and a real body-edge high without an upper taper.

Implementation saved incrementally through bf81410950d7c26abf360d3548684b8d715764c5. Preview: https://nash-ai-markets-6ehdslphd-nash-ai-markets.vercel.app/pocket . Live browser verification pending at this checkpoint. Still required: independently annotated real recall/false-positive cases, accurate positive live liquidity/pattern drawings, remaining original inputs and JPEG variants, and native execution. Preserve production/Apple pins and keep release HOLD.
