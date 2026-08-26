# Pocket Bullseye golden regression library

This library turns previously failed customer chart screenshots into permanent acceptance tests.

For each approved screenshot, record the instrument and timeframe, the expected vertical position of each clearly visible support or resistance zone, an allowed tolerance, acceptable immediate directional leans, and phrases that must never be used when the structure is already visible.

The tracked manifest lives beside the approved fixtures. Every case records a SHA-256 image fingerprint and `privacyReviewed: true`; the runner refuses an image if a single byte changes after review. With no approved images registered, the runner exits cleanly and reports that intake is ready rather than pretending synthetic data is a real-chart pass.

Image coordinates use the entire submitted screenshot: `0%` is the top and `100%` is the bottom. Production overlays remain restricted to `5–95%`. Default tolerance should be `±6%`; tighten it only when the screenshot crop is stable.

Privacy rules:

- Crop or redact names, account numbers, balances, notifications and order details before adding an image.
- Store only deliberately approved regression screenshots.
- Fingerprint each approved image and require a new privacy review after any edit.
- Never use customer screenshots as marketing material.
- Do not infer exact prices from pixels.

An accepted result must keep every required visible guide inside tolerance, meet the minimum confidence, use an allowed immediate lean, and avoid evasive fallback text such as “add another timeframe” when the submitted chart already contains the required evidence.

Run `npm run verify:pocket-goldens` only in the protected staging workspace with the chart-analysis provider configured. It sends each approved screenshot for a fresh non-stored analysis and fails on missing levels, drift outside tolerance, insufficient confidence, unexpected direction, changed image bytes or forbidden fallback wording.
