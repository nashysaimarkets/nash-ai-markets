# Public source-chart precision batch — 1 October 2026

## Method

Six original public images were downloaded from the existing cross-platform source manifest. All six SHA-256 hashes matched that archive. Each was submitted once to the 9d163237 preview `/api/pocket/analyse` endpoint, with two requests at most in flight. Requests supplied the original image only; this tests the API and local display gate, not the complete browser upload/preflight/client-CV path. No customer images, response receipts or copyrighted chart images are committed here.

All six API requests returned HTTP 200 in 36–58 seconds. These are single runs, not latency percentiles. The original-raster gate was replayed locally with each response and the downloaded original pixels. Tick values and selected row centres were inspected visually; offline Tesseract was diagnostic only. It dropped the leading decimal of MetaTrader forex labels (1.09505 became 9505), so it was not accepted as reference truth.

## Results

| Public source | Image | Overlay outcome | Reason |
| --- | --- | --- | --- |
| Dukascopy / MetaTrader 5 | EURUSD M5 Android promotional screenshot | Withheld | Independent instrument reads conflict; identity confidence LOW |
| Webull / TradingView | Desktop and phone composite | Withheld | PARTIAL readability; phone obscures main chart |
| thinkorswim | Chart Navigator | Withheld | Instrument, timeframe and numerical price axis absent/unreadable |
| Webull | Redacted mobile chart | Withheld | Instrument unknown; only two numerical axis references |
| Robinhood | ROAR candlestick illustration | Withheld | Candle interval uncertain; header quote conflicts with candles |
| TradingView | Nasdaq futures volume-profile chart | Withheld | PARTIAL readability; reported last-price conflict |

**0/6 displayed overlays; 0 displayed placement errors.** This is a safety/availability result, not 100% precision and not evidence that technical levels predict price. Three source illustrations intentionally lack enough information for a clean exact-overlay success test. Identity resolution, uncertain intervals and dense profiles remain separate issues; no confidence threshold was relaxed.

## Reproduced defect and correction

The raster detector required a mostly solid horizontal colour. It detected no Robinhood dotted price rows and only the MetaTrader quote line in a manually bounded price plot. The detector now also recognises contrasting pixels distributed across at least four of six horizontal segments, spanning at least 75% of the sampled plot width. Adjacent background rows must agree; narrow marks at opposite ends are rejected. Original-image pixel tolerances and independent price requirements are unchanged. This does not independently verify tick prices.

After correction, Robinhood price grid centres were detected at 332.5, 396.5, 460.5, 524.5, 588.5, 652.5, 716.5, 780.5, 844.5 and 908.5 pixels in the 754×1628 original, corresponding visually to 130 through 40 in steps of 10. MetaTrader detection improved from one to eleven rows in the manually bounded plot; some dashed rows remain undetected, so availability is still limited. Bounds from its AI response produced a different subset. A quote line may also be detected: raster rows carry no price identity.

Regression tests cover dotted/dashed patterns on both light and dark backgrounds, original row centres, widely separated short marks, solid rules, vertical rules and shifted self-consistent model coordinates. 27 focused unit tests and 3 scanner rendering tests passed; typecheck and production build passed. Browser upload and phone behavior were not re-tested for this detector-only change. Previous real browser scans are recorded in `source-chart-six-frame-check.md`.

## Reproducible sources

URLs, original filenames and hashes are retained in `prototype/chart-extraction/cross-platform-sources.json`:

- metatrader5-dukascopy.png — https://www.dukascopy.com/downloads/static/images/downloads/mt5-android%402x.png
- tradingview-webull.png — https://u1sweb.webullfinance.com/us/office/4395892b7c364313b158e9ef320a0028.png
- thinkorswim-navigator.png — https://tos.mx/center/howToTos/thinkManual/charts/Useful-Tools/Chart-Navigator/main/images/0/image/dark
- webull-mobile.jpg — https://h1kweb.wbsecurities.com/suggestion/f45aa1ee41fb453ebd75c20fdb47b0bf.jpg
- robinhood-candlestick.png — https://images.ctfassets.net/fomw95h5b4ty/20WwG4NNBrc7pxtAwENgIW/6ae94df3099dc446e00c8db9622b54a7/Achart_with_MA10_Candlestcik__1_.png
- volume-tradingview-auction.png — https://s3.tradingview.com/6/6w3ku7sS_big.png

The safe next accuracy benchmark needs ordinary single-chart screenshots with visible instrument, explicit candle interval, a readable linear price axis and independent price-label verification. The current batch cannot justify production promotion or a claim of permanent accuracy across platforms.
