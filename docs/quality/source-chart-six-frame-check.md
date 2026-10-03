# Source-chart overlay: six owner screenshots

Checked 1 October 2026 against the source-chart preview. These are screenshot snapshots, not verified current market data. All six PNGs have original dimensions 1179 × 2556.

## Method

Each original PNG was sent separately to the preview's `/api/pocket/analyse` endpoint. All six returned HTTP 200. The measured request duration was 35–48 seconds per chart. This tests the API using original PNGs; it does not reproduce the normal client preprocessing, multiframe workflow or an end-to-end browser upload.

Prices were read visually from the source axes. Horizontal grid row centres were measured independently from original pixels. A least-squares fit over those measured ticks supplies a reference scale. Reference tick rounding residuals are 1.21–1.43 original pixels, so subpixel results below are approximate rather than proof of exact prices.

The new sparse raster detector also ran against each original PNG using the returned plot bounds. Its detected rows were supplied to the overlay gate. This corroborates tick row positions independently of the AI coordinates. It does **not** independently OCR the price labels, prove the scale type, or establish that the model chose meaningful market levels.

## Results

| File | Frame | Accepted overlay lines | Largest projected error versus measured reference | Result |
| --- | --- | ---: | ---: | --- |
| IMG_6871.png | 5m | 0 | — | Withheld: an axis anchor lies outside reported plot bounds; coordinates also disagree with the screenshot. |
| IMG_6872.png | 15m | 4 | 1.03 px | Pass for this response. |
| IMG_6873.png | 30m | 0 | — | Withheld by the new raster check. Previously passed internal scale consistency despite shifted/stretched coordinates. |
| IMG_6874.png | 1h | 4 | 1.19 px | Pass for the accepted, covered prices in this response. |
| IMG_6875.png | 4h | 4 | 1.67 px | Pass for this response. |
| IMG_6876.png | 1d | 3 | 0.18 px | Pass for this response. |

The raw 5m support/resistance coordinates differed from the reference by approximately 17–44 original pixels. The raw 30m coordinates differed by approximately 27–50 pixels. The four internally consistent 30m tick coordinates themselves differed by approximately 9–44 pixels: fitting AI coordinates to other AI coordinates was insufficient.

The gate now requires at least three independent raster rows, unique matches, and every reported price tick within two original pixels of a measured row. Its existing monotonicity, scale span, fit residual, source ownership, price coverage and per-line geometry checks still apply. It never snaps an uncertain report onto the closest grid row or fabricates replacement levels. If image pixels cannot be read, overlays are withheld.

## Limits and release assessment

Four of six single responses passed placement checks. This small set is not a general accuracy benchmark or evidence that levels are financially useful. Some candidate levels are excluded by coverage or provenance checks, and the accepted line count is not the total candidate count. A consistent but incorrectly read set of price labels could still align with real grid rows. Charts without measurable rules deliberately receive no overlay.

The six originals and complete API receipts remain out of the public repository. Regression tests retain only the necessary numeric 30m tick measurements and synthetic pixel fixtures.

Keep this feature in preview. Independent price-label validation and repeated tests through the actual upload workflow are needed before claiming precise, dependable placement across customer charts.
