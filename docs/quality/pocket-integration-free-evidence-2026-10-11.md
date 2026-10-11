# Pocket integration free verification — 11 October 2026

RELEASE HOLD. This evidence covers candidate engineering and free safety checks; it does not accept scanner accuracy, native compilation or purchases.

## Verified application source

Commit `12c7cf28bb172f319a69464acdd46768f468a954`, tree `650689e3e0347f204c5685f90d000a5ed5aec01a`.

- Quality run [38136622726](https://github.com/nashysaimarkets/nash-ai-markets/actions/runs/38136622726): every mandatory step passed, including secret scan, typecheck, lint, unit/render tests, production safeguard simulation, operations validation, build and rendered artifact verification. Local source results: 922 unit tests, 4 render tests, 8 production simulations; zero unit failures/skips; lint zero errors/eight existing warnings.
- Image run [38136622769](https://github.com/nashysaimarkets/nash-ai-markets/actions/runs/38136622769): native rasterization, Next function tracing and isolated production-trace rasterization passed. Paid labelled-image step **SKIPPED**.
- Matching preview `dpl_2JS6rvf4KeVyDZaGMtfZzx9CYDt7` READY at `https://nash-ai-markets-6kp1osu2o-nash-ai-markets.vercel.app`; Vercel Git metadata and deployed `/api/pocket/build-manifest` both match the full commit above. Native immutable-server verifier passed against this URL and SHA. This is a web pin check, not a signed native build.
- `/pocket` and `/pocket-next` returned HTTP 200. Anonymous requests to all seven billed routes (`preflight`, `analyse`, `levels`, `review`, `follow-up`, `options-wall`, `crypto-derivatives`) and Apple account GET returned HTTP 401 before provider dispatch.
- Deployed free raster endpoint `GET /api/pocket/torture?run=1&raster=1`: six fixtures, `pass=true`, `providerCalls=0`. Same-origin OCR worker, English language file and selected SIMD LSTM core JavaScript/WebAssembly assets returned HTTP 200.

## Browser checks

Both scripts require an independently verified immutable Vercel preview origin, reject non-Vercel origins and intercept **every `/api/**` request** before dispatch, mocking only the specified preflight/analysis paths and aborting the others. Results below are Chromium mobile emulation at 390×844, not Safari, Capacitor or a physical iPhone.

- `scripts/verify-pocket-mobile-free.mjs`: nine checks passed; eight mock preflights, three mock analyses; zero provider calls, zero browser JavaScript errors; document width 390 at viewport 390. Covers lock, replacement, identity mismatch/acknowledgement, manual fallback/invalid price, missing scale, safe failure, in-flight cancellation and stale-response rejection.
- `scripts/verify-pocket-next-free.mjs`: six checks passed; two mock preflights, three mock analyses; zero provider calls, zero JavaScript errors; document width 390 at viewport 390. Covers image-bound lock and confirmed request payload, safe failure, cancellation, replacement/stale rejection, explicit synthetic demo tabs and reset.
- Reproduced harness race: waiting only for the cancel button allowed cancellation during crop generation before a third mock dispatch, so the fixed `analysisCalls=3` assertion failed with two calls although UI checks passed. The checker now waits for the expected intercepted dispatch before cancelling/replacing. This fixes the test's timing assumption and does not count as a new customer defect.
- Redesign error removal is checked with Playwright's retrying locator assertion to wait for React's committed DOM state.

This follow-up changes verification scripts/documentation only. Its exact successor SHA, CI and matching preview must be resolved from the subsequent PR #112 coordination comment before reuse.

## Outstanding engineering and genuine acceptance

Server first-free eligibility and atomic consumption are **not implemented**. Native Keychain flags cannot authorize a server request. A native-only offer also needs trustworthy server eligibility; a client platform header cannot supply it. Preflight, retry, cancellation and multiple-device consumption rules need durable enforcement before any free access is enabled.

Legacy Apple purchases without an account token require an independently verified ownership reconciliation. Apple server configuration, signed Swift build, physical-device and purchase/restore/expiry/refund/grace acceptance remain unverified. PR #95 Patterns/Liquidity/candle endpoints and wider integration remain open; `/pocket-next` tool parity and activation remain open. The acceptance matrix is `pocket-native-integration-acceptance-2026-10-11.md`; the master blocker register remains authoritative.

Zero paid API calls, purchases, pricing changes, production migrations, main merges or Apple submissions. The cumulative $2 testing allowance remains unreconciled. No TP/FP/FN, precision/recall or paid scanner latency acceptance is claimed.
