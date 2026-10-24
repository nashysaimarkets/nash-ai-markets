# Precision output budget v2 — offline scanner proposal

**Status: prepared and tested offline; not deployed and not admitted to any paid run.**

The patch is based on executable `9e82c6d25dcb7f589e2328b2efc7910033d8fcdc` and lives in an isolated worktree. The current frozen six-case plan, its 1,400-token requests, and the d002–d006 continuation remain unchanged.

## Proven fault and the narrow correction

The retained d001 primary precision response from run `40083992183` reports `status: incomplete` and `incomplete_details.reason: max_output_tokens`. It used all 1,400 output tokens, including 832 reasoning tokens, and its 1,363-character text is invalid, unfinished JSON. Its retained file SHA-256 is `f396f9c82dc772d74c836973ca1a72549c1c6e7687f5feeb87f41c77591ad9b0`. The provider completed the main response separately. These observations establish the output-limit failure in that precision attempt; they do not establish the scanner's accuracy or prove that a larger cap will always finish.

The production change in `app/api/pocket/analyse/route.ts` is limited to:

1. Raise the shared precision envelope from **1,400 to 4,000 output tokens**. Both the primary and existing conditional rescue use that same builder. The optional context-image precision path also uses it.
2. Ignore a primary precision response unless its actual status is `completed`, before parsing it or considering the existing rescue condition.
3. If the existing conditional rescue is not completed, retain the original completed primary as the fallback. Never parse the incomplete rescue or issue a further call.

The model selection, `low` reasoning effort, strict JSON schema, `store: false`, service tier, prompts, images, geometry calibration and 7,000-token main envelope are unchanged. The existing rescue condition still requires a completed, parsed primary with empty levels or a missing price side. An incomplete or malformed primary does not gain a new rescue/retry path. No provider response status is rewritten and no partial JSON is repaired.

The added completion checks also close an existing edge case: an incomplete response whose text happens to parse as JSON must not be accepted as completed precision. Downstream verified-main geometry recovery remains as before; rejecting precision does not by itself erase independently usable main geometry.

## Offline verification

The new `tests/pocket-precision-output-v2.test.ts` executes the actual route's precision builder and control-flow slices with synthetic transport responses. Its nine checks cover both envelopes, a representative structured output with four anchors and eight levels, incomplete and malformed primary output, existing rescue eligibility, incomplete rescue fallback, transport failure, and the unchanged envelope validator's rejection of 4,000-token requests under a 1,400-token plan.

The retained real response is separately replayed only as an offline fixture. Its bytes and status are unchanged. The proposed route rejects its unfinished precision, makes one mock primary attempt, and creates no rescue attempt. This is a regression check of handling, not a regenerated provider response or evidence that 4,000 tokens would have completed that request.

Commands, from this proposal worktree:

```bash
node tests/pocket-precision-output-v2.test.ts
node tests/pocket-confirmed-facts.test.ts
node tests/pocket-test-provider-spend.test.ts
```

The existing confirmed-facts test changes one synthetic response to include its actual intended `completed` status. No production scanner fixture or frozen request is edited. See the accompanying offline validation receipt for the exact source/test hashes and results. No full application build or live quality claim is made by this targeted proposal.

## Revised upper bound under the retained pricing method

The calculation reuses `docs/monaco-126/benchmark50/COST-SOURCE-RECEIPT.json`, recorded on 2026-10-20. It is not a new pricing quote. The method reserves the full 400,000-token input context at $0.25 per million, plus the complete output cap at $2.00 per million. It does not subtract output space from the input bound, estimate image/text tokens from characters, or take a cache/batch discount. Reasoning is included in the output allowance.

| Planned slot | Old output cap | Proposed output cap | Old bound | Proposed bound |
| --- | ---: | ---: | ---: | ---: |
| Main | 7,000 | 7,000 | $0.114000 | $0.114000 |
| Primary precision | 1,400 | 4,000 | $0.102800 | $0.108000 |
| Existing conditional rescue | 1,400 | 4,000 | $0.102800 | $0.108000 |
| One chart, all three slots | — | — | $0.319600 | $0.330000 |
| Six charts, at most 18 sends | — | — | $1.917600 | **$1.980000** |

The maximum increase is **$0.062400 for six charts**. These are conservative reservation bounds, not actual billed totals. The six-chart calculation covers one image case per chart with the existing optional reading crop; it does not price an additional context-chart precision pair. Tax and currency conversion remain outside this token calculation. Machine-readable integer-micro-dollar arithmetic is in `COST-BOUND.json`.

## What a future versioned execution plan must change

This application patch is not sufficient to run the frozen benchmark with a larger cap. Its existing guards should continue to reject the mismatch.

| Boundary | Required future versioned work |
| --- | --- |
| Exact scanner source | Record the new route/executable hashes and explicitly identify this precision-v2 candidate. Keep original scanner and protocol evidence unchanged. |
| Request preview extraction | Use a new version of `prepare-monaco-request-previews.mjs` that pins the new route hash and expects 4,000 for both precision slots. The old extractor intentionally rejects the changed route. |
| Provider plan and fingerprints | Generate new exact request bytes, hashes and fingerprints, with 4,000-token precision caps and 108,000 micro-dollar precision reservations. Record a new plan digest. The original plan and raw receipts remain immutable. |
| JavaScript/TypeScript execution guards | Version the fixed 1,400-token checks and costs in the offline executor, runner bridge, executor-effects envelope check, isolated receipt validator and applicable continuation/first-six wrapper. Bind the new source, plan and honest evidence identity; do not bypass or silently broaden the old guards. |
| Generic application envelope validator | No validator relaxation is needed. `verifyPocketBenchmarkEnvelope` already requires equality with the slot's configured output limit. The future call-plan configuration must say 4,000/108,000 for precision and retain a matching model cost bound. The existing 7,000-token/114,000 micro-dollar model-wide maximum can encompass these per-slot bounds under the same retained rates. |
| Database claim and reservation | The frozen migration's `claim_pocket_benchmark_case` explicitly fixes 7,000/1,400. Its immutable `pocket_benchmark_reserved_bound` fixes 114,000/102,800/102,800. A separately reviewed version-aware admission/accounting path is required for the new exact cap/cost tuple. Do not rewrite historical reservations, receipts, accounting digests, immutable helpers or original request pins. |
| Scope and shared allowance | Existing chart identities are one-shot and the old run has already claimed them. A future plan needs explicit new versioned attempt identities/scope, while retaining the previous attempts and their cost commitments. It must account for all prior exposure under the existing shared allowance; neither a new ledger name nor a new plan resets that allowance. Actual authoritative headroom and current pricing must be checked before any future dispatch. |
| Accounting and retention | Keep submit-before-send, private response retention, authentic receipt IDs, both mandatory main/primary receipts, accounting before the next chart, and hard stops for ambiguous transport/receipt/account acknowledgements. No automatic resend, hidden failover or extra rescue path. |

Increasing the cap makes more output room available. Completion, chart-reading quality, calibration, latency within the unchanged endpoint timeout, and useful app behaviour still require genuine future evaluation on the new version. This proposal authorizes none of those future sends and claims none of those outcomes.
