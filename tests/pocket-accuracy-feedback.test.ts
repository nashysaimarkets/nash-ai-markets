import test from "node:test";
import assert from "node:assert/strict";
import { accuracySummary, benchmarkCandidates, readAccuracyFeedback, type AccuracyFeedback } from "../app/pocket/accuracy-feedback.ts";

const accurate: AccuracyFeedback = {
  id: "a", createdAt: "2026-08-24T00:00:00.000Z", verdict: "ACCURATE", categories: [], correction: "", note: "",
  snapshot: { instrument: "US 500", timeframe: "30m", currentPrice: "7658", support: ["7640"], resistance: ["7680"] },
};
const correction: AccuracyFeedback = {
  ...accurate, id: "b", verdict: "NEEDS_CORRECTION", categories: ["SUPPORT"], correction: "7638", note: "lower reaction",
};

test("accuracy feedback parser fails closed for invalid device data", () => {
  assert.deepEqual(readAccuracyFeedback("not-json"), []);
  assert.equal(readAccuracyFeedback(JSON.stringify([accurate, correction])).length, 2);
});

test("accuracy summary exposes the repeated failure area", () => {
  assert.deepEqual(accuracySummary([accurate, correction]), { total: 2, accurate: 1, rate: 50, corrections: 1, repeatedIssue: "SUPPORT" });
});

test("only corrections become benchmark candidates", () => {
  const candidates = benchmarkCandidates([accurate, correction]);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].expected.correction, "7638");
});
