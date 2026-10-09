# Pocket Bullseye continuation — 2026-10-09

Status: RELEASE HOLD. PR #112 remains draft and unmerged.
Only candidate branch `qa/image-torture-corpus-2026-10-07` is authorised.
Resolve the newest exact SHA from that PR; this checkpoint travels with the source.

## Ownership and regressions

At takeover, PR head stayed at `936d7dc980fa90b8b1a47274f85007241d9296ad` across repeated reads. The scheduled Scanner Fixer was disabled; the three enabled supporting workers were explicitly read-only. No conflicting writer was observed. Every branch update uses an expected-head lease and a fast-forward.

The two previously failing chart-identity/preflight tests are fixed. Additional free behavioral tests execute the actual callback source with deferred mock image reads, cache/crop preparation and HTTP responses. These reproduce races without a provider call; they do not prove full deployed mobile usability.

Verified fixes:
- Guard actual primary/supporting uploads and full analysis success/error callbacks by monotonically increasing chart identity. Ignore old reads and responses; invalidate confirmation on chart replacement/removal. Check identity before dispatch after asynchronous cache/crop work.
- Cancel stale preflight body callbacks after cleanup, even when transport abort does not prevent body completion; parent callbacks also check chart identity.
- Correct the server confirmation regex, which rejected ordinary numeric prices. Preserve trader-locked instrument/timeframe/current price across precision merges before calibration, including empty model price markers.
- Reject missing/null/malformed scanner fields as unmeasured benchmark output instead of passing a negative/no-signal fixture. Both runners record the exception; explicit empty arrays with `NONE` liquidity remain legitimate.
- Prevent blank/missing precision prices from becoming numeric zero and falsely satisfying a price side.
- Guard independent Levels file reads and scan completions against replacement of either the main chart or the Levels input.
- Reject repeated pattern coordinates masquerading as distinct visible swing anchors.
- Do not credit pattern names or liquidity zone placeholders as benchmark true positives without defensible geometry. Invalid claimed detections produce FP/FN.
- Keep HTTP failures (including 429), exceptions and errors unmeasured even if an offline report also carries apparently valid counters.

## Free verification

Final local code: 858 unit tests passed; 30 targeted race/locked-facts/pattern/scoring tests passed; typecheck passed; lint had zero errors and eight existing warnings. Four component render tests and eight production simulation tests passed after callback wiring. Secret scan and operations-document validation passed.

Already durable checkpoints:
- `a88eb29b0e0d581a7a18f340bd60a96ede895aec`: quality run 37967047270 SUCCESS; image packaging run 37967047162 SUCCESS. Exact Vercel `dpl_FGog271JHtRc4VhihbRY5gxrcX27`, `nash-ai-markets-knj5urfq4-nash-ai-markets.vercel.app`, READY at that SHA. Independently GET `/pocket` 200 and six-fixture raster path 200, pass=true, providerCalls=0.
- `44f1679130f2c9a2fe9a289bd9af59cef1dc2820`: quality run 37967383486 SUCCESS; image packaging run 37967383404 SUCCESS.
- Inspect final PR-head CI and immutable Vercel deployment after this checkpoint is pushed. Earlier green checkpoints cannot substitute for final exact-SHA evidence. Live provider stages are intentionally skipped.

## External release blocker

Actual six-image live Levels/Patterns/Liquidity TP/FP/FN, precision, recall, provider compliance and latency remain UNMEASURED in this continuation. The current owner instruction prohibits every paid API call, so do not run `/api/pocket/analyse`, `/api/pocket/preflight`, `/api/pocket/levels`, golden provider runners or the live torture workflow. Free raster proof and deferred mocked callbacks are not scanner accuracy evidence. Prior test-spend reconciliation does not authorise new spending under this instruction.

No main changes, merges, Apple actions, pricing changes, purchases or paid API calls were made. Command-line Git push lacked credentials; connected GitHub Git-data tools preserve test-first commit order and verified trees without obtaining credentials. Remain on the candidate and stop if a conflicting writer or genuine external blocker appears.

Resume by inspecting newest exact head and its complete CI/preview proof, then act only on newly reproduced free defects. Preserve RELEASE HOLD until genuine scanner measurements and customer-flow validation are available within explicit owner authorisation.
