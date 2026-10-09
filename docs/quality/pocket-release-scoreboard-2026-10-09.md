# Pocket Bullseye release scoreboard — 9 October 2026

**RELEASE HOLD.** Candidate only: `qa/image-torture-corpus-2026-10-07`, PR #112. No merge, public launch, Apple submission, price change, purchase or paid test authorised. Work Jimmy is the sole writer; independent QA stays read-only.

## Exact verified product fix

Commit `97e7082bb159d5999125621f1850bc06f629d81d` fixes:
- Failed preflight cannot silently unlock analysis. Manual recovery requires instrument, timeframe, a well-formed positive finite price, and explicit visible-scale/candle acknowledgement.
- Known context mismatch cannot lock; unknown match requires an explicit trader acknowledgement. UI distinguishes trader confirmation from detected MATCHED.
- Known unreadable candles, missing scale and RETAKE remain blocked even after acknowledgement.
- All shared full-analysis dispatches, including corrections and reanalysis, require a confirmation lock and chart confirmation.
- Existing chart-identity guards continue to clear confirmations on replacement and reject stale reads/responses.

Six newly added safety tests initially failed before corrections. Local final fix: 864/864 unit tests, 4/4 render, 8/8 production simulations, 1/1 rendered artifact test; typecheck, lint, secret scan, operations validation and production artifact build pass. Nine native/raster tests pass.

Exact GitHub runs: quality `37972073257` and image packaging `37972073165` completed SUCCESS. Every mandatory quality step completed successfully. Image packaging includes isolated Next.js production Sharp/libvips trace rasterisation. **Its live provider measurement stage was SKIPPED, not passed.**

Exact Vercel: `dpl_6VWuQ9C83oaT3vMHMx4JErhBEwPe`, `https://nash-ai-markets-ar67fgbbz-nash-ai-markets.vercel.app`, READY for that SHA.

## Free browser evidence on that exact preview

Chromium with 390×844 viewport, touch/mobile emulation. All API requests intercepted: mocked preflight/analysis only, all other API requests aborted. No provider requests. This is not physical iPhone/Safari or native-app validation.

Seven flows pass: primary upload + visible-axis confirmation; replacement clears locks; mismatched context blocks confirmation/analysis; unknown context needs explicit acknowledgement; 503 manual fallback + malformed-price rejection; mocked analysis dispatch + safe error; missing price scale blocks lock. Six mock preflights and one mock analysis; zero JS errors; document width 390px in 390px viewport.

Reusable command after verifying the immutable preview SHA:
`node scripts/verify-pocket-mobile-free.mjs https://<exact-candidate>.vercel.app`
Its timings describe mock UI flows, never provider latency.

## Raster determinism

Three repeated local renders for every one of the six labelled fixtures at `97e7082`: all decoded RGBA pixel SHA-256 hashes identical, both full 900×600 PNG and production-shaped 1400×765 JPEG crop. Zero provider calls. At `63c77d033e08951aaf75faef0061edb777938d04`, the new decoded-hash route reproduced real deployed pixel variation across three requests (full header labels; two precision crops also differed). Raw evidence is preserved in `pocket-raster-nondeterminism-63c77d0.json`. Removed all system-font text from fixture headers and retained readable vector instrument/timeframe glyphs, including lowercase m/h. Repeated final-candidate deployed hashes must be verified; do not reuse the earlier local PASS as deployed proof. Neither result proves scanner accuracy.

## Financial protection

The token/enablement gate and in-memory per-IP request counters do not enforce cumulative dollar spending. Added a hard hold to both preview and CLI billed benchmark entry points, even with correct opt-in secrets or a selected case. Free rasterisation remains before the hold. Regression coverage executes both actual guard sections and verifies no dispatch.

This hold prevents benchmark expenditure; it is **not** a completed dollar-accounting/reservation system. Removing it requires authoritative historical request/project attribution and dollar costs, settled/pending charges, separate exact owner approval, and a durable shared atomic reservation ledger covering all calls/retries. Never use fresh process state, account credit, organisation totals or environment snapshots as remaining allowance.

## Open gates

| Gate | Status | Remaining proof |
|---|---|---|
| Latest fix CI and packaging | PASS at `97e7082`; check successor | Completed checks at newest exact head |
| Preflight safety | PASS free regression/browser evidence | Physical-device confirmation usability |
| Upload / replacement | PASS emulated browser and deferred callbacks | Physical iPhone and wider device coverage |
| Cancellation / connectivity | Regression PASS; browser pending | Added abortable full-analysis transport, cancel control, replacement abort, and stale-finally guard. Final preview delayed-mock browser verification required; real provider latency unavailable |
| Scanner accuracy: Levels | UNMEASURED | Six genuine TP/FP/FN, precision, recall and latency observations |
| Scanner accuracy: Patterns | UNMEASURED | Same, including no-signal/ambiguous negatives |
| Scanner accuracy: Liquidity | UNMEASURED | Same, including sweep/Evidence Chain outcomes |
| Budget | HOLD | Attribution/settlement, durable reservations, separate expenditure approval |
| Subscription purchase / restore | UNVERIFIED | Native app / Apple sandbox access and free real customer flow |
| Production runtime | PARTIAL | Preview verified; production release/runtime intentionally untouched |
| Independent exact-candidate signoff | PENDING | Read-only QA audit of final candidate |
| Final launch | BLOCKED | Every gate above, then explicit owner approval |

## Continuation

Resolve newest PR head first. Do not resume from the SHA in this historical evidence section. Scanner Fixer paused during this interactive writer; restore only after the writer finishes and make it skip completed defects. Supporting Fixture Lab, Quality Gate and Release Judge remain read-only. Check active writers and expected branch head before every write.

Additional verified local fixes: strict server confirmation grammar and 400 rejection before provider setup (including context without asserted match); abortable analysis transport and cancellation regressions; deterministic vector fixture labels. Latest local counts and exact successor CI/preview/browser proof belong in the final GitHub checkpoint. Next safe work: physical-device validation and durable dollar-reservation implementation using an authorised existing backing store, without provider calls. Do not treat prepared fixtures or successful CI as measured scanner accuracy. Native subscription and actual scanner measurement remain external blockers.

Final release preparation must include the exact release SHA, verified target deployment, migrations/configuration, native build, smoke checks and a known-good rollback. Do not execute any release until independent signoff and explicit owner launch approval.
