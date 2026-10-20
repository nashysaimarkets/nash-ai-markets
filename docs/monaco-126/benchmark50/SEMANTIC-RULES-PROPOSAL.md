# DRAFT semantic normalization and scoring proposal

This is an offline engineering proposal, not an approved benchmark amendment. It creates no human reference, provider result, executor approval, spend authority, or release acceptance. `scripts/pocket-monaco-semantic-proposal.ts` always returns `proposalStatus: DRAFT`, `acceptance: BLOCKED`, `passed: false`, and `dispatchAuthorised: false`. Even an exact external review record cannot activate this draft implementation. Activation would require an explicitly reviewed amendment and implementation change.

The existing six-case scorer and 50-case reporter are unchanged. The new wrapper calls `scoreMonacoObservation` once and attaches semantic diagnostics to that scorer's actual one-to-one pairs. It does not rerun matching, rewrite labels, filter hypotheses, adjust raw prices, replace the old TP/FP/FN, or change the old negative control. Its derived semantic TP/FP/FN are additional draft diagnostics, not accepted accuracy measurements.

## Evidence and normalization contract

The normalized response artifact retains the existing `features` and `noSignal` fields and adds `semantic`. The existing trusted executor receipt must bind the exact full artifact hash, including this additional object. The per-case label artifact similarly contains `features` and `semantic`; its bytes must match the case's existing `labelSha256`. Source-to-normalized response provenance remains an executor obligation. A displayed/calibrated response that removed assertions cannot replace the retained raw normalized response.

Each semantic envelope contains:

- `schemaVersion: 1`, `rulesSha256`, `caseId`, exact `instrument`, explicit `priceUnit`, `barCount`, and `readable`.
- All four tool keys: `pattern`, `level`, `liquidity_pool`, and `liquidity_event`.
- Reference tool states `POSITIVE`, `NEGATIVE`, `AMBIGUOUS`, or `UNMEASURABLE`, plus an explicit `complete` coverage boolean.
- Observed tool states `ASSERTIONS`, `NO_SIGNAL`, `ABSTAIN`, or `UNREADABLE`.
- One semantic fact per retained geometric feature, in identical order with the identical feature ID. Missing, extra, reordered, or cross-tool associations make semantic scoring unmeasured. Duplicate geometric assertions with distinct IDs remain duplicates; they are never deduplicated.

Each fact records `assertion` (`ASSERTED` or `AMBIGUOUS`), `side`, `witnessBars`, and `priceKind` (`POINT`, `BAND`, or `ANCHORS`), with the tool-specific fields below. Bar indices refer to the frozen original chart window, never an alternate crop or an inferred time scale. Facts preserve their original tokens. Canonical side/status/event values are additional fields produced only through the exact alias maps in the frozen rule artifact. There is no silent case folding, synonym guessing, missing-value default, or conversion of ambiguity into an empty prediction.

The exported draft template deliberately supplies no instrument tick values, price tolerances, or executable pattern-specific entries. The concrete proposed rubric and tolerance selection below are review material, not approved defaults. Each eventual pattern label needs a fixed minimum anchor count, directional class, and confirmation-kind definition. The existing named gallery, aliases, structural class definitions, and required 3/5-anchor distinctions remain review obligations under `NEGATIVE-PROTOCOL-PROPOSAL.md`; an empty rule table does not approve them. The code checks the declared evidence contract and agreement with reference annotations. It does not infer chart truth or judge full pattern topology from an image.

## Formation and confirmation

Every pattern fact supplies `status`, `formationComplete`, explicit nullable `confirmation`, `invalidationBar`, and `extensionBar`. A confirmation witness includes its kind (`NECKLINE_BREAK`, `BOUNDARY_BREAK`, or `OTHER_COMPLETION`), bar index, and `closeBeyond` evidence. The proposed positive confirmation endpoint requires a visible close beyond the declared boundary. A rule change to permit a wick-only endpoint requires a new reviewed version; it must not be inferred from explanatory prose.

