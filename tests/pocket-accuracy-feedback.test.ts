import test from "node:test";
import assert from "node:assert/strict";
import { accuracySummary, benchmarkCandidates, correctionPatch, readAccuracyFeedback, type AccuracyFeedback } from "../app/pocket/accuracy-feedback.ts";
import { readFile } from "node:fs/promises";

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

test("correction replay extracts a deterministic user-verified level", () => {
  assert.deepEqual(correctionPatch(correction), { level: { kind: "support", price: "7638" } });
  assert.deepEqual(correctionPatch({ ...correction, correction: "Support: 7,638" }), { level: { kind: "support", price: "7638" } });
  assert.deepEqual(correctionPatch({ ...correction, categories: ["INSTRUMENT", "CURRENT_PRICE"], correction: "US 500, current 7738" }), {});
  assert.deepEqual(correctionPatch({ ...correction, categories: ["CURRENT_PRICE"], correction: "US 500, current 7738" }), {});
  assert.deepEqual(correctionPatch({ ...correction, categories: ["CURRENT_PRICE"], correction: "Current price: 7738" }), { currentPrice: "7738" });
  assert.deepEqual(correctionPatch({ ...correction, categories: ["SUPPORT"], correction: "support 7640, not 7650" }), {});
  assert.deepEqual(correctionPatch(accurate), {});
});

test("the current result never inherits a historical accuracy percentage", async () => {
  const panel = await readFile(new URL("../app/pocket/AccuracyFeedbackPanel.tsx", import.meta.url), "utf8");
  assert.match(panel, /AWAITING REVIEW/);
  assert.match(panel, /HISTORY ·/);
  assert.match(panel, /What single fact did Pocket get wrong/);
  assert.match(panel, /current\.includes\(category\) \? \[\] : \[category\]/);
  assert.match(panel, /disabled=\{!selected\.length \|\| !correctionIsUnambiguous\}/);
  assert.match(panel, /OPTIONAL · NOTE REQUIRED/);
  assert.match(panel, /CHART OBSERVATION SAVED/);
  assert.doesNotMatch(panel, />\{summary\.rate\}% <small>ACCURATE/);
});
