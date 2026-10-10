# Pocket Bullseye autonomous checkpoint — 2026-10-08
Status: RELEASE HOLD. Repository: nashysaimarkets/nash-ai-markets. PR: #112 (draft).
Candidate branch: qa/image-torture-corpus-2026-10-07.
This file belongs to the candidate source commit. Resolve its exact SHA from the PR head; always inspect the newest head and its checks before resuming.

## Verified changes in this session
- c5e4652b943bae40471d811f4654165d25b6634e: corrected the glyph-count test (110/105/100/95/90 contain 13 digits, not 15), with exact per-label digit and drawable-stroke assertions.
- 9bf1f5b3ed3f85bc641bf91134f55804249b4b31: shared one-to-one scorer for both runners. Duplicate levels/patterns count as FP; one detection cannot satisfy two labels; liquidity TP requires exact state/event and minimum zones.
- 7119f2c33af9fdb30e77192c19706792621a2207: centred vector glyphs on their declared calibrated rows. Regression reproduced the prior seven-pixel offset.
- 4509c3739a9dee44d86942db8d00595137e3d2ae: production Evidence Chain adapter. Only explicit model-supplied screenshot observations are accepted; no fabricated observations from zone endpoints. Every displayed zone requires independent observations within its span and calibrated row. Malformed/duplicate/off-chart/opposite-side observations, unclear charts and invalid raw bounds cannot verify a chain. Missing corroboration retains valid visible geometry as PARTIAL. Explicit NONE is not upgraded.
- This commit: both benchmark runners report measured/unmeasured case IDs; aggregate precision/recall are null for incomplete runs.

## Evidence and limitations
- Local final source: typecheck passed; 830 unit tests passed, zero failures/skips.
- Evidence Chain targeted suite: 33 tests passed. Component render suite: 4 passed. Production simulation: 8 passed.
- Lint passed with 7 existing warnings, zero errors before the final reporting-only change. Final exact-commit CI is the authority for lint/build/render checks.
- Secret scan and operations documentation validation passed earlier in this session.
- 7119f2c33af9fdb30e77192c19706792621a2207: quality CI run 37824482350 success; packaging CI run 37824482414 success. Live-scan step explicitly SKIPPED.
- Matching 7119f2 preview dpl_D1JjjrqY1oe8EPXRMrqkS452Ftm4, nash-ai-markets-m4l7hi6zh-nash-ai-markets.vercel.app: READY; /pocket HTTP 200; six raster fixtures HTTP 200, 900x600 PNG plus 1400x765 JPEG precision crops, providerCalls=0.
- Final commit: inspect its own GitHub Actions runs and immutable Vercel deployment; do not substitute the earlier preview. Automated proof is retained with the commit in GitHub/Vercel.
- Scanner Levels/Patterns/Liquidity image-level TP/FP/FN, precision, recall and actual end-to-end latency: UNMEASURED for all six cases in this session. Offline scorer assertions are not real scanner results.
- The explicit-observation provider schema compiles and is covered offline; live provider compliance/accuracy is not verified.
- No billable API requests made in this session. Prior history records one live request under the authorised $2 existing-credit cap, but its charge and the remaining allowance are unverified. No complete ledger/billing access was found. Never assume zero prior spend.

## Security continuation and verified free preview, 2026-10-08 evening
- Confirmed original candidate a254cb979bb693446b45a26d568d3eab1df3e901: quality workflow 37825797344 and image packaging workflow 37825797348 both succeeded; paid image torture was SKIPPED.
- Wrote regression tests first (f36069646ca9d54490df0ff564af947c5730b56d), added secret/enablement comparison helper (d7871b8bfd0e6f798c7654c78283261a00345223), then gated the preview live torture endpoint (7696292550d128505993d5c9067a7a2da14abf23). A public preview URL alone no longer authorizes billed AI analysis; raster-only path remains free. Authorization is deliberately disabled until server-only POCKET_TORTURE_LIVE_ENABLED=true and a secret of at least 32 characters POCKET_TORTURE_LIVE_TOKEN are configured, with a matching x-pocket-torture-token request header.
- 7696292 quality CI 37826719205: 833 unit tests passed, 4 render tests passed, 8 simulation tests passed, but the ops documentation gate caught undocumented variables. docs/ENVIRONMENT_VARIABLES.md was updated in 38123dddaa21269198c3d26c9d78c7ebcc51a591 to resolve that genuine red.
- 7696292 image-torture packaging workflow 37826719168 succeeded, billable scanner step skipped. Exact Vercel deployment dpl_AMHgCVrHaP8et8duAbsTLQDah414 READY, at nash-ai-markets-6rqf9pb5s-nash-ai-markets.vercel.app. Verified GET /api/pocket/torture?run=1 returned HTTP 403 Live benchmark not authorized. GET /api/pocket/torture?run=1&raster=1 returned HTTP 200, six PNG/raster + precision-crop fixtures passed, providerCalls=0.
- No paid API calls were made in this continuation. Full prior-call billing and remaining $2 budget are still UNVERIFIED, so live six-image TP/FP/FN, precision/recall and latency remain UNMEASURED. Await final exact-head CI and Vercel proof after documentation update. Never use the green packaging CI as evidence of live scanner accuracy.

## Remaining release gates / next actions
1. Inspect exact current PR head CI; reproduce any genuine failure before fixing. Read its immutable Vercel deployment git SHA, then GET /pocket and /api/pocket/torture?run=1&raster=1 only (zero-provider raster path).
2. Verify the previous live request's full billed usage/charge and remaining amount under the $2 cap from authoritative accounting. Until then, do not call the live torture route, analyse endpoint, golden AI runner or run_live workflow.
3. Once accounting permits it, perform the six-image live scanner benchmark within the verified remaining cap. Record every request, cost, latency, response and TP/FP/FN by scanner. Stop if costs cannot be bounded/accounted for.
4. Validate the new observation contract on real labelled output; check chart overlays/price calibration/readability, then add regression tests for every reproducible miss without weakening gates.
5. Keep RELEASE HOLD until every release gate passes. Main, Apple, pricing and purchases remain prohibited; final launch needs explicit approval.

## Resume instruction
Continue PR #112 from its newest verified candidate. Read this checkpoint and the exact head's CI/deployment evidence, preserve existing tests, and verify the $2 cap ledger before any paid scanner call. Fix remaining reproducible failures only on the candidate branch. Never merge main, submit/release Apple, change pricing or purchase anything.