| Status | Required distinction and evidence |
| --- | --- |
| `FORMING` | Formation may still be incomplete, or geometry may be complete while confirmation is absent. There is no confirmation, invalidation, or extension witness. Complete geometry alone never means confirmed. |
| `CONFIRMED` | Complete formation, sufficient ordered original-image anchors, and a later qualifying confirmation witness. There is no later invalidation or extension claim. |
| `FAILED` | A visible invalidation occurs after the formation witnesses and, when confirmation was claimed, after that confirmation. An unconfirmed formation can fail; confirmation is not invented. |
| `EXTENDED` | Complete formation, qualifying confirmation, and a separately visible later extension witness. An already invalidated pattern is not scored as extended. |
| `AMBIGUOUS` | A named, retained ambiguous assertion. It receives no semantic positive credit or negative success. It remains in unsupported-assertion and abstention reporting. |

Status, formation completeness, direction, witness bars, and confirmation/invalidation/extension bars are compared with the reference independently of geometric matching. A correct name and geometry with an unsupported confirmation claim is a semantic error. A matched semantic error contributes a draft FP and FN; it does not erase the original geometric match. Unknown or incomplete reference semantics instead have no asserted semantic denominator.

### Proposed canonical gallery rubric for independent annotation

The following is a concrete proposal for reviewer agreement. Anchors are distinct visible swing extrema in time order, with prices calibrated from the original image. An intermediate interpolated point is not a swing. “Same level” means within the independently frozen instrument tolerance below; a required inequality or slope must exceed calibration uncertainty. Each boundary needs at least two distinct visible witnesses. Unclear pivots, incomplete windows, conflicting boundaries, or unresolved candidate families receive `AMBIGUOUS` or `UNMEASURABLE`, not a forced name. All confirmation witnesses occur after the formation anchors; all close/break conditions refer to the original visible candle, never an expected future move.

| Gallery name | Proposed minimum anchors and complete formation | Proposed confirmation endpoint | Direction |
| --- | --- | --- | --- |
| HEAD & SHOULDERS | 5: peak, trough, higher central peak, trough, shoulder peak; both shoulders below the head and within the frozen same-level tolerance | Later close below the neckline through the two troughs (`NECKLINE_BREAK`) | BEARISH |
| INVERSE H&S | 5: trough, peak, lower central trough, peak, shoulder trough; both shoulders above the head and within the same-level tolerance | Later close above the neckline through the two peaks (`NECKLINE_BREAK`) | BULLISH |
| DOUBLE TOP | 3: peak, intervening trough, second peak within the same-level tolerance | Later close below the intervening trough (`NECKLINE_BREAK`) | BEARISH |
| DOUBLE BOTTOM | 3: trough, intervening peak, second trough within the same-level tolerance | Later close above the intervening peak (`NECKLINE_BREAK`) | BULLISH |
| RISING WEDGE | 4 alternating boundary touches; both boundaries rise and their separation contracts across the formation | Later close below the lower boundary (`BOUNDARY_BREAK`) | BEARISH |
| FALLING WEDGE | 4 alternating boundary touches; both boundaries fall and their separation contracts | Later close above the upper boundary (`BOUNDARY_BREAK`) | BULLISH |
| BULL FLAG | 5: visible upward mast origin/end, then three alternating turns; the mast end plus those turns define two approximately parallel sideways/downward consolidation boundaries | Later close above the upper flag boundary (`BOUNDARY_BREAK`) | BULLISH |
| BEAR FLAG | 5: visible downward mast origin/end, then three alternating turns defining two approximately parallel sideways/upward consolidation boundaries | Later close below the lower flag boundary (`BOUNDARY_BREAK`) | BEARISH |
| TRIANGLE | 4 alternating touches; descending upper and ascending lower boundaries converge | Later close outside either boundary (`BOUNDARY_BREAK`), with the breakout direction independently annotated | NEUTRAL formation |
| ASCENDING TRIANGLE | 4 alternating touches; upper witnesses are at the same level and lower witnesses rise | Later close above the upper boundary (`BOUNDARY_BREAK`) | BULLISH |
| DESCENDING TRIANGLE | 4 alternating touches; lower witnesses are at the same level and upper witnesses fall | Later close below the lower boundary (`BOUNDARY_BREAK`) | BEARISH |
| PENNANT | 5: visible mast origin/end and three alternating turns; mast end plus later turns define converging consolidation boundaries | Later close through the boundary in the independently annotated mast direction (`BOUNDARY_BREAK`) | Frozen bullish/bearish variant |
| CUP & HANDLE | 5: left rim, rounded-basin low, right rim at the same level, shallower handle low, handle recovery; intervening visible candles must support a rounded basin rather than only a V | Later close above the rim/handle boundary (`BOUNDARY_BREAK`) | BULLISH |
| RECTANGLE / RANGE | 4 alternating touches of approximately horizontal upper/lower boundaries, with no confirmed exit needed for complete formation | Later close outside a boundary (`BOUNDARY_BREAK`); a complete unbroken range remains FORMING under the formation/confirmation split | NEUTRAL formation |
| TREND CHANNEL | 4 alternating touches of approximately parallel rising or falling boundaries | Later close outside the channel (`BOUNDARY_BREAK`); ordinary travel inside a complete channel is not confirmation | NEUTRAL formation |
| BREAKOUT & RETEST | At least 3 ordered anchors identifying the prior boundary, visible breakout, and later return to that same boundary; the underlying boundary still needs independently annotated witnesses | A still later close away from the retested boundary on the breakout side (`OTHER_COMPLETION`) | Frozen bullish/bearish variant |

