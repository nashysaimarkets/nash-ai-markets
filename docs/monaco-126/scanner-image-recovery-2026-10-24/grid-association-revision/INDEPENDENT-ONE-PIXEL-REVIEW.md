# Independent one-pixel review: grid-association revision

All five completed browser receipts are bound to the frozen detector and axis-helper snapshot. The unchanged threshold is one original pixel. The review scores emitted geometry and preserves omitted candidates separately.

| Case | Placed / exact hints | Max plot-edge error px | Max OCR/grid error px | Max projected-endpoint error px | Max rendered-endpoint error px | Result |
|---|---:|---:|---:|---:|---:|---|
| d001 | 4/4 | 0.000000 | 0.500000 | 0.214203 | 0.214203 | PASS emitted geometry |
| d002 | 2/3 | 0.000000 | 0.500000 | 0.214285 | 0.214285 | PASS emitted geometry |
| d003 | 2/2 | 0.000000 | 0.500000 | 0.285405 | 0.285405 | PASS emitted geometry |
| d004 | 1/2 | 0.000000 | 0.500000 | 0.071429 | 0.071429 | PASS emitted geometry |
| d006 | 2/2 | 0.000000 | 0.500000 | 0.071429 | 0.071429 | PASS emitted geometry |

## Coverage defects

- d002: resistance price 84654.0416 is an exact OCR anchor at 125 px and inside the verified numeric domain. The global fit yields 124.8571437902082 px, 0.1428562097918018 px above the plot. The frozen containment guard drops it.
- d004: resistance price 779.2864 is an exact OCR anchor at 105 px and inside the verified numeric domain. The global fit yields 104.92857142858837 px, 0.07142857141163006 px above the plot. The frozen containment guard drops it.

The 11 rendered candidates out of 13 exact hints do not establish complete recall. No omitted row is credited as accurate or as verified absence.

## Scope

Semantics, trading interpretation, pattern/liquidity accuracy, held-out performance, physical-device latency and deployed HTTP latency remain unaccepted. d005 remains HOLD because the support/resistance price strings are approximate; those kinds are present. No approximation marker was stripped.

The comparator reads only the five authorized calibration entries after browser execution. It independently calculates reference coordinates, checks input/source hashes, and verifies actual SVG endpoints against both the projections and reference. No browser, detector, OCR, provider, database or key operation runs.

Detector SHA256: 819917bd5e09ed696a66cff61eaad6aa3e4d32940f18a38002850d4dfa523c48

Axis helper SHA256: 1689f43e6d2ea88e7aba96e44b5d802d441240b99bfbc1fa28368b3584cdebb2

Source manifest SHA256: b9bebc8ba984ed94a30618eefaacca5cc6e1c4de000a9c10444c698cde20653f

Comparator SHA256: 680264dc11ae88dabc5f2c66dda980ebcc96f101a0a8192d0b278d4a808d6081
