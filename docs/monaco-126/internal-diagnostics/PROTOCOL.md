# Internal development diagnostics v1

Protocol ID: `MONACO_INTERNAL_DIAGNOSTICS_V1`. Scope: the existing first-six development cases `d001` through `d006` only. The 21 October 2026 instruction authorizes these internal diagnostics without human references. No human annotator or independent-review placeholders are required or manufactured for this purpose.

This protocol is separate from expert acceptance. The six-case scorer, 50-case reporter, target-negative proposal, semantic proposal, existing thresholds, and unresolved expert acceptance are unchanged. These diagnostics create no canonical pattern labels, trusted provider receipts, paid-call permission, heldout claim, deployment authority, or human-reviewed accuracy result. The old scorer is not called with fabricated annotations or receipts. Every result retains `expertAcceptance: UNRESOLVED` and `dispatchAuthorised: false`.

## Evidence boundary

The independent source oracle has `schemaVersion: 1`, `kind: MONACO_INTERNAL_SOURCE_REFERENCE`, and exactly the six ordered case IDs. Each case binds the subset manifest, input, image, source archive/member, bars, and calibration hashes. The source calculation reproduces OHLCV and the known rendering projection from existing source material. It does not read scanner answers to construct references. No heldout file or new source download belongs in this workflow.

The wrapper accepts exact oracle and protocol bytes with their SHA-256 hashes, then binds the selected case to its exact input/image hashes. It checks the fixed protocol contents, declared original-image coordinates, price-scale arithmetic, source point projection, ordered bars, exact aggregation flag, and per-tool assessability. Source prices may be the oracle's exact decimal strings; these tokens remain in the retained source bytes and nearest-point results, with finite numeric copies used for geometric diagnostics. No decimal-repair or exponent notation is inferred. The independent oracle generator is responsible for verifying the underlying source files and aggregation. The wrapper cannot independently authenticate source files it has not received, or certify the truth of a caller's supplied hash. The caller must pin the oracle bytes in its retained run manifest.

The oracle's `perToolAssessability` keys are `pattern`, `level`, `liquidity_pool`, and `liquidity_event`; each contains `status: OBJECTIVE_ONLY | UNSCORED`, `reasonCode`, and `reason`. `OBJECTIVE_ONLY` permits the narrow geometric checks below. It is not a positive or negative semantic annotation. `UNSCORED` suppresses the target's rule-conformance denominator while retaining its assertions and numeric diagnostics. Case `d003` is always pattern `UNSCORED_WEAK_4H`, even if an oracle accidentally marks it objective-only. Other ambiguous or low-confidence pattern claims are also unscored.

Source candles are spaced by original rendering index, not inferred wall-clock intervals. Session gaps and zero-volume periods are preserved in the oracle; the wrapper does not interpolate missing candles. Tied source-minute high/low witnesses do not establish intraminute order. All six existing inputs use the original image; no crop-coordinate reinterpretation is allowed by this version.

## Raw response normalization

`normalizeInternalDiagnosticObservation(rawResponseBytes, {width, height})` consumes the existing scanner analysis object. It requires the relevant structured arrays and explicit readability fields, retaining the original JSON object and its hash. It converts coordinates by `xPixels = xPercent * width / 100` and `yPixels = yPercent * height / 100`.

| Scanner fields | Retained normalized material |
| --- | --- |
| `patterns[].geometry.points` | Every original ordered anchor and raw pattern object |
| `levels[].x/y/x2/y2`, `kind`, `price` | Both endpoints, raw kind and label, exact numeric price when available |
| `liquidity.zones[]` | Both horizontal endpoints, raw side/basis, point price or explicit price band |
| `liquidity.observations[]` | Every raw kind/side/confidence and its source-comparable point |
| `liquidity.event` | The original event assertion, including TESTING |
| `priceScaleAnchors[]` | Every reported axis price and original-image row |
| `currentPrice`, `instrument`, `timeframe` | Preserved identity/current-price claims for explicit comparison |

Diagnostic IDs such as `patterns[0]` identify raw array positions; they are not new reference labels. Unknown pattern names, duplicate hypotheses, wrong prices and incorrect geometry remain visible. The wrapper never calibrates the raw output, changes its kind/side, drops a failed claim, rounds a price to match the source, selects a better attempt, or filters ambiguous claims into empty predictions. Exact numeric strings reuse the scanner's existing strict `exactAxisPrice` parser; ambiguous locale notation is unscored rather than repaired. Malformed coordinates/arrays, contradictory `noSignal`, or `liquidity.state=NONE` with retained liquidity assertions make the response unmeasured.

## What the diagnostic numbers mean

The comparison allowance is 0.5 original pixel plus the source oracle's independently declared raster quantization bound. The combined allowance must be no more than 2 original pixels. With the existing metadata bound of 0.5 pixel, this gives a 1-pixel diagnostic tolerance. Price-row tolerance is that pixel allowance multiplied by the source price-per-pixel. This is a rendering-unit tolerance; no exchange tick size is assumed or derived from displayed decimal places. Actual raster residuals remain separately retained by the oracle and do not silently widen the allowance. The small numerical check used for consistency of source scale arithmetic is not an added model-scoring tolerance.

