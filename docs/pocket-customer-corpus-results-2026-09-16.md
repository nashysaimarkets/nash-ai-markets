# Real-chart image-measurement baseline

Run date: 16 September 2026. Dataset: `tests/fixtures/pocket-customer-corpus/manifest.json`.

33 distinct owner-supplied IG chart screenshots were visually inspected, hash-checked and measured. The images cover indices, forex, crypto and shares/ETF, ten timeframe labels, portrait/landscape captures and light/dark appearances. Original private images are not committed to the app repository or shipped in its assets.

| Check | Observed result | What it means |
|---|---|---|
| Chart recognition | 33 / 33 | The pixel extractor accepted the image as a chart. |
| At least eight detected candles | 33 / 33 | A detection-count check, not verified candle-location accuracy. |
| Repeated extraction | 33 / 33 identical | Deterministic output for repeated input within this run. |
| No exact prices emitted by this stage | 33 / 33 | The pixel stage did not manufacture a price field. It does not test the AI's prices. |
| Local pixel measurement median | 4.86 ms | First measurement only; image decode, upload, network and AI analysis are excluded. |
| Local pixel measurement p90 | 13.21 ms | Same narrow timing scope; not phone performance or scan completion time. |

Reproduction, with the original image directory supplied locally:

```sh
node --import tsx prototype/chart-extraction/benchmark-customer-engine.ts /path/to/approved-images tests/fixtures/pocket-customer-corpus/manifest.json
```

The runner rejects an image whose hash differs from the manifest. The original 20-image development manifest remains the default when no third argument is supplied.

This corpus is not an independent holdout. It has no non-IG platform, gold or oil coverage. It does not establish OCR accuracy, correct current prices, support/resistance recall, pattern accuracy, outcome prediction or full AI repeatability. The existing golden manifest remains empty rather than being filled with fabricated expected labels.

The current site's separate 30-day anonymous activity query returned four completed web scans averaging 110,131 ms. These are event counts, may include the owner, and cannot establish unique customers, conversion or the present latency distribution. New timing histograms start with this deployment; historical events are not retroactively assigned invented timings.

Full customer-path analysis was not run: the local environment lacks the analysis-provider credential, hosted secret values are masked, and a public endpoint connectivity probe timed out. No credential or network restriction was bypassed. See `pocket-development-rollout-2026-09-16.md` for the independent labelling and actual-customer-path validation requirements.
