# Pocket Bullseye AI cost measurement

The September 7 candidate records provider token usage without chart images, prompts, report text, purchase tokens or customer identifiers. It adds no AI calls and changes no model, reasoning setting, timeout or accuracy gate.

## What is measured

Each resolved Responses API call emits a `pocket_ai_usage` JSON record with the actual returned model, service tier, operation and provider response ID. Input, cached input and output tokens are separate. Reasoning tokens are already included in output tokens. The precision rescue and liquidity calibration calls are counted separately. Failures without usage are unknown costs, not free calls.

Existing runtime logs did not supply enough token metadata to establish an actual cost per successful scan. These new records must first be deployed and collected. A passing accounting test is not evidence of a production scan or its cost.

## Collect and calculate

1. Deploy this candidate to an immutable preview and verify its build manifest matches the commit.
2. During a measured test window, record the number of full results actually displayed to testers. Include rejected uploads, failed scans and retries in the same cost window. A completed provider report alone does not prove the customer received a completed result.
3. Export only the sanitized JSON payloads following `[pocket-ai-usage]`, one JSON object per line, into a private `usage.ndjson` file. Never commit runtime logs or credentials.
4. Obtain the current prices from the actual billing provider/account for every returned model and service tier. Do not substitute prices for similarly named models. Create a private rates file with this shape, replacing the example identifiers and numbers with verified values:

   ```json
   {
     "currency": "USD",
     "prices": [
       {
         "model": "exact-returned-model",
         "serviceTier": "exact-returned-tier",
         "inputPerMillion": 0,
         "cachedInputPerMillion": 0,
         "outputPerMillion": 0
       }
     ]
   }
   ```

   The zeros above are placeholders, not measured prices. Record the source and effective date beside the private rates file.

5. Run `node scripts/pocket-ai-costs.mjs usage.ndjson verified-rates.json COMPLETED_SCAN_COUNT`.

The calculator deduplicates exact provider response IDs, rejects conflicting records, counts failures separately, and reports unknown costs. It produces a per-scan token cost only when every captured call has usable token counts and an exact matching rate. This remains incomplete if the export omitted calls, SDK retries or a separately billed service; reconcile it against the provider's usage/billing totals before treating it as actual expense.

## Decision to make from the evidence

Measure median and high-use subscriber scan counts, not just the average scan. Monthly contribution is actual store proceeds less all AI calls, hosting/payment overhead and refunds attributable to the cohort. Keep VAT, store commission, currency conversion and business taxes separate. Include the cost of free users who do not subscribe. Do not lower model quality or add a paid usage cap based on unverified estimates.
