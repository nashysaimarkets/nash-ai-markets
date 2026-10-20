# Offline execution preparation and reporting contract

No dispatcher or live adapter has been activated. Reuse the pinned scanner route, old evidence scorer and durable spend harness. This successor changes only preparation, validation and reporting. The old source/intake validators, old request previews and old scorer remain byte-identical to8567631.

## Exact envelopes

`prepare-monaco-benchmark50-requests.mjs` extracts only known pure initialisers from route SHA256 `5a59b0cde257ad8ab885af9c9171198fe9732ad3a286efda301c6226903b7294`. It cannot import the live route or provider client. It requires an exact manifest-bound offline validation receipt, pinned input/image bytes, neutral intention and context. Private JSON files retain complete requests; the public inventory retains their SHA256, spend fingerprint, dimensions, text/schema limits, model and output caps.

ScopeA: six named development charts; main/primary_precision/rescue_precision slots per chart; at most18sends and$1.9176 direct-token exposure. ScopeB:44named held-out charts; at most132sends and$14.0624. Total150possible sends, not50assumed calls. Conditional unused slots do not mean free retries. SDK retries remain0; no extra rerun, failover or replacement model is permitted. `macroEvents=[]`, absent context/corrections, standard tier, `store=false`, low reasoning and the exact snapshot are proposed offline settings requiring executor review. The immutable request inventory and cost/security document are jointly required; neither grants dispatch.

## Reporting interface

`scripts/pocket-monaco-benchmark50-report.ts` exports `checkMonaco50Manifest`, `buildMonaco50BenchmarkReport`, and `summarizeMonaco50Progress`. The first checks metadata only. The Python validator establishes source, source-window, licence, image/input and calibration integrity; do not infer those from the metadata preflight.

The report builder takes exact dataset/reference/scanner/protocol bytes; a complete case reference table with explicit `readable` and per-tool coverage; reviewed protocol definitions and numerical thresholds; a pre-exposure freeze; out-of-band licence/annotation approvals; and independently retained executor receipts/raw observations. Missing/partial/unknown coverage is not a negative. Prepared proposal files cannot be supplied as trusted human reviews.

Tool keys are `pattern`, `level`, `liquidity_pool`, `liquidity_event`. An approved explicit label→tool map must use the existing scorer's safe identifier syntax; do not alter receipt-bound labels to make them pass. Include formation state, side and event order in the approved normalization/label rubric or explicit additional fields before accepting those endpoints. The current generic geometry reporter does not by itself establish status/side/event-order correctness. Price-band normalization and per-instrument tolerance policy also remain pending protocol approval. No generic source patch may silently change the old acceptance rules.

The existing maximum-cardinality matcher runs once per case. Its matched/unmatched evidence is projected into each tool, preserving raw hypotheses, TP/FP/FN, price/pixel errors and latency. Empty reviewed targets can establish correct abstentions; an empty unreviewed annotation cannot. Completed readable abstention on a positive target is a miss. Transport errors, cancellation, HOLD, unreadable/malformed output, missing independent receipts and missing approved references remain UNMEASURED with separate counts. Raw observations are retained; no synthetic fixture contributes to provider results or acceptance.

`PREPARATION-REPORT.json` reports planned per-case/tool states as unmeasured and all observation metrics null. `RAW-OBSERVATIONS.json` is an empty array. The tests use explicitly synthetic engineering fixtures only; their passes are not scanner measurements.

## Required freeze and adapter admission

Bind dataset/images/inputs, independently adjudicated references, scanner source, normalizer/scorer, model, protocol/thresholds and both request inventories before held-out inference. Current reference/protocol freezes are null and inference is disabled. The candidate route is pinned, but no complete acceptance freeze exists. Dataset selection and reviewer inspection before that freeze are disclosed; no scanner outputs have been used. Subsequent exposed-case replacement or tuning invalidates the affected unseen-evaluation claim.

The future execution adapter must reject missing durable benchmark scope on every provider path, reserve main+precision+rescue before a chart, enforce the correct aggregate ledger and a single-chart concurrency bound, and reconcile request IDs/usage/charges. Transport uncertainty stays reserved. Ordinary route helpers are not a substitute for this admission. Do not call customer/live routes or widen authentication/entitlements to collect evidence. Independently approve the actual existing credential/project, on-behalf processor settings/retention, exact outbound requests, redacted logs and financial reconciliation. No credential or metadata request is needed for current offline work.

## Offline successor implementation (PR137 continuation)

The missing mock execution boundary is now implemented in `scripts/pocket-monaco-offline-executor.ts`; see `OFFLINE-EXECUTOR.md`. It is deliberately unmounted and structurally unable to accept a real transport/client. Existing request previews and scanner/SQL source remain unchanged. The journal and synthetic approval records exercise durable lifecycle controls without human-reference fabrication or provider measurements. `SEMANTIC-RULES-PROPOSAL.md` supplies the separate proposed normalization/rubric; it does not amend this document's approved legacy rules. `APPROVAL-RECORD.json` consolidates the remaining human decisions and exact scope bindings.
