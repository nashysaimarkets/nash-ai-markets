# Scanner evidence corrections — issue #126

Base: `b02d5dd7a44c61fbdb6d99c60e365700d9f66d92`.
Prepared in an isolated staging directory. Release integrator owns publication,
final exact-SHA checks and preview. No main, provider, runtime, DB or customer writes.

## Observed defects and correction

1. **Liquidity side/basis disagreement:** A `BUY_SIDE` zone with `EQUAL_LOWS`
   could be reported `VERIFIED` when supplied with valid buy-side observations.
   The original-pixel overlay rejects this combination, but server calibration
   did not. Each side now permits only its compatible high/low structural bases.
   Both independently corroborated sides, prior swings and range edges remain
   supported. Incompatible-only input produces `NONE` with zero zones.
2. **Contradictory axis readings:** Duplicate elimination discarded conflicting
   labels sharing either a price or a row. The remaining subset could earn a
   verified numeric scale. Conflicting same-price/different-row and
   same-row/different-price readings now invalidate the scale. Identical
   repeated readings remain valid. Numeric level/liquidity values and Fibonacci
   output remain withheld when no consistent scale exists; visual evidence
   can remain available.

## Reproducible checks

The new regression file was executed against unchanged base calibration first:
**2 FAIL / 2 PASS**. Failing assertions observed `VERIFIED` for
`BUY_SIDE / EQUAL_LOWS` and `scaleReadable: true` for conflicting axis ticks.

After the patch, Node `v24.19.0`, built-in TypeScript stripping:

```sh
node --test tests/pocket-scanner-evidence-regressions.test.ts \
  tests/pocket-liquidity-chain-integration.test.ts \
  tests/pocket-liquidity-guard.test.ts \
  tests/pocket-pattern-calibration.test.ts \
  tests/pocket-pattern-malformed-geometry.test.ts
# 25 PASS, 0 FAIL, 0 SKIPPED
node --test tests/pocket-launch-hardening.test.ts \
  tests/pocket-chart-benchmark.test.ts
# 22 PASS, 0 FAIL, 0 SKIPPED
```

Existing unaffected files were linked temporarily into the isolated test
workspace; only modified calibration was exercised. Temporary links and
unchanged copies were removed after verification. **47 offline tests passed.**

Changed code:

- `app/api/pocket/analysis-calibration.ts`
- `tests/pocket-scanner-evidence-regressions.test.ts`

## Acceptance still external

- Genuine six-case provider measurements: **BLOCKED, 0/6**. No provider requests
  occurred. These deterministic regressions are not accuracy or latency proof.
- Licensed/provenanced historical raster corpus and independent annotations:
  require the existing corpus rights/annotation gates. Nothing was scraped or
  relabelled as permitted.
- Final static typecheck, independent review and matching-SHA browser preview:
  release integrator / QA. No release or deployment claimed.

Rollback: revert only the scanner patch commit. No schema, credential,
subscription or provider-state rollback is required.
