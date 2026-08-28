# Pocket Bullseye golden regression library

This library turns previously failed customer chart screenshots into permanent acceptance tests.

For each approved screenshot, record the instrument and timeframe, the expected vertical position of each clearly visible support or resistance zone, an allowed tolerance, acceptable immediate directional leans, and phrases that must never be used when the structure is already visible.

The tracked manifest lives beside the approved fixtures. Every case records a SHA-256 image fingerprint, review date, reviewer, consent basis and redactions; the runner refuses an image if a single byte changes after review. With no approved images registered, the normal runner reports that intake is ready rather than pretending synthetic data is a real-chart pass.

The release gate requires at least 30 privacy-approved charts across at least four scenario families and three timeframes. It blocks release below 90% required-guide recall, below 85% complete-chart pass rate, or above one unsupported extra guide per ten charts. Run it with `npm run verify:pocket-goldens:release`.

Image coordinates use the entire submitted screenshot: `0%` is the top and `100%` is the bottom. Production overlays remain restricted to `5–95%`. Default tolerance should be `±6%`; tighten it only when the screenshot crop is stable.

Privacy rules:

- Crop or redact names, account numbers, balances, notifications and order details before adding an image.
- Store only deliberately approved regression screenshots.
- Fingerprint each approved image and require a new privacy review after any edit.
- Never use customer screenshots as marketing material.
- Do not infer exact prices from pixels.
- Never upload or retain a chart automatically from in-app feedback. A person must redact it, obtain the permitted source/consent basis, and explicitly register it.

An accepted result must keep every required visible guide inside tolerance, meet the minimum confidence, use an allowed immediate lean, and avoid evasive fallback text such as “add another timeframe” when the submitted chart already contains the required evidence.

Run `npm run verify:pocket-goldens` only in the protected staging workspace with the chart-analysis provider configured. It sends each approved screenshot for a fresh non-stored analysis and fails on missing levels, drift outside tolerance, insufficient confidence, unexpected direction, changed image bytes or forbidden fallback wording.

Each manifest case must also declare `scenario`, accepted `expectedReadability`, `maximumExtraGuides`, and a complete `privacyReview`. Suggested intake balance for the first 30 charts is 8 ranges, 8 trends, 7 breakouts and 7 reversals, distributed across 5m, 15m and 1h charts. Include clear and deliberately difficult screenshots; do not fill the library with near-duplicates just to reach 30.
