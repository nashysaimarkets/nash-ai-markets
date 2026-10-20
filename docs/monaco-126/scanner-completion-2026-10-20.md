# Scanner completion delta — 20 October 2026

This is an isolated source-only successor of PR131 `2994b2859ef7bcc22b9ee38a5b966e1806e47994`. No provider request, credential, customer, shared database, deployment, price or store action occurred. Root remains the sole remote publisher. The enclosing commit/issue receipt supplies final source identity.

## Actual reproduced defects and repairs

- Both legacy RSI displays parsed the first number near `RSI`, including a period, negated reading or impossible value, and clamped it into0–100. `readVisibleRsi` now accepts one explicit unambiguous current reading; period-only, threshold, signed/out-of-range, malformed, uncertain, range and conflicting readings return null. The generation prompt requests explicit actual-value syntax. The parent integrator must wire both actual UI call sites to this helper; the helper alone does not change those displays and does not independently establish screenshot visibility.
- The user risk calculator silently removed malformed commas, accepted hexadecimal/exponential inputs and emitted zero/negative SHORT target prices. It now uses the existing exact positive-price parser, validates side and retains only finite positive target multiples. The risk desk now avoids avoidable intermediate cash overflow, rejects over/underflow unit risk and suppresses unsafe-integer/non-finite position sizes. Ordinary grouped decimal inputs and the existing £10,000/0.5%/12.5point/£2 case are preserved.
- A verified repeated-high/low pool previously carried `SWEEP`, `RECLAIM` or `REJECTION` directly from prose, even with no event observation. Pools remain available, but these event labels now require a matching medium/high same-side observation after two distinct earlier structural witnesses in that zone. `TESTING` has no independent event witness in the existing contract and is conservatively NONE. This validates supplied screenshot-observation consistency, not actual pixel/model accuracy.
- Pattern calibration previously accepted reversed/same-candle anchor paths and head-and-shoulders with only three arbitrary points. Paths now require strictly increasing candle columns. Double top/bottom require their intervening turn; H&S/inverse H&S require the three appropriate extrema and both intervening turns, with the head beyond both shoulders. No new symmetry/price/distance tolerance is guessed. Existing chronological valid fixtures remain accepted. The prompt requires at least five H&S anchors. These checks are necessary evidence conditions, not proof of the named pattern or its confirmed breakout.

## Red → green evidence

| New regression file | Original source | Repaired source |
| --- | --- | --- |
| `pocket-indicator-reading.test.ts` | 1PASS/6FAIL of7, actual legacy UI statements | 7/7PASS |
| `pocket-risk-numeric-boundaries.test.ts` | 1PASS/4FAIL of5 | 5/5PASS |
| `pocket-liquidity-event-evidence.test.ts` | 2PASS/4FAIL of6 | 6/6PASS |
| `pocket-pattern-turn-evidence.test.ts` | 0PASS/3FAIL of3 | 3/3PASS |

The RSI red adapter uses `POCKET_QA_RSI_LEGACY_SOURCE=<original PocketBullseye.tsx>` and executes the actual two extracted source statements. Fixed runs import the shared helper. Other red runs executed the unchanged baseline implementation with the same new tests before repair.

Stable affected integration: **99/99PASS,0FAIL,0SKIP**, exit0, 405.176982ms. Command:

```
node --test tests/pocket-indicator-reading.test.ts tests/pocket-risk-numeric-boundaries.test.ts tests/pocket-chart-toolkit.test.ts tests/pocket-launch-hardening.test.ts tests/pocket-liquidity-event-evidence.test.ts tests/pocket-liquidity-chain-integration.test.ts tests/pocket-liquidity-guard.test.ts tests/pocket-liquidity-evidence.test.ts tests/pocket-scanner-evidence-regressions.test.ts tests/pocket-pattern-turn-evidence.test.ts tests/pocket-pattern-calibration.test.ts tests/pocket-pattern-malformed-geometry.test.ts tests/pocket-original-geometry.test.ts
```

`npm run typecheck` exit0; focused ESLint on changed runtime/test files exit0; `git diff --check` exit0. These counts overlap programme evidence and are not additional genuine analyses. Parent integration must independently review the final source, wire both RSI displays and run impacted acceptance before publishing. No full unrelated test/build repetition was performed here.

## Remaining acceptance and rollback

Genuine provider benchmark remains **0/6**, with licensing, canonical independent annotations, authorised exact project/key/model executor and financial admission unresolved. The repairs do not create data rights, ground truth or provider/signed-device acceptance. Preserve existing exact-SHA baseline evidence where unaffected. Rollback is reverting this isolated undeployed code delta; live Sitesv179 and the original paid admission were not touched. Never restore permissive price/indicator/event claims to force a passing benchmark.

## Independent-review RSI follow-up

Independent reviewer reproduced two additional current-value ambiguities after the first freeze: `RSI:65 or35`/`RSI:65 or 35`, and explicit previous/yesterday readings, were still displayed as65. Two new regression groups reproduced **7PASS/2FAIL of9** against the first repair. The follow-up rejects alternative numeric lists and explicit historical qualifiers in the RSI clause, preserving `Current RSI(14):61.4`, `Latest RSI:65`, and unrelated historical text in a later clause. Focused helper acceptance is **9/9PASS,0SKIP**, exit0,121.229205ms; focused ESLint/diff checks pass. These9 overlap the prior99-case run; the parent integration must record its own combined current-source acceptance rather than add totals. No provider or genuine scanner result changed.
