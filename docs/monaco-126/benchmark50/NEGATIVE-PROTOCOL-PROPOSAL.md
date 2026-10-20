# Proposed target-specific negative protocol

20 October 2026. **Automated engineering advisory; amendment pending.** This proposal creates no accepted references, genuine scanner measurements, human review or dispatch authority. It is intended for the new 50-chart preparation.

The existing six-case contract remains unchanged: `negative-no-signal` requires an empty complete feature set and explicit `noSignal=true`. Its scorer, `scripts/pocket-monaco-measurement.ts`, has SHA-256 `c66d1c2329d55aa9f062d1b19f57535e54c62df89343183a15b4fc0536d39df3`. A chart without a directional pattern does not necessarily satisfy that contract. The previous choppy candidate remains unaccepted. Do not filter levels or liquidity out of a legacy observation to manufacture a pass.

## Proposed reference states

Record `POSITIVE`, `NEGATIVE`, `AMBIGUOUS` or `UNMEASURABLE` separately for each tool. `NEGATIVE` means that a readable image was exhaustively reviewed for the frozen target definition and no qualifying feature was found. `AMBIGUOUS` means reviewers cannot resolve a visible candidate. `UNMEASURABLE` means the image lacks required evidence, such as a readable price scale. Neither is a true negative.

| Target | Positive evidence | Meaning of a negative | Other features may remain |
| --- | --- | --- | --- |
| Pattern Watch | A named structure, ordered visible swing anchors, status and confirmation/invalidation evidence under the frozen pattern rubric | No qualifying named pattern in the entire declared gallery; not merely absence of the intended selection label | Support, resistance, pivots, trend and price-derived liquidity |
| Support/resistance | A material visible reaction level or interval with reference witnesses, side and price calibration | No qualifying support/resistance under the declared materiality and witness rules | Patterns, pivots or other targets, each independently annotated |
| Liquidity pools | Visible repeated highs/lows or the permitted swing/range reference, with the existing required distinct witnesses and original-image geometry | No qualifying screenshot-derived pool | Support/resistance or patterns |
| Liquidity events | A qualifying pool plus later visible event evidence and correct side/order for SWEEP, RECLAIM or REJECTION | No qualifying event; an untriggered pool can still be positive in the pool target | Pools and other tools |

These are screenshot-derived price-structure tests. They cannot establish actual hidden orders, stops, order-book depth, institutional activity or future profitability. Preserve that distinction in labels and reports.

The current route lists 16 gallery names: HEAD & SHOULDERS, INVERSE H&S, RISING WEDGE, FALLING WEDGE, BULL FLAG, BEAR FLAG, DOUBLE TOP, DOUBLE BOTTOM, TRIANGLE, ASCENDING TRIANGLE, DESCENDING TRIANGLE, PENNANT, CUP & HANDLE, RECTANGLE / RANGE, TREND CHANNEL, BREAKOUT & RETEST. Freeze their exact aliases and class definitions before inference. A range/channel therefore prevents declaring a general pattern negative even when no flag or wedge is present. A family-specific negative, such as `BEAR_FLAG_ABSENT`, must be reported as that narrower endpoint.

Proposed strict Pattern Watch negative success requires a valid completed response with no named pattern assertion. `AMBIGUOUS` named hypotheses remain visible in an abstention/unsupported-claim count; they do not quietly become successful negatives. Freeze which statuses qualify for positive matching; proposed named-status classes are FORMING, CONFIRMED, FAILED and EXTENDED, with status correctness scored separately. A correct name with an unsupported confirmation claim is an error.

## Reference and scoring contract to approve

