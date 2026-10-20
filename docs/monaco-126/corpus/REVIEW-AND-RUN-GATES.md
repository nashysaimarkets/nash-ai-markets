# Six-case review and execution handoff

This packet contains genuine historical price observations and provisional references. It contains **zero genuine scanner measurements and zero accepted human references**. It is an intake packet, not a `PACK_CONTRACT_PASS` packet. Do not submit it to a provider.

## What is ready

`SIX-CASE-PROVENANCE.json` binds all six original images, scanner inputs, recovered/proposed labels, source periods and calibration. Three unchanged GetData chart rasters are retained. Their lossy JPEG precision crops exceeded the existing maximum RGB error of40 (60,62,70); separate PNG precision derivatives now have zero error. Legacy inputs remain byte-identical and hash-pinned. No old fixture pin or acceptance threshold was changed.

Three new SPY candidates use the pinned FirstRate Data sample: bear-flag5m (12Oct11:55–14:15 ET), rising-wedge15m (5Oct12:15–15:15 ET), and a readable choppy negative proposal5m (9Oct12:30–13:35 ET). The56 plotted bars are aggregated from complete observed minute windows; no interpolation, invented candles or generated market history. Selection used no scanner responses. These deliberately selected cases are not a representative accuracy estimate.

`RIGHTS-RESEARCH.md` identifies the source grants, restrictions, unresolved original-data rights and evidence hashes. The public repository contains code, hashes and summaries only. The private packet contains images, inputs, bar values and the source ZIP.

## Concrete reference review

Use `REFERENCE-REVIEW-TEMPLATE.json` and the private packet. No named human annotator is available in the session, and no outreach has been authorised. The separate automated reviewer checked code, source aggregation and pixels; its report is explicitly advisory. It does not fill either human approval field.

1. A qualified primary reviewer records the visible levels, patterns and liquidity features for each original image, without seeing any model output. Correct the provisional labels and independently confirm pixel-to-price calibration. Record reviewer identity, date, method, uncertainty and excluded/ambiguous features. All coordinates refer to the1400x850 original.
2. A different qualified reviewer independently annotates the same images before comparing references, records disagreements and signs the adjudicated result. Bind the final image/input/label hashes and precision rectangle. Freeze feature names/order, price and pixel tolerances before inference. Do not turn an unlabelled extra feature into an automatic false positive.
3. Explicitly decide whether the proposed flag is a flag or rectangle/retracement, and whether wedge convergence/containment is sufficient. The wedge has rising upper/lower contacts; no completed breakout is asserted.
4. The current negative scorer requires `features=[]` and explicit no-signal. The readable choppy candidate has no accepted directional pattern, but that does **not** establish absence of defensible support/resistance/liquidity. Accept it only if it satisfies the existing full rule; otherwise reject and select another legitimate chart. A target-specific negative requires an explicitly agreed, versioned protocol change and affected tests before use. Do not silently weaken the scorer or use a degraded image as a true negative.
5. Rights review separately records the applicable grant and exact intended AI processor/retention/use. Produce independently obtained `LICENCE` and `ANNOTATION` review records conforming to `EvidenceReview` in `scripts/pocket-monaco-measurement.ts`, with real identities, scope hashes and validity dates. Empty/pending template fields are not approvals.

## Prepared rights clarification — not sent

Recipient: the authorised GetData/data rights holder, selected and verified by the owner. Subject: permission for three existing internal scanner test charts.

Please confirm that you control, or have authority to sublicense, the historical SPX500 CFD observations distributed in getdata-finance/spx500-1m-ohlcv-index-historical-data at commit `c569c1275c2295a1566788476ef99500271a60fe`. We wish to retain and internally render the three existing30m/1h/4h test charts identified in the attached hash manifest, and submit those chart images to an AI API acting solely on our behalf for a commercial product's internal acceptance testing. No raw price-feed resale or public chart publication is proposed. Please identify the applicable licence/version and upstream FXCM/Capital.com permissions; explicitly confirm chart rendering, derivative retention and third-party AI processing, with permitted provider use, training restrictions, retention/territory limits and attribution. If this is outside the free grant, please identify a legitimate no-cost permission route. No purchase is authorised.

