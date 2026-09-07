import assert from "node:assert/strict";
import test from "node:test";
import { pocketUsageRecord, observePocketUsage } from "../app/lib/server/pocket-ai-usage.ts";

test("usage accounting keeps cached input separate and excludes private response fields", () => {
  const result = pocketUsageRecord("report", {
    id: "resp_test", model: "test-model", service_tier: "default", status: "completed",
    input: "PRIVATE PROMPT", output_text: "PRIVATE REPORT", apiKey: "PRIVATE KEY",
    usage: { input_tokens: 100, input_tokens_details: { cached_tokens: 40 }, output_tokens: 70, output_tokens_details: { reasoning_tokens: 50 }, total_tokens: 170 },
  });
  assert.equal(result.usageComplete, true);
  assert.equal(result.cachedInputTokens, 40);
  assert.equal(result.outputTokens, 70);
  assert.equal(result.reasoningTokens, 50);
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE/);
});

test("missing, negative and inconsistent usage remain unknown or incomplete", () => {
  assert.equal(pocketUsageRecord("levels", {}).inputTokens, null);
  assert.equal(pocketUsageRecord("levels", {}).usageComplete, false);
  assert.equal(pocketUsageRecord("levels", { usage: { input_tokens: -1 } }).inputTokens, null);
  assert.equal(pocketUsageRecord("levels", { usage: { input_tokens: 10, input_tokens_details: { cached_tokens: 11 }, output_tokens: 2 } }).usageComplete, false);
});

test("observing calls preserves the exact response and failure, including concurrent partial failures", async () => {
  const originalLog = console.info;
  const logs: string[] = [];
  console.info = (...args) => { logs.push(args.join(" ")); };
  try {
    const response = { id: "resp_completed", model: "test-model" };
    const failure = new Error("PRIVATE PROVIDER ERROR");
    const [a, b] = await Promise.allSettled([
      observePocketUsage("liquidity", Promise.resolve(response)),
      observePocketUsage("liquidity-calibration", Promise.reject(failure)),
    ]);
    assert.equal(a.status, "fulfilled");
    if (a.status === "fulfilled") assert.equal(a.value, response);
    assert.equal(b.status, "rejected");
    if (b.status === "rejected") assert.equal(b.reason, failure);
    assert.equal(logs.length, 2);
    assert.match(logs.join(" "), /request_failed/);
    assert.doesNotMatch(logs.join(" "), /PRIVATE PROVIDER ERROR/);
  } finally { console.info = originalLog; }
});
