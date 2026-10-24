# Independent one-pixel review: final combined exact-anchor revision

All five completed browser receipts are bound to the final frozen detector and axis-helper snapshot. The unchanged threshold is one original pixel. All 13 eligible exact-price candidates are emitted and independently scored.

| Case | Placed / exact hints | Max plot-edge error px | Max OCR/grid error px | Max projected-endpoint error px | Max rendered-endpoint error px | Result |
|---|---:|---:|---:|---:|---:|---|
| d001 | 4/4 | 0.000000 | 0.500000 | 0.500000 | 0.500000 | PASS emitted geometry |
| d002 | 3/3 | 0.000000 | 0.500000 | 0.499996 | 0.499996 | PASS emitted geometry |
| d003 | 2/2 | 0.000000 | 0.500000 | 0.000000 | 0.000000 | PASS emitted geometry |
| d004 | 2/2 | 0.000000 | 0.500000 | 0.000000 | 0.000000 | PASS emitted geometry |
| d006 | 2/2 | 0.000000 | 0.500000 | 0.500000 | 0.500000 | PASS emitted geometry |

## Coverage in these five receipts

All 13 eligible exact-price candidates are placed. The previously omitted d002 price 84654.0416 and d004 price 779.2864 now use their independently observed top grid rows, at 125 and 105 original pixels respectively. Their final endpoint errors are effectively zero. The earlier 11/13 review remains unchanged historical evidence.

This covers only the exact candidates accepted by the unchanged collector from these five retained MAIN responses. It does not establish complete chart-level recall or semantic accuracy.

## Scope

Semantics, trading interpretation, pattern/liquidity accuracy, held-out performance, physical-device latency and deployed HTTP latency remain unaccepted. d005 remains HOLD because the support/resistance price strings are approximate; those kinds are present. No approximation marker was stripped.

The comparator reads only the five authorized calibration entries after browser execution. It independently calculates reference coordinates, checks input/source hashes, and verifies actual SVG endpoints against both the projections and reference. No browser, detector, OCR, provider, database or key operation runs.

Detector SHA256: 819917bd5e09ed696a66cff61eaad6aa3e4d32940f18a38002850d4dfa523c48

Axis helper SHA256: 91c639609ef9581d7536d2191a55c0b705e3b30cf501f60d2beff7856c890da3

Source manifest SHA256: d8ac2596538c05824275058f861179afa01fdc607901fe10568963327a9d4934

Comparator SHA256: 7a2b0e16f50798766526e9eb2d80d03b8cd701cc0062037fc403a05fbb06db01
