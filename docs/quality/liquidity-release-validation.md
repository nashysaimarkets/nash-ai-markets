# Liquidity release validation — 2026-10-02

Status: HOLD Apple release. Preview branch `design/source-chart-levels`, PR95. Existing production and Apple pins preserved.

## Fresh public-chart batch

Eight distinct public charts were submitted once to the preview analysis endpoint. These direct API scans do not reproduce the browser's preflight, ruler preparation or automatic recovery, and are not native-device tests.

- MetaTrader 5 / Dukascopy EURUSD M5: 200 in 47.0s; identity HIGH and candles CLEAR. One MEDIUM two-touch candidate was reported. Independent original-axis OCR verified 19 labels; liquidity overlay withheld by the stricter gate.
- TradingView / Webull composite BTC daily: 200 in 45.2s; partly obscured candle plot and unreadable current marker. Liquidity insufficient; no trusted overlay.
- thinkorswim navigator: 200 in 28.5s; missing readable instrument, timeframe and price. Identity/readability hold.
- Webull mobile JPEG: 503 in 35.4s; explicit analysis-service failure, not a precision success.
- Robinhood ROAR: 200 in 42.5s; timeframe confidence MEDIUM and header quote conflicts with the candle trace. Identity hold despite independently readable axis (nine labels).
- TradingView volume/auction chart: client stopped after 90s without a response; timeout, not a precision result. No repeated request.
- TradingView USDJPY 30m educational screenshot: 200 in 51.3s; header quote conflicts with the rightmost candle trace and the actual current marker is unreadable. Liquidity insufficient; no trusted overlay.
- XS equal-high/low illustration: client stopped after 90s without a response. Visual inspection shows no instrument, timeframe or numeric price scale, so it is a negative case, never a positive accuracy reference.

Sources for the six existing public originals and their hashes are in `prototype/chart-extraction/cross-platform-sources.json`. Two additional originals:
- USDJPY: https://dev-to-uploads.s3.amazonaws.com/uploads/articles/xdwu2bw7gg9h693er46y.png — sha256 a508daa88082b78da647d2c48558408a6312c1455fe58f6503d0009219f228c2
- XS illustration: https://www.xs.com/storage/ht-ck-images/Bt6ktpLANR5plK7Og15LlKBCUNu8BG0MXJE6WyWR.png — sha256 6f0c0ff10fd701cfd078c9568cc1e145aa5a8eb59b9a55297bba9522b689fe94

Raw responses and local OCR diagnostics are in `audit-output/liquidity-release/`; customer reports/screenshots must not be committed.

## Live browser recovery

The existing original IG 4h report was given one dedicated Liquidity Guard reanalysis through the actual UI. It returned to OVERLAY WITHHELD with zero overlay SVGs. No positive live band has been verified; do not claim one.

## Reproducible issue and fix

For a HIGH-identity, CLEAR chart with INSUFFICIENT_EVIDENCE, the component skipped OCR but displayed its pending-reader message under OVERLAY WITHHELD. The USDJPY case exposes this path. The component now displays the completed scan's evidence explanation, with a render regression proving no pending-reader copy and no overlay.

## Candle-pixel investigation (experimental, not shipped)

A local colour-connected candle probe was checked on the original IG 4h and public MetaTrader images. It confirms that model touch coordinates cannot be treated as independently verified candle endpoints. On the archived MetaTrader report, purported aligned lows at the reported x columns terminate at different actual pixel rows. On IG, connected neighbouring candle bodies can merge and make simple component extraction ambiguous. This probe is not sufficiently general to replace the production gate, and its results do not establish order-book liquidity. Do not relax thresholds or manufacture a positive overlay to pass the test.

## Checks after the status fix

All 21 render tests, TypeScript check and verified build passed. The previous unchanged unit baseline remains 1,104 passing tests. Preview deployment bcd6d3d4354b7c46a9783d48f35555a7c9c82771 is READY.

## Remaining release gates

1. Independently supported candle-touch extraction, with clear positive and negative real-chart references; reject ambiguous/obscured styles.
2. A successful live positive liquidity band, its exact endpoints, hide/show/selection controls, and chart switching without stale evidence.
3. Representative fresh end-to-end browser scans including PNG/JPEG and timeout recovery.
4. Actual iPhone/iPad WebView execution. This workspace is Linux without Xcode or an iOS simulator; browser checks cannot substitute for native-device verification.
5. Check the live Apple state via the read-only release-status workflow before any publishing run, and preserve any submission in review.


## Conservative wick gate follow-up

The experimental probe has now become an additional fail-closed requirement in preview only (`66eeb523660d3c111ac0cee01e6e284e0a76988c`); it does not replace the price-axis checks or weaken any threshold. See `liquidity-precision-checkpoint.md` for supported styles, matching limits and original-pixel evidence. All 1,112 unit tests, 21 render tests, TypeScript check, verified build and rendered-artifact test pass. A new live IG 4h browser scan took 27.8s, preserved six calibrated levels/11 labels, and withheld both reported liquidity candidates with zero SVGs and the completed independent-wick explanation. A successful live positive liquidity band and native execution are still not verified. Release remains HOLD.
