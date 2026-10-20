# Cost ceiling and remaining security admission

20 October 2026. **Automated advisory calculation, not financial, legal, human-reference or execution approval.** No provider call, credential, API metadata query or ledger mutation was used. Prices below are direct OpenAI API token charges in USD before taxes/foreign-exchange effects. Those effects, if applicable to the owner's cash cap, require a separate allowance.

The historical $2 ledger remains separate and held. The six-case pilot retains its existing **aggregate $5 cap**, including prior, reserved and unresolved amounts; this document does not assert an unused balance. Preparation of 50 charts authorises no paid analysis. The remaining 44 charts need their own explicit scope and aggregate approval; do not reset/reuse the six-case ledger or divide the 44 into new $5 pilots to evade that decision.

## Current primary evidence

| Evidence retrieved 2026-10-20 | Fact used |
| --- | --- |
| [GPT-5 Mini model](https://developers.openai.com/api/docs/models/gpt-5-mini) | Lists exact snapshot `gpt-5-mini-2025-08-07`, a 400,000-token context window, uncached input $0.25/million and output $2.00/million. |
| [Responses create reference](https://developers.openai.com/api/reference/ruby/resources/responses/methods/create) | `default` uses standard model pricing. `max_output_tokens` includes visible output and reasoning. |
| [Images and vision](https://developers.openai.com/api/docs/guides/images-vision) | Images and the rest of the prompt must fit input/context limits. Current patch guidance lists a 1.2 multiplier for deprecated GPT-5 Mini and rejects images above 30,000 processed patches; it no longer lists that model's former sizing budget. |
| [Reasoning guide](https://developers.openai.com/api/docs/guides/reasoning) | Reasoning is billed as output. Incomplete output can incur input/reasoning charges even without visible text. |
| [Pricing](https://developers.openai.com/api/docs/pricing) | Responses has no separate API charge; enabled tools have separate pricing. The rendered main table did not expose the old mini row, so model-specific rates above come from the model page. |
| [Deprecations](https://developers.openai.com/api/docs/deprecations) | The exact snapshot is deprecated with shutdown scheduled for **11 December 2026**. Preserve the pin; never silently substitute another model. This is public documentation, not a new account/model-access check. |

## Full-context ceiling

For each permitted request, conservatively charge all **400,000 input tokens** at the uncached rate and the complete output cap at the output rate. This deliberately fails to subtract output space from the context window. It includes instructions, input text, schema/format overhead and images within the input allowance. Image tokens are not free and are not added twice. No character-to-token conversion, expected-output assumption, prompt-cache discount, Batch discount or image resizing estimate is used.

`ceiling USD = 400000 * 0.25 / 1000000 + max_output_tokens * 2.00 / 1000000`

| Slot | Output cap, including reasoning | Ceiling USD | Integer microUSD |
| --- | ---: | ---: | ---: |
| main | 7,000 | 0.114000 | 114,000 |
| primary_precision | 1,400 | 0.102800 | 102,800 |
| rescue_precision | 1,400 | 0.102800 | 102,800 |
| One chart, all three possible sends | 9,800 | **0.319600** | **319,600** |
| Six charts, at most 18 sends | 58,800 | **1.917600** | **1,917,600** |
| Remaining 44 charts, at most 132 sends | 431,200 | **14.062400** | **14,062,400** |
| Full 50 charts, at most 150 sends | 490,000 | **15.980000** | **15,980,000** |

These are arithmetic ceilings under the frozen scope, not measured charges or a promise that every request completes. The 44-chart and full-50 ceilings exceed the existing $5 authority. The six-chart ceiling fits below $5 only if sufficient aggregate headroom remains and every other admission gate passes. Smaller actual requests may cost less; that does not authorise them.

The ceiling assumes direct standard-tier Responses requests to the intended snapshot, `reasoning.effort=low`, `store=false`, no provider tools, no background/conversation/previous-response state, no separately priced options, and one transmission per slot. The local OpenAI client explicitly uses `maxRetries:0`. Any retry, rerun, failover, additional model, larger output cap or changed pricing invalidates this plan; it is not free because the first call timed out. Reject unsupported/unavailable snapshots and fail closed rather than change models. If execution occurs after the documented shutdown or a documented pricing change, prepare new evidence and seek the applicable scope decision; do not repeat completed API metadata verification.

## Exact request and finance admission still required

The existing six-case previews already bind main/precision/rescue envelopes to their input hashes; they are preparation evidence only. Their `textChars`, schema bytes and image dimensions are envelope limits, **not token counts**. Preserve the exact route initializer SHA and compile the final candidate's complete request fingerprints. The new corpus requires its own manifest. Neutral requests must exclude case IDs, target labels, annotations and expected geometry. The historical `macroEvents=[]`, absent context image and absent corrections remain an explicit proposed execution scope, not a claim that the production route naturally produces those inputs.

Proposed model-bound `maxCostMicroUsd` is 114000 with `maxOutputTokens=7000`; proposed slot bounds are 114000/102800/102800. All other bounds must come from the final exact envelope inventory and satisfy the existing validator. Do not paste these partial values into live configuration. Bind the final request bytes, source commit, model/tier, licence/review records, project and existing authorised executor to a dated independent finance/security review and owner run approval.

Before any send, the actual durable ledger must atomically reserve all three slots for the named chart against the correct aggregate budget, reject duplicate claims, and count reserved/submitted/unresolved exposure. Keep concurrency at one chart. Only provably unsubmitted conditional slots may be voided. Preserve request/response IDs, exact returned snapshot/tier, complete usage, envelope fingerprint and raw-response hash. Missing receipts or ambiguous charges stay reserved/unresolved. An estimated ceiling or full reservation is not independent dollar settlement; distinguish receipt-backed provisional analysis from financially settled acceptance. Reuse the existing release veto and authoritative billing reconciliation. No ledger write or configuration activation is part of this document.

## Security and rights conditions

[OpenAI's data-controls guide](https://developers.openai.com/api/docs/guides/your-data) says API content is not used for training unless the customer opts in. Default abuse-monitoring retention can last 30 days, with legal/safety exceptions. `store=false` does not establish Zero Data Retention: prompt-cache state can persist, and image/file safety-review exceptions exist. Project-specific controls require actual evidence; none is inferred here. These processor terms do not grant rights to market data.

The existing source-rights research remains the source of licence scope; do not reopen it or claim that a software licence covers third-party observations. Confirm the actual executor's processing, retention, territory and no-training configuration fit the recorded grant. Old GetData source permission and independent reference acceptance remain separate unresolved gates. Private data/chart/reference artifacts must stay private; public receipts contain hashes and evidence summaries.

The final executor review must establish the approved existing credential/project binding without exposing or broadening the completed metadata credential; direct intended egress only; no paid health probe; no route-wide production invocation; bounded images/text/schema and exact allowlisted envelope keys; no source/label leakage; protected private artifacts and redacted logs; no credentials in prompts or repository; and reservation enforcement on every provider path. The provider dispatch helper permits ordinary non-benchmark dispatch when no spend scope exists, so an approved benchmark adapter must require and verify that scope rather than rely on preview validation alone. Auth, entitlement and customer/production state must not be bypassed or mutated to obtain test execution.

## Source identities reviewed

Base commit: `856763146d293d91d22c2ce0e7700c9e73731187`. These are static source observations, not fresh runtime or test attestations.

| File | SHA-256 |
| --- | --- |
| `app/api/pocket/analyse/route.ts` | `5a59b0cde257ad8ab885af9c9171198fe9732ad3a286efda301c6226903b7294` |
| `app/lib/server/openai.ts` | `c5b7f3a946ae859054e6a95b3275d2d5a1af2e898d7ad5d90ec96e913cc355fc` |
| `app/api/pocket/torture/provider-spend.ts` | `3d52facf8fd8d9f2784ecafd41ea2911c812394d658cfc9669c43031791e58ce` |
| `scripts/prepare-monaco-request-previews.mjs` | `763322066e2aa094c29e0d4313f31b5fa72a75b5e26353cd374e2226d770d0ad` |

The evidence provenance JSON retained alongside this work records official URLs, retrieval references and the exact arithmetic. Dispatch remains disabled; no human review or financial acceptance is claimed.
