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
