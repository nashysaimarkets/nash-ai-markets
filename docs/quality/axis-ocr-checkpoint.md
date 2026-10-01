# Independent axis OCR implementation checkpoint

Branch: design/source-chart-levels. PR: 95. Preserve approved release pins; preview work only.

Completed locally: strict numeric OCR parser; original-image crop coordinate mapping; raster row binding; linear calibration residual check; three-label agreement with vision; browser-local Tesseract worker with one targeted reread and deadline; same-origin asset preparation script.

Still to complete at this checkpoint: scanner wiring; asset build integration; real chart benchmark; regression tests; typecheck/build; preview deployment and full browser check. This checkpoint is not a tested release.

Tesseract.js 6.0.1 and @tesseract.js-data/eng 1.0.0 are intended pinned dependencies. OCR assets are generated at build time from npm packages, never downloaded from third-party CDNs by the user's scanner. No decimal repair or internet-price substitution is allowed. OCR failure withholds overlays; the analysis report remains usable.

Benchmark originals are in ignored audit-output/public-precision and owner upload/. Public source hashes and URLs are in prototype/chart-extraction/cross-platform-sources.json. Never publish customer charts or full API receipts to the public repository.
