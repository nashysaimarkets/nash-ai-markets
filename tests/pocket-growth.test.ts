import assert from "node:assert/strict";
import test from "node:test";
import { growthAttribution, normaliseGrowthPayload } from "../app/lib/pocket-growth.ts";
import { timingSummaries } from "../app/lib/pocket-experience-metrics";

test("focused pages retain only allowlisted campaign names", () => {
  assert.deepEqual(growthAttribution(new URLSearchParams(), "/pocket-bullseye/indices"), { source: "direct", campaign: "indices" });
  assert.deepEqual(growthAttribution(new URLSearchParams("utm_campaign=first10"), "/pocket-bullseye/forex"), { source: "direct", campaign: "first10" });
});

test("bucket summaries report weighted upper bounds without inventing history", () => {
  assert.deepEqual(timingSummaries([]), []);
  const sample = timingSummaries([{ event: "scan_completed", platform: "web", flow: "web", bucket_ms: 60000, total: 8 }, { event: "scan_completed", platform: "web", flow: "web", bucket_ms: 120000, total: 2 }])[0];
  assert.equal(sample.total, 10); assert.equal(sample.p50UpperMs, 60000); assert.equal(sample.p90UpperMs, 120000);
});

test("activity recording never forwards arbitrary properties or campaign personal data", () => {
  const result = normaliseGrowthPayload({ event: "scan_completed", platform: "web", flow: "web", source: "email@example.com", campaign: "private_account_123", email: "secret@example.com", image: "data:image/png;base64,secret", duration_ms: 15 });
  assert.deepEqual(result, { event: "scan_completed", platform: "web", flow: "web", source: "other", campaign: "other", duration_ms: 15, is_test: false });
});
test("fictional samples and web calls cannot masquerade as Apple purchases or real scans", () => {
  assert.equal(normaliseGrowthPayload({ event: "scan_completed", platform: "apple", flow: "sample" }), null);
  assert.equal(normaliseGrowthPayload({ event: "purchase_completed", platform: "web", flow: "paid" }), null);
  assert.equal(normaliseGrowthPayload({ event: "invented_event", platform: "web", flow: "browse" }), null);
});
test("timing cannot overflow daily counters and test flags require a boolean", () => {
  assert.equal(normaliseGrowthPayload({ event: "scan_failed", platform: "web", flow: "web", duration_ms: Infinity })?.duration_ms, 0);
  const result = normaliseGrowthPayload({ event: "scan_failed", platform: "web", flow: "web", duration_ms: 1e20, is_test: "false" });
  assert.equal(result?.duration_ms, 600_000); assert.equal(result?.is_test, false);
});
test("known campaign labels survive the path to the sample without retaining arbitrary query data", () => {
  assert.deepEqual(growthAttribution(new URLSearchParams("utm_source=tipseason&utm_campaign=first10&email=secret@example.com")), { source: "tipseason", campaign: "first10" });
  assert.deepEqual(growthAttribution(new URLSearchParams()), { source: "direct", campaign: "discovery" });
});
