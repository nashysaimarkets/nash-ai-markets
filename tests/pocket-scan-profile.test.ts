import test from "node:test";
import assert from "node:assert/strict";
import { scanProfile, compactReportSchema, expandCompactReport } from "../app/api/pocket/scan-profile";
import { createScanMetrics } from "../app/api/pocket/scan-metrics";

test("trial headers cannot override configured processing outside the dedicated preview", () => {
  const request = new Request("https://example.test", { headers: { "x-pocket-trial-profile": "fast" } });
  const branch = "feat/pocket-guided-speed-trial-2026-09-09";
  assert.equal(scanProfile(request, { POCKET_SCAN_PROFILE: "baseline", VERCEL_ENV: "production", VERCEL_GIT_COMMIT_REF: branch }), "baseline");
  assert.equal(scanProfile(request, { POCKET_SCAN_PROFILE: "baseline", VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: "another-branch" }), "baseline");
  assert.equal(scanProfile(request, { VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: branch }), "fast");
  assert.equal(scanProfile(request, {}), "full-parallel");
  assert.equal(scanProfile(request, { POCKET_SCAN_PROFILE: "baseline" }), "baseline");
  assert.equal(scanProfile(request, { POCKET_SCAN_PROFILE: "compact" }), "compact");
  assert.equal(scanProfile(request, { POCKET_SCAN_PROFILE: "invalid" }), "baseline");
});

test("compact transport preserves independent geometry and expands only supplied findings", () => {
  const original = { type: "object", additionalProperties: false, properties: { bullishCase: {}, bullConfirmation: {}, levels: {}, priceScaleAnchors: {}, evidencePack: {} }, required: ["bullishCase", "bullConfirmation", "levels", "priceScaleAnchors", "evidencePack"] };
  const compact = compactReportSchema(original);
  assert.deepEqual(compact.required, ["bullishCase", "levels", "priceScaleAnchors", "evidencePack"]);
  assert.ok("bullConfirmation" in original.properties);
  const source = { direction: "BULLISH", bullishCase: "Only after a visible hold above resistance.", bearishCase: "Only after support fails.", invalidation: "Failure to hold the reclaimed boundary.", riskFlags: ["Volume is unavailable."], levels: [{ label: "Visible support", price: "UNKNOWN" }] };
  const expanded = expandCompactReport(source) as Record<string, unknown>;
  assert.deepEqual(expanded.improvesSetup, [source.bullishCase]);
  assert.equal(expanded.bearConfirmation, source.bearishCase);
  assert.deepEqual(expanded.killsSetup, [source.invalidation]);
  assert.deepEqual(expanded.whatYouMayBeMissing, source.riskFlags);
  assert.notEqual(expanded.whatYouMayBeMissing, source.riskFlags);
  assert.deepEqual(expanded.levels, source.levels);
  assert.equal("bullConfirmation" in source, false);
  assert.throws(() => expandCompactReport({ ...source, invalidation: "" }));
  assert.throws(() => expandCompactReport({ ...source, riskFlags: [42] }));
});

test("usage records actual returned service tiers including fallback", () => {
  const output: Record<string, unknown>[] = [];
  const metrics = createScanMetrics(2, (entry) => output.push(entry));
  metrics.usage("report", "model", { input_tokens: 10, output_tokens: 20 }, "default");
  metrics.usage("precision", "model", { input_tokens: 30, output_tokens: 40 }, "priority");
  metrics.finish("completed");
  assert.deepEqual((output[0].calls as { serviceTier: string }[]).map((c) => c.serviceTier), ["default", "priority"]);
});