| Target | Objective and existing-rule checks | Always outside these checks |
| --- | --- | --- |
| Pattern | Distances to the nearest source high/low endpoints; all exact-distance ties retained. The unchanged `calibratePocketAnalysis` pattern gate is invoked on each retained claim to expose existing name/anchor/order/span/reversal-turn conformance. A conformance result requires both the existing gate and source wick alignment. | Canonical family truth, full topology, setup quality, confirmation/invalidation/extension truth, and trading direction interpretation |
| Support/resistance | Exact numeric price against the source price-at-row, horizontal geometry, ordered endpoints, and original plot bounds. Non-horizontal pivot/trend/zone/gap claims remain retained and unscored. | Support versus resistance role, reaction count, materiality, predictive usefulness, or completeness of the detected levels |
| Liquidity pool | Point/band projection, valid interval and side/basis combination, original plot geometry, unchanged production evidence-chain checks, and source alignment of the local witnesses. | Actual hidden orders, stops, future reactions, or semantic qualification of a liquidity pool |
| Liquidity event | The unchanged production chain/event helpers report whether the scanner's existing declared witness rule corroborates the name. | Event conformance remains UNSCORED: current scanner fields do not encode separate breach, return, and close witnesses sufficient to establish actual chronology. TESTING is also unscored. |

Nearest endpoint agreement does not establish that a point is an appropriate swing, that two prices form a named pattern, or that the whole pattern is complete. The wrapper reports `canonicalPatternTruth: UNSCORED` and `formationVersusConfirmation: UNSCORED_NO_MACHINE_WITNESS_IN_SCANNER_FIELDS` even when structural conformance is recorded. A plain confirmation string cannot supply a visible completion witness. Likewise, an existing event helper returning the requested event is reported separately and never becomes a semantically confirmed event.

Each assertion has `CONFORMANT`, `NONCONFORMANT`, or `UNSCORED` within the explicitly named narrow rule. Per-tool summaries count those statuses and preserve the total number of assertions. These are **rule-conformance counts, not TP/FP/FN**. Semantic TP/FP/FN and true negatives are `null`. There is no recall or semantic absence denominator because the oracle does not enumerate qualifying semantic targets. An empty valid response means no assertion; it is never a true negative or a missed semantic feature under this protocol.

Axis projection and supplied-current-price errors are reported separately. Exact instrument matching uses the original input string, while preserving the manifest string too; a source-attribution suffix is not silently stripped. A last-close comparison is a deterministic source check, not a claim that the source is a live quote.

## API and execution integration

`scoreInternalDiagnostics(input: InternalDiagnosticInput)` accepts:

```ts
{
  caseId,
  status: 'COMPLETED' | 'NOT_EXECUTED' | 'TRANSPORT_ERROR' | 'HOLD' | 'CANCELLED',
  inputSha256, imageSha256,
  rawResponseBytes, rawResponseSha256,
  oracleBytes, oracleSha256,
  protocolBytes, protocolSha256,
  latencyMs,
  evidenceKind: 'SYNTHETIC_FIXTURE' | 'RETAINED_SCANNER_OUTPUT'
}
```

The bytes are `Uint8Array`; hashes are lowercase SHA-256. `latencyMs` may be `null` for unexecuted/cancelled work; a completed observation requires an actual finite, nonnegative duration. Do not invent zero latency. The pure wrapper performs no file reads, network calls, provider dispatch, receipt writes, environment/credential access, or admission changes. It returns `DIAGNOSTIC_RECORDED` or `UNMEASURED`. NOT_EXECUTED, transport error, HOLD, cancellation, unreadable output, malformed data and provenance mismatch never become successful negative results or semantic false negatives. Their `metrics` value is `null`.

Use the retained raw scanner object for raw diagnostics. If a displayed/calibrated object is also inspected, retain both byte streams and identify each report's role externally; the displayed result must never replace the raw result or erase a failed assertion. Existing postprocessing can copy the supplied chart-confirmation instrument, timeframe and current price into the result. Their agreement in that displayed copy therefore does not measure the model's independent reading; raw-main identity/current-price diagnostics and the source of each copied field must remain distinguishable. The executor remains responsible for the actual request chain, candidate/scanner pins, provider identity, immutable receipts, attempt history, cost reconciliation, reservations, project caps and any future dispatch admission. A `RETAINED_SCANNER_OUTPUT` flag is not evidence of a real provider call: this wrapper always reports `actualProviderResults: 0` and `providerAuthenticity: NOT_ATTESTED_BY_DIAGNOSTIC_WRAPPER`. Any genuine provider count must come from the separately verified executor evidence.

This is explicitly a development workflow. Retain every attempt and diagnostic change; do not describe a rerun or tuned development case as unseen. To change tolerance, mapping, scope, source material or rule meaning, create a separately versioned protocol and preserve the previous artifacts. No declaration in this protocol activates expert acceptance or the legacy DRAFT semantic proposal.

## Regression evidence

The new internal-diagnostics tests are synthetic code regressions. Their bars and prices are invented test data, conspicuously labeled, and are not references for any real chart. The user also authorized exactly one fresh run of the existing 32 semantic tests on unchanged source. Its command, raw output, exit status, before/after source hashes and prior-history limitations are retained in `qa/internal-diagnostics/semantic-proposal-32-authorized-rerun.json` and `.log`. That rerun does not change the semantic proposal's DRAFT status. Other prior green evidence is reused, not repeatedly rerun.
