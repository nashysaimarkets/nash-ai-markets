# Scan engine settings verification — 5 September 2026

Scope: scan accuracy and performance only. No UI, layout, model selection, pricing, identity-validation or release-pin changes.

## Settings saved

The browser pixel extractor now requires colour chroma above 38, matching its candle-colour threshold, for both edge and full-plot volume-profile candidates. This filters tinted UI backgrounds and order-entry panels that previously passed as histogram bars. The existing geometry, density and independent visible-label corroboration requirements remain in force. Negative non-detection confidence is clamped to zero.

A proposed full-plot density increase from 0.055 to 0.1 was rejected: it missed a genuine profile in a robustness variant. The shipped candidate keeps 0.055. The portrait geometry gate also stays unchanged: lowering it admitted an app report screenshot as a raw chart.

## Results

- All 949 unit tests passed after the final settings selection; no skipped tests. Typecheck passed. The earlier complete render rerun passed 10/10; no rendered components changed in this pass.
- Existing public cross-platform sample: primary-slot volume-profile false positives fell from 1/9 to 0/9. Indicator-slot false positives fell from 3/9 to 1/9. Genuine profiles remained 4/4 detected.
- Original, JPEG quality 85, and 720-pixel variants of that same sample: genuine profiles remained 12/12 detected. Indicator false positives fell from 9/27 to 4/27. These are robustness variants, not independent new labelled charts.
- One local timing run had median extraction times 25.79ms before and 23.84ms after. This is not evidence of an iPhone speed guarantee or improved end-to-end model latency.
- The five recorded raw charts retained the same recognition, candle counts and relative levels; three app/chat screenshots remained rejected. Repeatability held. This local replay never transmitted private chart images.
- Exact prices still require a validated visible price scale. Pixel extraction does not establish AI interpretation accuracy.

## Remaining release blockers and coverage limits

- A fresh Level Lab POST using a public MetaTrader chart returned HTTP 502. Worker request req_aaf5b215f09f3537 reported quota_exhausted in 1,669ms. Provider capacity is still not restored. Account billing access is logged out, so the precise underlying credit/spend/approved-limit condition has not been established.
- Retrying private recorded-chart uploads was rejected by automatic approval review. The fresh capacity check used the already-public fixture instead; no private payload was transmitted in that check.
- The labelled AI release benchmark has 0 of its required 30 approved cases and fails its release gate. Its thresholds were not lowered. Live main scans, Level Lab, auxiliary scans and follow-up accuracy are not certified by the passing unit suite.
- Ordinary chart recognition in the public sample remains 8/9: the full-phone Webull fixture is rejected by the conservative plot geometry gate. One Robinhood screenshot still produces a geometric profile candidate in the indicator slot; independent visible-label corroboration remains mandatory.
- Thirteen of fourteen public source files matched their recorded SHA-256. The NinjaTrader profile URL returned changed bytes; it was visually inspected and recorded separately in the intake JSON. The pre-existing promotional cTrader exclusion was retained. The original private 20-image IG benchmark fixture set was unavailable locally.
- Apple build 20 was previously uploaded and processed. Its beta-review submission returned 422 because another build in the same version train was in beta review; the App Store Connect session is logged out. That build is pinned to its older immutable deployment and does not contain this candidate. No newer App Store release is claimed.

## Reproduction

From the repository root, run the full unit suite and the existing public cross-platform benchmark against the downloaded public fixture directory. To rerun robustness comparisons, export browser-chart-extractor.ts from baseline source 529aca7 to a temporary .mts file, then invoke the adjacent profile-robustness-replay.mts with the public fixture directory and that baseline file as arguments. Its JSON is saved alongside this report. Public source URLs and original hashes are in prototype/chart-extraction/cross-platform-sources.json.

Publication authorization is already recorded. Release remains pending successful provider restoration and real scan checks, followed by Apple review resolution. Do not interpret saved source or a built artifact as an App Store release.
