import test from "node:test";
import assert from "node:assert/strict";
import { summarizePocketCosts } from "../scripts/pocket-ai-costs.mjs";

// Deliberately synthetic rates, not a provider pricing claim.
const rates = { currency: "USD", prices: [{ model: "test-model", serviceTier: "default", inputPerMillion: 2, cachedInputPerMillion: 1, outputPerMillion: 10 }] };
const row = { event: "pocket_ai_usage", operation: "report", responseId: "resp_test", model: "test-model", serviceTier: "default", status: "completed", inputTokens: 1000, cachedInputTokens: 500, outputTokens: 100, reasoningTokens: 90 };

test("cost accounting separates cached tokens, includes reasoning once and deduplicates provider responses", () => {
  const actual = summarizePocketCosts([row, row], rates, 1);
  assert.equal(actual.knownTokenCost, 0.0025);
  assert.equal(actual.tokenCostPerCompletedScan, 0.0025);
  assert.equal(actual.calls, 1);
  assert.equal(actual.duplicates, 1);
  assert.equal(actual.complete, true);
});

test("unpriced models, failed attempts and inconsistent usage cannot become a complete scan price", () => {
  const failure = { event: "pocket_ai_usage", operation: "precision", status: "request_failed", responseId: null };
  const actual = summarizePocketCosts([row, failure, failure, { ...row, responseId: "resp_unknown", model: "unknown" }, { ...row, responseId: "resp_bad", cachedInputTokens: 1001 }], rates, 1);
  assert.equal(actual.unknownCalls, 4);
  assert.equal(actual.calls, 5);
  assert.equal(actual.complete, false);
  assert.equal(actual.tokenCostPerCompletedScan, null);
  assert.equal(actual.knownTokenCost, 0.0025);
});

test("conflicting duplicates and malformed financial inputs fail instead of silently understating cost", () => {
  assert.throws(() => summarizePocketCosts([row, { ...row, outputTokens: 2 }], rates), /Conflicting/);
  assert.throws(() => summarizePocketCosts([row], rates, 0), /positive integer/);
  assert.throws(() => summarizePocketCosts([row], { ...rates, prices: [{ ...rates.prices[0], inputPerMillion: -1 }] }), /nonnegative/);
  assert.throws(() => summarizePocketCosts([{ message: "unrelated log" }], rates), /only pocket_ai_usage/);
  assert.equal(summarizePocketCosts([], rates).complete, false);
});
