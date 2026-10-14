import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { parsePocketBenchmarkConfiguration, verifyPocketBenchmarkEnvelope, withPocketTestSpendScope } from "../app/api/pocket/torture/provider-spend.ts";

test("new benchmark scope remains held without explicit pilot activation", async () => {
  const before = process.env.POCKET_BENCHMARK_PILOT_ENABLED;
  delete process.env.POCKET_BENCHMARK_PILOT_ENABLED;
  let calls = 0;
  await assert.rejects(() => withPocketTestSpendScope("range-clear", async () => { calls++; }), /pilot spending remains held/i);
  assert.equal(calls, 0);
  if (before === undefined) delete process.env.POCKET_BENCHMARK_PILOT_ENABLED; else process.env.POCKET_BENCHMARK_PILOT_ENABLED = before;
});

const image = `data:image/png;base64,${Buffer.from("bounded-fixture").toString("base64")}`;
const envelope = {
  model: "verified-model", service_tier: "default", store: false,
  reasoning: { effort: "low" }, max_output_tokens: 7000,
  instructions: "bounded instructions",
  input: [{ role: "user", content: [{ type: "input_text", text: "audit" }, { type: "input_image", image_url: image, detail: "high" }] }],
  text: { format: { type: "json_schema", strict: true, schema: { type: "object" } } },
};
const plan = {
    main: { slot: "main", model: "verified-model", serviceTier: "default", maxOutputTokens: 7000, maxInputTextChars: 1000, maxSchemaBytes: 1000, maxImages: 1, maxImageBytes: 1000, maxCostMicroUsd: 500000, costBoundEvidenceRef: "pricing-export-1" },
    primary_precision: { slot: "primary_precision", model: "verified-model", serviceTier: "default", maxOutputTokens: 1400, maxInputTextChars: 1000, maxSchemaBytes: 1000, maxImages: 1, maxImageBytes: 1000, maxCostMicroUsd: 200000, costBoundEvidenceRef: "pricing-export-1" },
    rescue_precision: { slot: "rescue_precision", model: "verified-model", serviceTier: "default", maxOutputTokens: 1400, maxInputTextChars: 1000, maxSchemaBytes: 1000, maxImages: 2, maxImageBytes: 2000, maxCostMicroUsd: 300000, costBoundEvidenceRef: "pricing-export-1" },
};
const scope = {
  plan,
  bounds: { "verified-model": { serviceTier: "default", maxOutputTokens: 7000, maxInputTextChars: 1000, maxSchemaBytes: 1000, maxImages: 1, maxImageBytes: 1000, maxCostMicroUsd: 500000, fullContextCostBoundEvidenceRef: "pricing-export-1" } },
} as never;

test("actual provider envelope is inspected and fingerprinted", () => {
  const facts = verifyPocketBenchmarkEnvelope("main", envelope, scope);
  assert.equal(facts?.images, 1);
  assert.equal(facts?.serviceTier, "default");
  assert.match(facts?.fingerprint ?? "", /^[0-9a-f]{64}$/);
});

test("one verified model supports distinct main and precision slot bounds", () => {
  const beforeBounds = process.env.POCKET_BENCHMARK_MODEL_COST_BOUNDS;
  const beforePlan = process.env.POCKET_BENCHMARK_CALL_PLAN;
  process.env.POCKET_BENCHMARK_MODEL_COST_BOUNDS = JSON.stringify({
    "verified-model": { serviceTier: "default", maxOutputTokens: 7000, maxInputTextChars: 30000, maxSchemaBytes: 30000, maxImages: 2, maxImageBytes: 4000000, maxCostMicroUsd: 500000, fullContextCostBoundEvidenceRef: "pricing-export-1" },
  });
  process.env.POCKET_BENCHMARK_CALL_PLAN = JSON.stringify(Object.values(plan));
  try {
    const parsed = parsePocketBenchmarkConfiguration();
    assert.equal(parsed.plan.main.maxOutputTokens, 7000);
    assert.equal(parsed.plan.primary_precision.maxOutputTokens, 1400);
    assert.equal(parsed.plan.rescue_precision.maxImages, 2);
  } finally {
    if (beforeBounds === undefined) delete process.env.POCKET_BENCHMARK_MODEL_COST_BOUNDS; else process.env.POCKET_BENCHMARK_MODEL_COST_BOUNDS = beforeBounds;
    if (beforePlan === undefined) delete process.env.POCKET_BENCHMARK_CALL_PLAN; else process.env.POCKET_BENCHMARK_CALL_PLAN = beforePlan;
  }
});

test("unpriced features, tier drift, image overflow and output drift fail closed", () => {
  for (const changed of [
    { ...envelope, service_tier: "auto" },
    { ...envelope, tools: [{ type: "web_search" }] },
    { ...envelope, max_output_tokens: 7001 },
    { ...envelope, input: [{ role: "user", content: [...envelope.input[0]!.content, { type: "input_image", image_url: image, detail: "high" }] }] },
  ]) assert.throws(() => verifyPocketBenchmarkEnvelope("main", changed, scope), /benchmark|provider request/i);
});

test("routes pass the exact request object, deterministic slots and pinned tier", async () => {
  const route = await readFile(new URL("../app/api/pocket/analyse/route.ts", import.meta.url), "utf8");
  assert.match(route, /service_tier:\s*"default"/);
  assert.match(route, /dispatchPocketAnalysisProviderCall\("main", analysisEnvelope/);
  assert.match(route, /rescue \? "rescue_precision" : "primary_precision"/);
  assert.doesNotMatch(route, /dispatchPocketAnalysisProviderCall\(model,\s*7000/);
});

test("pilot SQL is isolated, deterministic, six-case bounded and postflight-vetoed", async () => {
  const sql = await readFile(new URL("../supabase/migrations/20261014113000_pocket_benchmark_pilot.sql", import.meta.url), "utf8");
  assert.match(sql, /cap_microusd between 1 and 5000000/);
  assert.match(sql, /primary key \(ledger_key, case_id, slot\)/);
  assert.match(sql, /count\(\*\)[\s\S]*>= 6/);
  assert.match(sql, /p_case_id = any\(v_ledger\.allowed_case_ids\)/);
  assert.match(sql, /previous_case_unresolved/);
  assert.match(sql, /possibly charged call cannot be voided/);
  assert.match(sql, /assert_pocket_benchmark_case_reconciled/);
  assert.match(sql, /record_pocket_benchmark_measurement/);
  assert.match(sql, /release_pocket_benchmark_measurement/);
  assert.match(sql, /authoritative_settlement_incomplete/);
  assert.doesNotMatch(sql, /pocket_test_spend_ledgers\s+set|alter table private\.pocket_test_spend/i);
});

test("provisional scanner evidence is withheld until authoritative settlement", async () => {
  const route = await readFile(new URL("../app/api/pocket/torture/route.ts", import.meta.url), "utf8");
  assert.match(route, /PENDING_AUTHORITATIVE_SETTLEMENT/);
  assert.match(route, /recordPocketBenchmarkMeasurement\(requested, measurement\)/);
  assert.match(route, /releasePocketBenchmarkMeasurement\(requested\)/);
});
