# Pocket Bullseye guided uploads and speed trial — 9 September 2026

## Delivered behaviour

- Optional custom, scalping, intraday and swing upload guidance. One clear chart remains sufficient.
- Scalp suggestion: 5-minute primary, 1-hour context, optional 15/30-minute view. Intraday: 15/30-minute primary, 1-hour context, optional 4-hour. Swing: 4-hour primary, daily context, optional weekly.
- Suggestions never override actual image labels. The existing whole-report timeframe selector supports all five uploaded images and reuses completed reports.
- Readability advice covers symbol, timeframe, price scale, candles, same instrument and simultaneous capture. RSI and moving-average settings remain optional. Horizontal volume profile is distinguished from ordinary volume bars and tick volume.
- Preflight now includes the fifth indicator/volume image. Confirmed instrument mismatch forces RETAKE. Incomplete provider output is rejected. Explicit mismatched capture timestamps receive a visible warning; unknown capture timing does not block a useful chart.

## Speed candidates

Production defaults to baseline. Only the dedicated Vercel preview branch accepts the trial selector header, under the existing normal request allowance. No provider, model, reasoning or deadline change was made to the baseline.

| Profile | Change |
| --- | --- |
| baseline | Existing full report followed by precision for multiple images |
| compact | Generate five repeated presentation findings once and reuse them in the UI |
| fast | Compact report plus provider priority/Fast mode for the report |
| overlap | Fast compact report and independent precision calls start together |

All independent evidence and geometry fields remain in the schema. Compact transport needs real-chart quality evaluation: a conditional scenario is reused as its confirmation text, which may reduce section-specific nuance. Do not enable it merely because it is faster.

Actual provider service tiers are recorded per response, including fallback to default. Logging excludes images and customer identity. Requests without a provider response may have unreported usage.

## Existing speed evidence and competitor scope

Three earlier server traces completed report plus precision in approximately 112.6, 116.1 and 130.1 seconds. They were not a controlled same-input benchmark or complete browser-to-final-screen measurement. Two traces used repeated copies of one image and do not establish multi-timeframe accuracy.

FundedAI advertises under 5 seconds in its [Google Play listing](https://play.google.com/store/apps/details?id=in.funded.ai); CryptoLens advertises under 10 seconds in its [Google Play listing](https://play.google.com/store/apps/details?id=com.cbstudio.cryptolens_app). These are vendor claims, not independently timed results. Their output scope may differ from Bullseye's full report and precision scans. No claim of competitive parity is justified yet.

## Provider cost basis

[OpenAI pricing](https://developers.openai.com/api/docs/pricing) checked 9 September 2026: short-context Sol standard input/cached input/output = $4/$0.40/$20 per million tokens; Fast = $8/$0.80/$40. Terra standard = $2/$0.20/$12. Fast is twice Sol's standard per-token rate; compact output could offset part of that increase, but this must be measured. Prices are promotional and subject to change. Cache-write charges, regional surcharges, requests with unavailable usage and other services are excluded from any simple token estimate.

[Fast mode documentation](https://developers.openai.com/api/docs/guides/fast-mode) describes up to 2.5x faster Sol processing, not a guaranteed end-to-end application speedup. [Latency guidance](https://developers.openai.com/api/docs/guides/latency-optimization) supports reducing unnecessary output and overlapping independent work.

## Validation and rollout gate

983 unit tests, 12 rendering tests, TypeScript check and Sites build passed. Native Vercel build passed and the actual /pocket page returned 200 with all four guided-upload choices. Existing Apple submission is not changed by this work.

The private-chart live trial was stopped by automatic approval review because it would send saved customer charts to the new Vercel preview without explicit approval for that data and destination. No completed private-chart comparison was recorded. The safer timing trial uses only the publicly committed fictional demo charts. It tests main API timing, completion and basic source separation, not real-market accuracy. Browser-side recovery scanners, preflight, upload preparation and display animation are outside that timing.

Before enabling a faster profile for customers, compare representative real chart packs with approved inputs, including price labels, timeframe ownership, supported patterns, indicator absence, geometry and held results. Evaluate repeated normal/slow timings and cost; a single synthetic result cannot establish p95, accuracy or competitive parity.

## Release decision

Guided uploads and whole-report timeframe switching may ship. Keep the production speed profile on **baseline**. Synthetic timing gains are promising, but compact transport changed scenario wording and one compact run produced conflicting instrument identity reads. No real-chart accuracy uplift or 5–10-second competitive scan is claimed. The private-chart comparison needs explicit approval for the selected files and preview destination before it can proceed.

## Completed fictional-chart trial

Single run per profile; identical 5M/1H demo pack. Times include HTTP round trip from the test runner. Server times exclude approximately 10–16 seconds of request transport/overhead. Later precision calls benefited from warmer cached inputs.

| Profile | API round trip | Server scan | Recorded token cost | Quality/reliability observation |
| --- | ---: | ---: | ---: | --- |
| baseline | 150.51s | 135.35s | $0.1833 | Independent identity reads agreed; current price withheld. |
| fast | 87.15s | 71.30s | $0.2332 | Independent identity reads agreed; current price withheld. |
| compact | 96.12s | 85.69s | $0.1372 | Independent identity reads disagreed; held for confirmation. |
| overlap | 144.53s | 133.12s | $0.1572 + unknown timed-out usage | Independent identity reads disagreed; held for confirmation. Initial report timed out; recovery completed. |

Fast reduced this one API round trip by 42.1% versus baseline; recorded token cost rose about 27.3%. It preserved 5M primary / bearish 1H context and absent indicators, but reused scenarios introduced approximate price text while exact numeric overlays remained held. Compact and overlap had independent identity disagreements. All four completed HTTP 200 with HOLD gates because the demo has no readable live-price marker. This is not an accuracy pass or a production latency guarantee.

Final decision: keep baseline in production, preserve the experimental modes for controlled evaluation, and do not market parity with competitor 5–10-second claims. Follow-up: obtain explicit approval to use IMG_6278.PNG and IMG_6279.PNG through the preview and existing AI provider, then validate real-market labels, prices, source ownership and geometry before a paid or compact mode rollout.
