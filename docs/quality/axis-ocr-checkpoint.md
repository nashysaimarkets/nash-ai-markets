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

## Resume evidence — 2 October 2026

- Saved safety fix commits b73c07740cd2bd68249f5f108f9d61a4761b8add and 3c96fab5b6f846cbf8e251d7e6a4dd87ac84f7f7: conflicting OCR prices bound to one raster row now withhold the overlay regardless of OCR order. Exact duplicate readings remain allowed. Focused tests 22/22 passed.
- Final local typecheck and build passed. A scratch-only obsolete .mts benchmark was renamed .mts.saved; no application type rules were weakened.
- Repeated the 24 local variant cases after the fix: unchanged 20 verified axes, 15/18 owner IG variants display, estimated maximum displayed error 1.03 original-image pixels.
- Diagnosed held-axis residuals: IG15m smallJPEG70 1.741px; IG4h JPEG85 1.551px; IG4h smallJPEG70 1.922px; Robinhood JPEG85 1.944px. Strict 1.5px fit tolerance retained. Correct OCR values do not establish precise placement when raster positions are inconsistent. No outlier deletion or invented price repair added.
- Corrected-asset preview 8acfaf6629ac666dc75390779944c44d92189796 completed an actual browser scan of the owner30m chart after one AI-service timeout. Successful retry displayed 3 levels (7700,7680,7660), 8 axis labels. Audit displayed27.4s. Original image1179x2556, SVG viewBox0 0 100 100; y rows41.74338645383739,50.45357281824345,59.163759182649514; x2=76.61. Hide/Show verified. This is browser evidence, separate from local Node OCR benchmarks.
- Latest safety-fix preview: https://nash-ai-markets-pys7hdqi0-nash-ai-markets.vercel.app/pocket, deployment dpl_2rVME1BGbdyA7gvbtbgvHLYQKUN5 at3c96fab5b6f846cbf8e251d7e6a4dd87ac84f7f7. Its final browser scan is in progress; do not claim it finished yet. Browser-control upload stalled during the earlier attempt; user resumed. Production and Apple pins untouched.

## Final verification — 2 October 2026

Final safety-fix preview3c96fab5b6f846cbf8e251d7e6a4dd87ac84f7f7 successfully completed the original owner30m browser flow. The reader verified9 labels and displayed3 levels:7700,7680,7660. SVG y percentages41.749290068253046,50.45638916480994,59.16348826136684 on1179x2556 original; x2=86.24. Screenshot privately saved as levels-scanner-final-1790910016746.jpg. The prior pending browser item is now complete.

Full final units1097/1097 passed; focused22/22; typecheck/build passed. Production/Apple unchanged. JPEG holds remain unresolved; no thresholds widened and no fit outliers silently discarded. Future work: inspect JPEG ringing and resized grid centres with independent ground truth, test real iPhone cold OCR startup/memory, broaden genuinely distinct platforms, and collect repeated full scans to quantify report variability. Do not promise flawlessness or permanence from this small corpus.
