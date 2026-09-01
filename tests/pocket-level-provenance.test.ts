import test from "node:test";
import assert from "node:assert/strict";
import { deriveLevelProvenance } from "../app/pocket/level-provenance.ts";

test("user verified replay levels receive exact high-confidence provenance", () => {
  const result = deriveLevelProvenance({ kind: "support", label: "Support · USER VERIFIED", price: "7640" }, 0);
  assert.equal(result.method, "USER_VERIFIED");
  assert.equal(result.confidence, "HIGH");
  assert.equal(result.precision, "EXACT");
});

test("uncalibrated AI levels are labelled approximate and low confidence", () => {
  const result = deriveLevelProvenance({ kind: "resistance", label: "Visible reaction", price: "around 7680" }, 1);
  assert.equal(result.method, "AI_DETECTED");
  assert.equal(result.confidence, "LOW");
  assert.equal(result.precision, "APPROXIMATE");
});

test("three scale anchors keep numeric AI levels below user-confirmed confidence", () => {
  const result = deriveLevelProvenance({ kind: "resistance", label: "Repeated rejection", price: "7680" }, 3);
  assert.equal(result.confidence, "MEDIUM");
  assert.equal(result.precision, "EXACT");
});

test("Level Lab provenance never borrows primary-chart anchors or evidence", () => {
  const result = deriveLevelProvenance({ kind: "support", label: "Independent floor", price: "7640", source: "LEVEL_LAB" }, 4);
  assert.equal(result.source, "LEVEL_LAB_CHART");
  assert.equal(result.confidence, "MEDIUM");
  assert.equal(result.precision, "EXACT");
  assert.match(result.evidence, /independent Level Lab scan/i);
  assert.doesNotMatch(result.evidence, /4 readable scale anchors/i);
});

test("context provenance does not inherit primary-chart scale confidence", () => {
  const result = deriveLevelProvenance({ kind: "resistance", label: "Context ceiling", price: "7680", source: "CONTEXT" }, 4);
  assert.equal(result.source, "CONTEXT_CHART");
  assert.equal(result.confidence, "LOW");
  assert.equal(result.precision, "APPROXIMATE");
});
