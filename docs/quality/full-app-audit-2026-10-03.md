# Full app audit checkpoint — 3 October 2026

## Scope and release state

Authorised pre-release audit: ten original IG uploads plus a frozen, seeded batch of thirty public charts. Production and the Apple review pins remain unchanged. PR95 remains on design/source-chart-levels against ops/pocket-approved-build47-2026-09-29.

## Saved change

Calendar coverage fix at e74c990347f5965e7588d5f9c085075450930964: a missing agency feed now produces an explicit incomplete-coverage warning instead of a no-release all-clear. Three regression tests, TypeScript, render tests and verified build passed. Updated preview: https://nash-ai-markets-3eyut7rgm-nash-ai-markets.vercel.app/pocket . Browser verification of the updated copy remains pending.

## Frozen baseline batch

Baseline f5b4db24ff0814f271714034d6652ead61c5be72 / dpl_9fGjQwHEXxafVFt8xBFUXWv2pdHS. Public sources were visually screened before seeded stratified selection (20261003), and each selected image has its source URL, SHA256 and dimensions recorded. Includes StockCharts, TradingView, MetaTrader and six other platforms. Many examples are educational and annotated; this is a stress/replay corpus, not independent human-labelled semantic ground truth.

Forty HTTP attempts: 11 completed (200), two provider failures (503), 27 application-budget rejections (429). No completed customer-original scans in this new batch. Budget rejections explicitly state no request reached the AI provider. Do not report forty scans as passed, bypass the quota, or retry failures until they pass. Preserve first-attempt outcomes and resume blocked cases only after the normal quota window resets.

The eleven completed reports were replayed through original-raster OCR, grid detection, candle components and production precision guards. All eleven axes held, all price-dependent drawings withheld. Several visibly readable StockCharts/TradingView sources have no horizontal grid; current verifier requires independent grid rows. This is a functional coverage gap, not proof of successful detection. Other formats have unreadable or ambiguous independent labels/components. Do not loosen 1.5 original-pixel axis fit or 2 original-pixel endpoint checks to force positive findings.

The two 503 cases (public-05 and public-07) ran about 95 seconds. Runtime logs show the original report reached max_output_tokens at 14,000, while the bounded recovery had not completed at the overall deadline. Precision attempts completed. Keep partial reports rejected. Root cause is still being investigated; no provider-timeout fix has been validated.

## Evidence and next steps

Scratch audit-output/full-app-2026-10-03 contains the selected manifest, scripts, per-case receipts and all forty replay dispositions. Durable evidence archive still needs saving. Original-chart evidence from previous work is separate and must not be counted as fresh batch results.

Next: inspect report generation limits without reducing evidence; investigate strict original-axis tick witnesses for gridless sources; verify new calendar copy in the browser; complete remaining normal-budget scans after cooldown; save results and resumable checkpoint. Native iOS purchase/restore, permissions and device memory checks remain unavailable in this Linux environment. The human-labelled release golden manifest is still empty; passing code tests does not satisfy that release gate.
