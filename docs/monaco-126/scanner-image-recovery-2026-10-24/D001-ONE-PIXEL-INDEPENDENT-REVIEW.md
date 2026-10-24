# Independent d001 browser geometry review

**PASS_GEOMETRY_ONLY** — all four plot edges, seven grid-aligned OCR anchors, four projected price candidates and four rendered SVG lines are within the unchanged **1 original pixel** tolerance on the 1400×850 source.

## Aggregate errors

| Measurement | Count | Maximum error, original pixels |
|---|---:|---:|
| Plot edges | 4 | 0 |
| OCR/grid anchors | 7 | 0.5 |
| Projected candidate rows | 4 | 0.214202837 |
| Rendered SVG rows | 4 | 0.214202837 |

## Anchor rows

| Price | Measured grid row | Reference row | Absolute error |
|---|---:|---:|---:|
| 7757.31 | 125 | 125 | 0 |
| 7752.3317 | 212 | 212.499414128 | 0.499414128 |
| 7747.3533 | 300 | 300.000585872 | 0.000585872 |
| 7742.375 | 388 | 387.5 | 0.5 |
| 7737.3967 | 475 | 474.999414128 | 0.000585872 |
| 7732.4183 | 563 | 562.500585872 | 0.499414128 |
| 7727.44 | 650 | 650 | 0 |

## Candidate rows and actual SVG lines

| Reported price | Projected/SVG row | Reference row | Absolute error |
|---|---:|---:|---:|
| 7752.3317 | 212.428068434 | 212.499414128 | 0.071345694 |
| 7747.3533 | 300.000628028 | 300.000585872 | 0.000042156 |
| 7742.3750 | 387.571428571 | 387.5 | 0.071428571 |
| 7732.4183 | 562.714788709 | 562.500585872 | 0.214202837 |

The four SVG line coordinates exactly match their corresponding projected coordinates. Left/right endpoints are 90/1250 pixels (right-end floating-point difference below 3e-13 pixels). All endpoint distances also pass the one-pixel bound.

OCR text was associated with independently measured grid rows. Raw glyph centres are approximately 2 pixels above those rows; those centres are not claimed to pass the anchor-row benchmark.

## Scope and provenance

Assay SHA-256: `ea8cccd80d4833e4b8a1b1b71013d0ce81f67182593d2df50a05d912dd0aa651`. Calibration entry SHA-256: `e57e1420368b454f6751580d87641c052ca754c6abb6e2baf04109676f3171ae`. Bundle SHA-256: `91da0d22a88dcee0d27d342d524f77354d559312406d4f51fd579ba025e6f7a0`. All 9 assay source-file hashes match the current worktree. Exact numeric calibration tick matches were used; neither tolerance nor oracle changed. No production module was used to compute the reference comparison.

The legacy axis stayed held, legacy candle pixels stayed null, calibrated levels stayed empty, and calibrated scaleReadable stayed false. Only the separately measured horizontal candidate placement rendered. Pattern/liquidity overlays stayed empty.

**Semantics remain UNSCORED.** This result does not establish support/resistance meaning, recall, pattern/liquidity accuracy, verified absence, other-image performance, production deployment or physical-device/deployed-HTTP latency. The reported elapsed browser time is not accepted as a latency benchmark.

No browser, provider, network, database, extra raster, held-out or private-key operation was performed for this independent review. Only the calibration entry was decoded from the private bundle. Full numeric evidence and source/input pins are in D001-ONE-PIXEL-INDEPENDENT-REVIEW.json.
