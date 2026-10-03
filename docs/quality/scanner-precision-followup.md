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


### Boundary-label correction and browser result

A real browser scan of the new 4h original on bf814109 completed in 28.6s. It verified seven axis labels/four levels, retained one reported HIGH 7774.5–7781 candidate, and correctly withheld its band because the read scale ended at 7750. It also retained one MEDIUM/AMBIGUOUS range interpretation but withheld the unmatched path. This is negative-path evidence, not successful positive detection.

A second confirmed extraction fault: the AI plot top (18.3%) cuts through the actual 7800 boundary label/grid at 17.8795%. The strict crop omitted that original label. `axisReadingBounds` now adds a bounded 12–40 original-pixel vertical reading margin to OCR/grid extraction. Verified anchors may fall in that same reading margin; drawable plot bounds do not expand. Model-only anchors retain their original bounds rule. This is original-label acquisition, not price extrapolation or a relaxed fit. The same private receipt replay now reads eight labels, including 7800, with four exact model agreements. Its inaccurate 7700 touches remain withheld. A boundary-label unit/grid regression and a drawing-bounds regression cover both inclusion and rejection outside the margin.

Final implementation commit fe0c2dbc87cc69c4dbe784a3e6c225a85262fe85. Latest preview https://nash-ai-markets-oarxkpp4x-nash-ai-markets.vercel.app/pocket . Final checks: 1,123 unit tests, 22 render tests, TypeScript and verified build passed. The first final build stopped without a useful compiler error while other checks ran; a completed subsequent build passed and supplied the recorded artifact. The boundary fix has exact original-raster replay evidence; it has not had a fresh live positive browser scan. Avoid another paid request merely to force a pass.

The browser notebook export once again failed to provide a download event/path; no exported browser receipt is claimed saved. Private API receipt and raster diagnostics exist separately. Browser screenshot `scanner-original-verification-1791008383859.jpg` shows the restrained Pattern X-Ray with the uncertain path withheld. Outstanding work remains real annotated accuracy/recall validation, robust candidate/pivot extraction, successful positive liquidity/pattern UI flows, chart switching/JPEG variants and native execution. No permanent fix or Apple readiness claim is justified yet. Production/review pins remain unchanged.


### Final live positive verification — supersedes the pending boundary-browser status above

One bounded final browser scan on fe0c2dbc verified the actual boundary fix. The new original IG 4h completed in 40.5s and reported two liquidity candidates. The original-image UI independently verified eight axis labels and drew one exact HIGH 7752–7758 band supported by three candle endpoints. Hide removed the liquidity SVG and show restored it. DOM evidence: original 1179×2556; SVG band y=26.996759792956258%, height=1.303704779543974%, line y=27.648612182728243%, right=84.13%. Screenshot `scanner-verified-band-1791008934872.jpg` records the source band, price range and witness count. This is a successful positive liquidity display/control check, not comprehensive detection accuracy or verified real resting orders. The other reported candidate is not claimed verified. Positive pattern geometry remains unverified; the earlier live medium range path stayed withheld.

A separate local replay read all five original axes with hand-supplied visible-price tick lists and diagnostic bounds, using the production OCR/grid/linear-fit functions: 15m 11 labels, 30m 12, 1h 9, 4h 8, daily 9. Every axis was verified under the unchanged residual limit. This is not five fresh AI analyses, a manually annotated candle-recall benchmark or positive drawing verification on all timeframes.

Private reproducibility archive `scanner-original-diagnostics-2026-10-03.zip` retains the API receipt, before/after raster probes, margin replay, five-chart axis replay and final visible-DOM evidence. It does not contain an exported browser analysis receipt: download events were unavailable. Original images are separately saved customer attachments. Implementation and checkpoints are saved in GitHub; production/Apple pins stay preserved and release HOLD remains for cross-platform/JPEG accuracy, successful pattern drawings, source switching/recovery and native tests.


### Pattern chart access and new light-theme originals — 3 October

Implementation f5b4db24ff0814f271714034d6652ead61c5be72 adds a prominent VIEW MY CHART entry inside Pattern Watch, including its empty-result state. It opens the existing Pattern X-Ray without another analysis request. Pattern Watch and X-Ray now receive the selected sourceAnalysis rather than the combined multi-chart report; sourceImage and primaryLevels remain selected-source inputs. Original-image display does not depend on verified drawing geometry. No precision thresholds changed.

The five new 1179×2556 light-theme originals (IMG_6899–6903) were replayed locally through production OCR/grid/fit and candle functions, with manually supplied visible tick price lists and diagnostic plot bounds. Independent scale verification passed on all five: 15m 9 labels/59 conservative components, 30m 7/65, 1h 7/65, 4h 8/62, daily 12/64. This is raster-reader evidence, not five complete AI scans, annotated candle recall or pattern-classification accuracy.

One fresh browser scan of IMG_6901 on the exact implementation preview completed in 34.9s, correctly identified US500 DFB/1h/7723.23 and independently calibrated three levels/seven labels. It reported a MEDIUM forming breakout-and-retest and no defensible liquidity cluster. Pattern Watch showed VIEW MY CHART; clicking it opened the complete 1179×2556 original image, with the one reported interpretation retained and unsupported pattern geometry explicitly withheld. Switching back to PATTERNS and opening the chart again worked. No successful positive pattern drawing is claimed. The original prior bull-flag receipt is unavailable, so the change in classification is not treated as proof of a corrected classifier.

TypeScript, 22 render tests, 22 targeted axis/grid/candle/pattern unit tests, verified build and one rendered-artifact test passed. No full unit rerun or native device verification is claimed for this small navigation change. Preview https://nash-ai-markets-5w25moo5m-nash-ai-markets.vercel.app/pocket . Screenshot pattern-chart-view-1791010230458.jpg shows the accessible original. Private diagnostics archive updated with new light-theme replay. Preserve production/Apple pins and release HOLD for annotated semantic/recall validation, positive precise pattern paths, multi-source switching/JPEG recovery and native execution.
