# Pocket real-image benchmark — isolated 19 October 2026 patch

**Do not merge or deploy without reviewer acceptance. No paid provider cases have run.**

## Why

Existing `scripts/run-pocket-image-torture.ts` always generates **syntheticSvg**. Passing that as six real-market charts would be false evidence. This patch adds a separate offline-first real-image runner and six precise original-PNG SHA / input-JSON SHA pins. Original charts/reference overlays are externally supplied from the owner's private Library; none are committed here.

## Run offline, zero provider calls

Unpack the owner's `monaco-six-case-real-chart-inputs-2026-10-19.zip`. Set `POCKET_REAL_CORPUS_DIRECTORY` to its `prepared` folder.

```bash
POCKET_REAL_CASE=range-clear-01 POCKET_REAL_CORPUS_DIRECTORY=/private/prepared node --import tsx scripts/run-pocket-real-image-benchmark.ts
POCKET_REAL_CORPUS_DIRECTORY=/private/prepared node --import tsx --test tests/pocket-real-benchmark-fixture.test.ts
```

Run each one individually: range-clear-01, double-top-01, head-shoulders-01, sweep-reclaim-01, near-miss-chop-01, degraded-no-signal-01.

The script blocks all unrecognised IDs, changed source pixels, unapproved input keys, changes to instrument/timeframe/current price, missing real scanner fields, and missing original-coordinate pattern/liquidity evidence. The externally stored chart images/references are not redistributed.

## Paid calls are OFF

True provider dispatch additionally requires explicit per-run `POCKET_REAL_BENCHMARK_DISPATCH=true` and `POCKET_REAL_CORPUS_REVIEWED=true`, protected runner output path, plus the *pre-existing* `POCKET_BENCHMARK_PILOT_ENABLED`, exact candidate SHA, approved project/model/tier/prices/three-call bound, atomic $5 owner approval, persistent ledger, receipts, authoritative external billing attestation, and postflight reconciliation. It uses only the existing `withPocketTestSpendScope` -> app `POST` -> `recordPocketBenchmarkMeasurement` -> `releasePocketBenchmarkMeasurement` route, so an unverified provider result is never accepted merely because the HTTP request succeeded. One case per invocation. Never enable or dispatch in routine CI.

The independent corpus scorer `scripts/score.py` from the owner's saved original corpus computes Levels/Patterns/Liquidity TP/FP/FN in original 1400x850 source coordinates. Even after paid receipt verification, the six labels and GetData SPX500 instrument/feed provenance remain **PROVISIONAL**; an exploratory score is NOT release acceptance. `near-miss-chop` is only a verified no-confirmed-double-top negative; unlabelled predictions need adjudication.

## Specific outstanding gates

19 Oct read-only staging `pxlqvaddvghjjhenqmdh` confirmed benchmark claim, record and release RPCs + $5 approval table are NOT installed. The older unrelated $2 ledger exists but cannot be substituted. PR119 contains tested rollback-only SQL; requires independent approval for durable staging installation. Confirm correct authenticated provider project, model and request-attributed billing before any spend. Any persistent DB action, customer access change or site/native deploy requires separate verified owner scope. Existing PR120, old PR112 and main untouched.

**Actual measured provider cases: 0/6; provider spend by this patch: $0.**