The owner may send that request or provide an existing applicable written grant. Do not create an account, purchase data or send outreach without the applicable authority. Permission must cover the actual data, not only repository software. FirstRate's published processor-on-behalf grant is already documented; avoid asking it to resell permission unless the chosen executor's use falls outside that grant.

## Exact remaining gates, in order

| Gate | Prepared evidence | Required completion before dispatch |
|---|---|---|
| Corpus | Six immutable image/input pairs, labels, calibration, source and crop receipts | Human rights/reference adjudication above; rejected candidates replaced without fictional labels |
| Contract | Existing PR135 validator/scorer unchanged | Export adjudicated labels to `CorpusCase`/`Feature`, attach actual licence/review artifacts and out-of-band records; run `verify-monaco-scanner-evidence.mjs`. Structural pass never authorises dispatch |
| Executor | `INFERENCE-ADMISSION-PREPARED.json` pins six input hashes/bytes and the previously accepted application source | Select an already-authorised inference mechanism; bind exact source/project/model/config. Metadata checkpoint7baacfb1 is complete; the restricted metadata key cannot be reused or expanded. No new key |
| Request |18 exact request-object previews extracted offline from SHA-pinned unchanged route initializers, including prompt/schema/image hashes and main7000/precision1400 caps; see `REQUEST-PREVIEWS.json` | Review proposed historical context with no macro events, no second chart and no corrections; bind the actual executor to those exact fingerprints or regenerate/review after any change. Preview is not dispatch admission. No free-text reviewed flag substitutes for records |
| Finance | Aggregate cap5,000,000 microUSD, six cases, up to18slots, one case at a time; separate historic$2 ledger | Independently evidenced full-context/model price bounds and complete per-call reservations, cumulative durable ledger and retry/idempotency admission. Sum of all reserved and unresolved amounts stays under the same$5 cap. No invented upper bound or reset |
| Settlement | Existing request-linked receipt/settlement controls retained | Authoritative request-attributed billing, model/tier/usage and raw-response receipts; missing/ambiguous charges remain unresolved, not zero. Do not release measured results before reconciliation |
| Security | Source contains `store:false`, default tier, low reasoning; no credentials in packet | Independent review of exact executor, processor retention/training terms, project scope, egress, log redaction, artifact access and admission controls. `store:false` alone does not establish zero retention or the provider's legal terms |
| Owner run authority | No paid-run authority in this continuation | Specific approval of the complete scoped run and aggregate budget after earlier gates; any hosted SQL/production change is a separate decision |

The old `run-pocket-real-image-benchmark.ts` intentionally accepts its old hard-coded fixtures. Do **not** weaken its pins to admit this packet. Once human references and executor scope are known, a separately reviewed adapter must use the accepted generic packet and preserve the same durable claim/reservation/receipt/release path. Its final input/output normalisation cannot be frozen before the reference feature protocol is adjudicated. It must retain all hypotheses and original-coordinate transformations, including wrong geometry/prices; HTTP errors, HOLD, cancellations and malformed outputs remain UNMEASURED.

## Offline commands

With the private packet available, only the new intake verifier is immediately runnable:

```sh
python3 scripts/verify-monaco-source-intake.py --packet /private/scanner-review-packet
python3 tests/run-monaco-source-intake-negatives.py --packet /private/scanner-review-packet
```

These have already passed at this checkpoint. Reuse the receipts when source/input hashes match. Do not repeat the completed1190 application checks, Checkout/native CI, metadata access or source downloads. After real review records exist, the separate contract command is:

```sh
node scripts/verify-monaco-scanner-evidence.mjs --pack /private/adjudicated/pack.json --reviews /independently-reviewed/records.json
```

No dispatch command is provided because the run is not admitted. Remaining owner actions are attributable source permission, access to qualified independent annotation, and later the exact inference/finance/security run decision. All prepared files remain safe to inspect offline.
