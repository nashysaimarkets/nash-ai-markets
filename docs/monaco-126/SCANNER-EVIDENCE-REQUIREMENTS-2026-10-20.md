# Exact remaining six-case evidence and approvals

Metadata verification is COMPLETE at `7baacfb1`. It is model-list access only. Do not rerun it, create a replacement credential or broaden that key. Genuine provider measurements remain **0/6**. The1,190 application checks and earlier CI do not establish scanner accuracy.

## Required chart evidence

| Canonical case | Existing recovered declaration | Evidence still required |
| --- | --- | --- |
| Range-clear30m | range-clear-01 | Original/source licence and second independent reference review |
| Double-top1h | double-top-01 | Original/source licence and second independent reference review |
| Head-and-shoulders4h | head-shoulders-01 | Original/source licence and second independent reference review |
| Bear-flag5m | Not supplied; sweep-reclaim is different | Licensed original5m bear-flag chart and independently agreed labels |
| Wedge15m | Not supplied | Licensed original15m wedge chart and independently agreed labels |
| Negative/no-signal | near-miss-chop and degraded-no-signal are candidates | Independent selection/semantic acceptance, or a new licensed canonical negative; unreadable input is not automatically a measured no-signal |

For each case supply immutable original PNG/JPEG bytes, exact scanner-input JSON, SHA256 of both, source vendor/feed/instrument identifier, timeframe, capture/render date and source interval, and provenance for the data and chart rendering. Keep the old six originals/pins unchanged. Add new sources in a separate packet. Never relabel sweep-reclaim as bear-flag or substitute a different timeframe.

The source/rights evidence must identify the rights holder, source dataset/chart, licence/permission document or written grant, effective dates, and permission for the intended development analysis and processing by the selected model provider. Record restrictions on retention and transfer. Redistribution/public marketing rights are separately needed only if those images/results will be published; private test permission is not publication permission. A broker login, ownership of a screenshot, or a free-text field saying licensed is insufficient. All six recovered inputs currently declare upstream rights unverified. No new legal grant is inferred here.

Reference evidence must bind original/input hashes to the canonical scenario, instrument/timeframe, original-image coordinates and independently calibrated prices, expected levels/patterns/liquidity, tolerances fixed before observation, and primary plus different independent annotator identities. The second reviewer must explicitly accept the negative's meaning. If a precision image is used, record its integer source crop rectangle in the hash-bound labels; the validator decodes and compares crop pixels against the original. Missing/mismatched crop mapping stays BLOCKED.

## Implemented offline acceptance

`scripts/pocket-monaco-measurement.ts` validates six distinct scenario/timeframe cases, content hashes, decoded raster dimensions, original bytes inside scanner input, independent annotation/rights record scope and expiry, negative labels, and precision crop pixels. It performs no provider calls. The strict crop check allows mean absolute RGB error at most3 and maximum40 for compression; these fixed thresholds cannot be supplied by a corpus. Independent review must still assess semantics and rights. `PACK_CONTRACT_PASS` is structural evidence only, never legal approval or dispatch permission.

The command entry point accepts a packet `{cases, artifacts:[{sha256,path}]}` plus separate independently reviewed records. Artifacts must be bounded files inside the packet directory; symlinks cannot escape it. Files stay private. Example (paths are operator-supplied):

`node scripts/verify-monaco-scanner-evidence.mjs --pack /private/pack.json --reviews /reviewed/records.json`

The scorer consumes retained normalized original-coordinate observations and scope-bound executor review receipts (case, original/input/label hashes, exact source/model, provider request ID, normalized response hash, reconciled cost and real-provider versus synthetic provenance). The exact provider response and normalization chain must remain in the private executor receipt evidence. It uses maximum-cardinality one-to-one matching: duplicate hypotheses count as FP; missing expected features count as FN; representable incorrect prices/geometry remain available for error scoring. Transport errors, cancellation, malformed outputs and admission HOLD are UNMEASURED. It reports TP/FP/FN, precision/recall (null when undefined), pixel/price errors, latency and the true negative separately. Six repeated case/request records cannot satisfy the aggregate gate. Synthetic fixtures remain zero genuine provider cases.

## Specific approvals before a real run

1. Independent acceptance of the above source rights, labels and canonical mapping, tied to exact artifact hashes.
2. A separately authorised inference-capable executor and its exact project/model/source binding. The completed restricted metadata key cannot perform inference and must not be expanded. Choose an existing appropriately authorised mechanism only under specific applicable approval; do not create credentials as an implicit next step.
3. Revalidate the existing aggregate$5six-case approval against the exact six requests, worst-case bounds, reservation/retry handling and independently attributable usage settlement. Keep the unresolved historic$2accounting separate. The present continuation authorises no paid call. A reservation is not actual cost evidence.
4. Independent security/admission review of the exact executor, source and finance controls. If any shared-live SQL/host changes are required, obtain their specific impact/rollback approval separately; the staging label does not make `pxlqvaddvghjjhenqmdh` disposable.
5. Execute one case at a time only after those gates pass. Retain raw response, normalization chain, request ID, model, latency, source/artifact hashes and billing attribution. Independently score all six; fix regressions and repeat only affected cases within the same total cap. The previously required90percent benchmark criterion must be agreed as explicit precision/recall/per-case tolerances before execution; do not select a favourable definition afterward.

**Next unavoidable external dependency:** an attributable rights-approved chart packet with independent labels covering the missing bear-flag5m, wedge15m and accepted negative, plus rights/review evidence for the existing three. Financial/executor, native/device, commerce cutover and final release approvals remain separate later gates. No licence, paid test, provider result, signed device result or release readiness is claimed by this document.
