import assert from "node:assert/strict";
import test from "node:test";
import { invalidateDerivedChartEvidence, levelEvidenceSourceLabel } from "../app/pocket/pocket-derived-evidence.ts";

function analysedPair() {
  return {
    currentPrice: "100",
    levels: [{ kind: "support", price: "95" }],
    contextBattlefield: { currentPrice: "101", levels: [{ kind: "resistance", price: "105" }] },
    combinedBattlefield: { currentPrice: "100", levels: [{ kind: "support", price: "95" }, { kind: "resistance", price: "105" }] },
    contextContribution: { used: true, summary: "Context supplied resistance." },
    higherTimeframe: {
      provided: true,
      timeframe: "4h",
      direction: "BULLISH",
      alignment: "ALIGNED",
      summary: "Aligned context.",
    },
  };
}

test("replacing a context chart removes every field derived from the old image pair", () => {
  const original = analysedPair();
  const invalidated = invalidateDerivedChartEvidence(original, "CONTEXT_REPLACED");

  assert.equal(invalidated.currentPrice, "100");
  assert.equal(invalidated.levels, original.levels);
  assert.equal(invalidated.contextBattlefield, null);
  assert.equal(invalidated.combinedBattlefield, undefined);
  assert.equal(invalidated.contextContribution, undefined);
  assert.deepEqual(invalidated.higherTimeframe, {
    provided: false,
    timeframe: "",
    direction: "UNKNOWN",
    alignment: "NOT_PROVIDED",
    summary: "",
  });
  assert.equal(original.contextBattlefield.currentPrice, "101");
});

test("editing primary structure invalidates the combined merge but preserves the independent context read", () => {
  const original = analysedPair();
  const invalidated = invalidateDerivedChartEvidence(original, "PRIMARY_STRUCTURE_CHANGED");

  assert.equal(invalidated.contextBattlefield, original.contextBattlefield);
  assert.equal(invalidated.higherTimeframe, original.higherTimeframe);
  assert.equal(invalidated.combinedBattlefield, undefined);
  assert.equal(invalidated.contextContribution, undefined);
});

test("level source labels fail closed to the primary chart for legacy results", () => {
  assert.equal(levelEvidenceSourceLabel("CONTEXT"), "CONTEXT CHART");
  assert.equal(levelEvidenceSourceLabel("LEVEL_LAB"), "LEVEL LAB CHART");
  assert.equal(levelEvidenceSourceLabel("USER_VERIFIED"), "USER VERIFIED");
  assert.equal(levelEvidenceSourceLabel("PRIMARY"), "PRIMARY CHART");
  assert.equal(levelEvidenceSourceLabel(undefined), "PRIMARY CHART");
});
