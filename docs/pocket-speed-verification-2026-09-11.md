# Pocket speed verification — 11 September 2026

## Published safe changes

The website reuses the prepared encoding of each exact screenshot, caches pixel measurements under the correct chart/volume policy, computes plot thresholds once, and starts one eligible supporting report while the main provider request is running. Main completion retains finished sibling reports. Existing privacy, entitlement, allowance, cancellation, correction invalidation and trust-gate rules remain active. Models and normal reasoning effort are unchanged.

Website source: `682d5318bade3230630a91faacc1b7410c292bf5`; Sites version 152 succeeded. Native web preview: `0cd8d57fc8ae177545f50d1d5aecd978b85e9fe3` at https://nash-ai-markets-mmpqggbld-nash-ai-markets.vercel.app/pocket. Native packaging/submission must be confirmed separately.

## Verification

- Website: 1,040 unit tests passed and production build passed.
- Native source: 1,037 unit tests passed, TypeScript passed, secret-pattern scan passed, Vercel build READY, immutable revision verifier passed.
- 20 hash-verified IG screenshots, two measurement roles each: all 40 before/after measurement objects matched exactly. Both revisions ran in equivalent VM contexts. Mean extraction was 545.67 ms before and 506.31 ms after (about 7.2% lower in this local microbenchmark). This is not a phone benchmark or independent accuracy score.
- Live preview sample navigation: selected 1D, then returned to 5M successfully. A browser upload test stalled and is not counted as a pass.
- Real-image remote trials were blocked by automatic approval review because permission to disclose those files to the preview destination was not established. No workaround is authorized by this report. Local comparison did not upload the images.

## Controlled fictional five-image trials

Same generated fictional image payload, same preview, serial requests, normal request budget. No user price confirmation, receipt reuse or client-side measurement was supplied. Each endpoint returned HTTP 200 and retained its precision hold because a defensible current-price/level pair was absent. These tests measure endpoint timing, not end-to-end phone behaviour, independent chart accuracy or competitor parity.

| Mode | Client elapsed | Server elapsed |
|---|---:|---:|
| Normal full report / medium reasoning | 58.41 s | 46.80 s |
| Short keys / medium reasoning | 56.78 s | 47.75 s |
| Short keys / low reasoning | 33.64 s | 23.42 s |

Only one trial per mode. Provider and network variation preclude a percentile claim. Short keys alone did not improve server time. Low reasoning materially reduced this sample's time but has not passed real-chart accuracy validation; both experiments remain opt-in on a dedicated preview branch. Production ignores trial headers.

Normal report first output arrived at 28.22 s and completion at 46.80 s; precision completed at 15.57 s. The main bottleneck is report reasoning/output rather than pixel extraction. Reducing image preparation alone cannot establish competitor-level analysis times.

## Remaining work and release gates

1. Independently label instrument, timeframe, visible current price, scale, candle geometry and support/resistance on an approved real-chart holdout set, including small-screen, blurry, logarithmic and conflicting-timeframe cases.
2. Compare reasoning policies against that holdout set, including false verification and necessary abstention, before enabling a faster policy.
3. Build a reusable validated evidence snapshot per exact image and derive each timeframe view from it. Bind snapshots to image hash, extractor/model/schema versions and corrections. Never infer a timeframe from its upload slot.
4. Show only independently validated facts as they finish; keep incomplete judgments explicitly pending. Durable jobs must retain results across app suspension before claiming background completion on iPhone.
5. Benchmark complete phone-to-report p50/p95, timeout rate, duplicate calls and tap-to-prepared-timeframe latency. Run an equivalent independently timed competitor comparison before claiming parity.

The offline chart-extraction prototype remains isolated from production: its independent annotation acceptance gate has not passed. Neither lower reasoning nor an unvalidated extractor has been enabled for customers.