The 4/5-anchor proposals above can be stricter than the current general three-anchor floor; they do not alter that floor or the existing five-anchor head-and-shoulders rule. “Approximately parallel,” the minimum mast displacement, cup curvature, and extension maturity need explicit quantitative definitions in the reviewed family rubric. Until those definitions are independently agreed, the affected family is not exhaustively annotated and cannot yield a complete negative. A failed pattern uses its separately frozen invalidation boundary; an extended pattern needs a separately frozen maturity criterion and later witness. These values cannot be backfilled from scanner output.

The current `patternRules` schema stores one fixed direction per safe identifier label. Directional variants of PENNANT and BREAKOUT & RETEST therefore need explicitly reviewed separate labels and mappings before use. For generic TRIANGLE, RECTANGLE / RANGE, and TREND CHANNEL, `NEUTRAL` describes the formation; the human reference must additionally record the observed breakout direction. The present module does not verify that extra direction or full family topology, so its successful contract checks alone cannot establish full canonical correctness. That remaining schema/validator work is an explicit acceptance blocker, not permission to collapse direction or invent a confirmation.

## Side, pools, and events

Support/resistance uses explicit `SUPPORT` or `RESISTANCE`; matching the price alone is insufficient. Pattern direction uses the frozen `BULLISH`, `BEARISH`, or `NEUTRAL` class. Pool/event side uses `BUY_SIDE` or `SELL_SIDE`. The template explicitly maps the route's `buy-side`/`sell-side` spellings; any further alias needs a frozen declaration.

For the proposed support/resistance reference rubric, require at least two distinct visible reactions at the declared point/band, each separated by a visible departure greater than the frozen price tolerance. At the frozen evaluation bar, a support reaction holds from above and a resistance reaction holds from below. A role reversal requires a later visible close through the old level followed by a separately visible reaction from the opposite side. If that order or the current role is unresolved, annotate ambiguity. A lone pivot can remain a separately named pivot but cannot silently become a twice-tested support/resistance positive. This reaction/materiality rubric is proposed annotation work; the current module verifies the declared side and agreement, not candle-level reaction truth.

Buy-side pool bases are `EQUAL_HIGHS`, `PRIOR_SWING_HIGH`, or `RANGE_HIGH`. Sell-side bases are `EQUAL_LOWS`, `PRIOR_SWING_LOW`, or `RANGE_LOW`. Every pool needs at least the rule's number of distinct ordered visible witnesses, with a minimum of two. This proposal does not alter the production liquidity-chain geometry thresholds. A human reviewer must still verify the actual witnesses and permitted basis.

Every event links to a retained, asserted, same-side pool feature. A pool alone does not establish an event. Each event step records a kind, original-window bar, price in the declared instrument unit, and whether the evidence is a close.