1. Two qualified people annotate independently before seeing scanner output. Record identity, image/input hashes, target coverage, witnesses, full-original coordinates, prices/intervals, uncertainty and disagreements. Adjudicate disagreements without seeing output. Automated selection/review can suggest candidates; it cannot fill either human approval field.
2. Freeze a versioned manifest with target definitions, alias map, complete included/excluded features, anchor ordering, tolerances, interval matching and numerical pass thresholds. Price tolerance must specify the instrument's tick/units; pixel tolerance must specify the original raster. These values remain pending until justified and agreed. Do not widen them after observing errors. Existing six-case thresholds stay unchanged.
3. Freeze deterministic raw-response normalization. Preserve every hypothesis and duplicate, including wrong names, geometry and prices, plus both raw and displayed/post-calibration results. Attribute differences to calibration rather than discarding raw errors. A record cannot assert target `noSignal` and simultaneously contain a positive assertion for that target. Other tools' legitimate features do not contradict a target-specific negative.
4. Match references and predictions once per target by maximum-cardinality one-to-one matching under frozen label/geometry/price rules. Duplicates and unmatched assertions count as false positives; unmatched positive references count as false negatives. Report status, side, event order and price-band errors separately. Do not score an unreviewed target as though its empty annotation were a negative.
5. Version any new adapter/scorer separately, with affected offline regression tests and explicit amendment approval before acceptance use. A proposed `patternNegative` must never be mapped into legacy `negative=true` unless the complete legacy rule is independently satisfied. This document does not amend runtime or the six-case scorer.

## Required results, including missing evidence

For each tool and declared class, report reference-positive/negative/ambiguous/unmeasurable counts; attempted/completed/unmeasured counts; TP/FP/FN; precision `TP/(TP+FP)` and recall `TP/(TP+FN)`; and false-positive charts per completed readable reviewed negative chart. Undefined denominators are `null`, never 100%. Publish feature-weighted totals alongside per-chart and per-class results so charts with many levels cannot hide weak pattern performance. Report pixel/price error distributions only on defined matches, with the unmatched denominator alongside them.

Separate successful negative (`TN`), incorrect positive assertion (`FP-negative`) and model abstention on a negative. If reporting specificity `TN/(TN+FP-negative)`, label it conditional on a non-abstained completed result and show that denominator. Also report strict negative success `TN/all planned reference-negative charts`, plus abstention and unmeasured rates, so refusal or failure cannot improve apparent acceptance. On a reference-positive chart, a valid completed abstention leaves the reference unmatched and counts as FN as well as an abstention. Review-ambiguous and review-unmeasurable targets have no asserted ground-truth denominator.

HTTP errors, rate limits, timeouts, cancellation, HOLD, malformed/incomplete output, provenance/receipt mismatch and absent independent reference are **UNMEASURED with a reason**, never true negatives or detection false negatives. Keep them in the planned denominator and report completion coverage. A valid completed empty prediction against a positive reference is a false negative. An ambiguous named hypothesis is an abstention, not a transport error and not silent success. Score bounds and sample counts must accompany any aggregate; deliberately selected or correlated 50-chart cases are a challenge set, not a population accuracy or trading-return estimate.

## Held-out freeze

Define development and held-out IDs before model tuning or any paid run; the six-chart operational pilot and remaining 44 charts are budget groups, not automatically scientific splits. Previously inspected/tuned cases, including the original six, belong in development unless their exposure is explicitly disclosed. Candidate screening without scanner output can remain provisional, but it does not make exposed images or labels blind.

Group overlapping source bars, time windows, precision crops and re-renderings into one split. Also group contemporaneous correlated index/ETF/futures windows where they would expose the same underlying move. Record the grouping and any lookback buffer; do not count alternate renders as independent examples. A custodian seals held-out labels away from prompt/scanner developers, with hashes and freeze time. The provider receives only the approved neutral chart request, never scenario names, label hints or reference files.

Freeze source selections, image/input/label hashes, split/group membership, candidate/scorer/prompt hashes, model snapshot, options, thresholds and exclusions together. Evaluate held-out cases once after the freeze. Preserve all results and failures. Any label/rubric/source/tolerance change after exposure creates a new version and invalidates the affected held-out claim; disclose the change and obtain genuinely unseen replacements for a new acceptance claim. Do not select the best of repeated runs or substitute easier negatives after seeing predictions.
