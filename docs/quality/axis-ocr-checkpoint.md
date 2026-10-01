# Independent axis OCR — paused checkpoint, 1 October 2026

User requested pause when allowance ran out, with continuation at 23:00 Europe/London. Continue from this checkpoint; do not restart research or repeat paid scans unnecessarily.

Repository: nashysaimarkets/nash-ai-markets. Branch: design/source-chart-levels. PR95 against ops/pocket-approved-build47-2026-09-29. Preserve production and Apple review pins. All work remains preview-only.

## Implemented

- Local browser Tesseract.js 6.0.1, English model package 1.0.0, strict numerical OCR without decimal repair.
- Original pixel crop coordinates, independent raster row binding and linear fit; three distinct price labels must agree with the vision scan.
- One targeted numeric-column reread, 25-second deadline, cancellation and worker cleanup.
- Mathematical overlay projection from independently verified anchors; stop lines before the independently measured price-label column.
- Gradient, dotted and dashed raster grid detection.
- Same-origin generated OCR assets. Vercel uses a build path that bypassed build-verified.sh; package postinstall now generates them during installation. Asset worker, core and language URLs returned 200 on the corrected preview.

## Evidence so far

1095 unit tests and 20 rendering tests passed before the last small axis-column boundary change. The 11 source-chart tests passed after that change. Typecheck/build passed before that last change; rerun final checks after resuming. Four obsolete old-layout assertions were updated while keeping privacy/provenance/withholding requirements.

24 local image cases from eight originals (six owner IG + MetaTrader and Robinhood), each original/JPEG85/smaller JPEG70. These are variants, not 24 independent sources. 20/24 axes verified; 15/18 IG variants displayed overlays; maximum measured projected error among displayed IG lines was approximately 1.03 pixels in the tested image. Reference raster rounding means these are estimates. Three IG JPEG variants withheld for inconsistent calibration. Public MetaTrader/Robinhood report identity/timeframe checks still withheld overlays even when axes verified.

Full private responses and original customer images are not committed. Scratch evidence: audit-output/public-precision/axis-variant-results.json, axis-unit.log, axis-render.log; audit-output/real-charts/manual-axis.json. Assets regenerate with node scripts/prepare-axis-ocr.mjs.

## Next steps

1. Finish actual browser OCR verification on corrected asset preview: https://nash-ai-markets-degfs4d5k-nash-ai-markets.vercel.app/pocket (commit 8acfaf6629ac666dc75390779944c44d92189796). A 30m owner chart was selected again; install prompt was visible and privacy checkbox not yet checked. CUA tab handle chartPreview was in use. Inspect fresh state before interaction.
2. Initial browser test on prior preview completed normal scan in 30.8s but OCR held because assets were 404. That deployment defect was corrected; do not claim browser OCR success yet.
3. Investigate the three unnecessary IG JPEG calibration holds without relaxing the original-image tolerance or inventing prices. Consider contrast-weighted raster row centres rather than loosening thresholds.
4. Re-run final typecheck/build and focused tests after any change, verify final preview browser overlay, save quality report and screenshot, update PR95 description, synchronize local git with remote.
5. Product success means both usable precise overlays and safe withholding. Do not describe fail-closed-only results as 100% accuracy or claim trading usefulness.

Current local repo: /workspace/scratch/6b4ca5b00226/pocket-redesign. Original owner files: ../upload/IMG_6871.png through IMG_6876.png. Scratch may expire; code and this checkpoint are persisted on GitHub. Public images can be retrieved from prototype/chart-extraction/cross-platform-sources.json if needed. Keep images/receipts out of public GitHub.