| Event | Required ordered steps and evidence |
| --- | --- |
| `SWEEP` | Pool witnesses, then `BREACH` beyond the correct side of its price boundary, then `RETURN` through that boundary. |
| `RECLAIM` | Pool witnesses, then `BREACH`, then `RETURN` with an explicit close back through the boundary. Its named class must also match the independent reference. |
| `REJECTION` | Pool witnesses, then `TEST` at the boundary, then a `REACTION` away from it. It does not silently inherit a sweep or breach claim. |
| `TESTING` | Retained as a claim, but not a completed SWEEP/RECLAIM/REJECTION positive under this proposal. |

These sequences require strictly later bar indices. The implementation does not infer intrabar event order from a single candle. Same-bar order without separately reviewed evidence is unsupported; reviewers should mark unresolved cases ambiguous or unmeasurable rather than assert an ordered event. Event kind, pool correspondence, side, step order, bar differences, prices, and close evidence are reported separately. This is screenshot-derived price structure, not evidence of hidden orders, actual stop placement, institutional activity, or future returns.

## Instrument and price tolerance

Each frozen instrument entry supplies exact `instrument` and `priceUnit` strings, a positive `tickSize`, nonnegative integer `maxPriceErrorTicks`, an original-raster `pixelTolerance`, and nonnegative integer `maxBarError`. No entry means semantic measurement is blocked. No price-unit conversion, percentage tolerance, automatic tick lookup, rounding, or post-observation widening is performed.

The proposed absolute price tolerance is `tickSize * maxPriceErrorTicks`. It must be finite and no larger than the existing scorer's supplied price tolerance; the proposed pixel tolerance must likewise be no larger than the existing scorer's tolerance. Those original thresholds remain unchanged. Prices are compared numerically without rounding or a hidden epsilon. Boundary cases affected by numeric representation remain conservative failures and require an explicitly reviewed representation change, not automatic widening.

Proposed pre-observation tolerance selection is as follows. This calculation is for independent reference review; it is not automatic runtime calibration and is not a change to existing thresholds.

1. Verify the instrument, venue/contract, quoted unit, and applicable minimum price increment `t` from an attributable instrument specification. Decimal places on the chart are not evidence of tick size. If a displayed continuous index, adjusted series, or synthetic instrument has no verified trading tick, reviewers must explicitly define an annotation price quantum and its unit in a new reviewed rule; the current `tickSize` field must not be populated by guessing.
2. Propose an original-raster localization allowance `P = min(2 pixels, legacyPixelTolerance)`, with an allowed reviewed range from 0 through that cap. Use two independent annotations to estimate reference localization uncertainty. If disagreement exceeds `P`, adjudicate without scanner output or mark the feature unmeasurable. The two-pixel ceiling is a conservative proposal for locating a visible wick/boundary, not a measured accuracy claim. No resizing factor is applied after scoring.
3. Calibrate a price mapping `p(y)` from independently read original-image scale points; establish linear or logarithmic scale explicitly. Let `r` be the maximum absolute price residual of independently checked scale points, and let `u = max_y max(|p(y + P) - p(y)|, |p(y - P) - p(y)|) + r` over the annotated price region. This maps the bounded pixel/scale uncertainty into the declared price unit. Missing scale points, unclear units, or unsupported scale type make the target unmeasurable.
4. Propose integer `N = ceil(max(t, u) / t)` and absolute tolerance `T = N * t`. Thus the proposed reviewed range is `1 <= N <= floor(legacyPriceTolerance / t)`, and `T` may never exceed the legacy tolerance. If the range is empty, `u` exceeds the cap, or numerical arithmetic leaves `T` above the cap, mark unmeasurable; do not round down uncertainty or silently clamp the result. For an explicitly exact discrete-price endpoint, reviewers may instead freeze `N = 0` before observation. Record `t`, `P`, `r`, `u`, `N`, the scale evidence, and the chosen endpoint together.
5. Propose `maxBarError = 0` for clearly indexed witnesses, or at most 1 original bar only when the independent annotations establish that localization uncertainty before inference. A one-bar matching allowance never relaxes required chronology: pool, breach, return, confirmation, invalidation, and extension witnesses still retain their strictly ordered distinct bars. A larger allowance requires a separate reviewed proposal.

