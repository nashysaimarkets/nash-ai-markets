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

## Remaining release gates / next actions
1. Inspect exact current PR head CI; reproduce any genuine failure before fixing. Read its immutable Vercel deployment git SHA, then GET /pocket and /api/pocket/torture?run=1&raster=1 only (zero-provider raster path).
2. Verify the previous live request's full billed usage/charge and remaining amount under the $2 cap from authoritative accounting. Until then, do not call the live torture route, analyse endpoint, golden AI runner or run_live workflow.
3. Once accounting permits it, perform the six-image live scanner benchmark within the verified remaining cap. Record every request, cost, latency, response and TP/FP/FN by scanner. Stop if costs cannot be bounded/accounted for.
4. Validate the new observation contract on real labelled output; check chart overlays/price calibration/readability, then add regression tests for every reproducible miss without weakening gates.
5. Keep RELEASE HOLD until every release gate passes. Main, Apple, pricing and purchases remain prohibited; final launch needs explicit approval.

## Resume instruction
Continue PR #112 from its newest verified candidate. Read this checkpoint and the exact head's CI/deployment evidence, preserve existing tests, and verify the $2 cap ledger before any paid scanner call. Fix remaining reproducible failures only on the candidate branch. Never merge main, submit/release Apple, change pricing or purchase anything.