For example, using synthetic values only, `t = 0.25`, `u = 0.40`, and a legacy price cap of `1.00` proposes `N = 2` and `T = 0.50`; a cap of `0.30` makes that endpoint unmeasurable. This example is not an instrument specification or a populated production rule. The runtime verifies supplied finite values and the unchanged legacy caps; it does not independently certify the specification, calibration residual, or the proposed selection calculation. Those inputs and decisions belong in the frozen human review record.

Ordered price bands compare their endpoints, not just overlap or center. `POINT` requires one price; `BAND` requires two ordered low/high endpoints; `ANCHORS` preserves the original ordered price vector. Matched price error is retained both in original units and in ticks. Event-step price errors are additionally checked against the same instrument tolerance. Unmatched assertions remain visible in FP/FN and unsupported-assertion counts.

## Per-tool negative and abstention protocol

`NEGATIVE` requires a readable chart, complete independent coverage for that target, and no reference features for that target. No-pattern is not no-support/resistance. No completed liquidity event is not no-pool. Pattern coverage must cover the entire frozen gallery, including ranges/channels, unless a narrower named endpoint is explicitly declared in a different reviewed protocol.

| Reference and output | Draft result |
| --- | --- |
| Complete readable negative + explicit target `NO_SIGNAL`, with no target assertions | Strict target-negative success. Other tools may legitimately contain features. |
| Complete readable negative + `ABSTAIN` | Recorded abstention; no true-negative success. |
| Complete readable negative + any named assertion, including ambiguous | No negative success; retained unsupported assertion/FP-negative and, when applicable, abstention. |
| Complete readable positive + completed empty `NO_SIGNAL`/`ABSTAIN` | FN for unmatched reference features, plus abstention. |
| `AMBIGUOUS`, incomplete coverage, `UNMEASURABLE`, or unreadable reference/output | No asserted TP/FP/FN or negative denominator for that target. |
| Transport error, HOLD, cancellation, malformed normalized data, receipt/hash mismatch | Whole-case semantic `UNMEASURED`, with a reason. |

A target cannot say `NO_SIGNAL` while retaining assertions for that target. `ABSTAIN` may retain named ambiguous hypotheses but cannot conceal asserted positives. If every target is explicitly no-signal and the complete feature set is empty, global `noSignal=true` remains required. The legacy `negative=true` field is never manufactured from one target's absence.

## Freeze, review, and integration

The semantic context binds dataset, references, scanner source, existing protocol, semantic rule bytes, normalizer source bytes, candidate commit, model, freeze time, and observation start time. Rule and normalizer bytes are hash checked, the label artifact is checked against the existing per-case label hash, and rules must be frozen before the observation. The external semantic review must match the exact frozen identities, precede execution, and be unexpired. Self-declared review flags, altered rules, ambiguous review records, and later freezes do not satisfy this gate.

The current module intentionally remains DRAFT even when a synthetic regression exercises a matching review record. Existing independent rights/reference review, complete execution history, the 50-case reporter's heldout controls, admission, budget, and genuine receipt requirements remain necessary upstream gates. This layer does not replace them and does not claim it can detect omitted prior exposure.

Public entry points:

- `normalizeMonacoSemanticEnvelope(value, features, mode, rules, labelToTool)` preserves every geometric hypothesis and produces exact-alias canonical semantic fields or an explicit unmeasured reason.
- `scoreMonacoSemanticProposal(reference, observation, existingScorerAcceptance, semanticContext)` invokes the existing scorer once, validates hash-bound semantic artifacts, and returns separate geometric and per-tool semantic diagnostics. It does not change the existing reporter.

The execution adapter should retain semantic facts at normalization time from attributable raw fields and reviewed reference artifacts. It must not fill missing confirmation, side, event chronology, readability, or unit facts with guesses. Because this proposal uses the existing scorer's selected pairs, coincident geometric hypotheses with multiple possible semantic pairings are not rematched; diagnostics may conservatively understate semantic matches. Any integrated matcher that uses semantic compatibility to select pairs needs its own explicit amendment, review, and regression evidence.

The new tests are synthetic code regressions only. No live execution or actual provider measurement is represented by their results.
