import assert from "node:assert/strict";
import test from "node:test";
import {
  assertPocketGolden,
  validatePocketGoldenCase,
  type PocketGoldenCase,
} from "./support/pocket-golden-regression.ts";

const historicalClearRange: PocketGoldenCase = {
  id: "historical-clear-range",
  imageFile: "historical-clear-range.png",
  imageSha256: "a".repeat(64),
  privacyReviewed: true,
  market: "ES",
  timeframe: "5m",
  expectedLean: ["neutral", "bullish", "bearish"],
  expectedGuides: [
    { tool: "resistance", yPercent: 25, tolerance: 6, minimumConfidence: "medium" },
    { tool: "support", yPercent: 74, tolerance: 6, minimumConfidence: "medium" },
  ],
  forbiddenPhrases: ["add another timeframe", "cannot verify", "no support", "no resistance"],
};

test("golden manifest requires bounded image coordinates and tolerances", () => {
  validatePocketGoldenCase(historicalClearRange);
  assert.throws(() => validatePocketGoldenCase({ ...historicalClearRange, imageFile: "chart.txt" }));
  assert.throws(() => validatePocketGoldenCase({ ...historicalClearRange, privacyReviewed: false }));
  assert.throws(() => validatePocketGoldenCase({ ...historicalClearRange, imageSha256: "unverified" }));
  assert.throws(() => validatePocketGoldenCase({ ...historicalClearRange, expectedGuides: [{ tool: "support", yPercent: 99, tolerance: 20 }] }));
});

test("known readable range accepts both levels inside tolerance", () => {
  assertPocketGolden(historicalClearRange, {
    chartReadability: "clear",
    directionalLean: "neutral",
    summary: "Price is contained by repeated reactions on both sides.",
    observations: ["Upper rejection and lower defence remain visible."],
    noTradeReasons: ["Price remains inside the range.", "Live liquidity is unverified."],
    uncertainties: ["Only the submitted screenshot was reviewed."],
    visualGuides: [
      { tool: "resistance", yPercent: 27, confidence: "high" },
      { tool: "support", yPercent: 71, confidence: "medium" },
    ],
  });
});

test("known readable range fails when support is omitted", () => {
  assert.throws(() => assertPocketGolden(historicalClearRange, {
    chartReadability: "clear",
    directionalLean: "neutral",
    summary: "Only resistance was returned.",
    observations: ["Upper rejection is visible."],
    noTradeReasons: ["Context is incomplete.", "Live liquidity is unverified."],
    uncertainties: ["Only the submitted screenshot was reviewed."],
    visualGuides: [{ tool: "resistance", yPercent: 25, confidence: "high" }],
  }), /missing support/);
});

test("known readable range fails old evasive fallback wording", () => {
  assert.throws(() => assertPocketGolden(historicalClearRange, {
    chartReadability: "partial",
    directionalLean: "neutral",
    summary: "Cannot verify; add another timeframe picture.",
    observations: ["Some candles are visible."],
    noTradeReasons: ["Context is incomplete.", "Live liquidity is unverified."],
    uncertainties: ["Only the submitted screenshot was reviewed."],
    visualGuides: [
      { tool: "resistance", yPercent: 25, confidence: "high" },
      { tool: "support", yPercent: 74, confidence: "high" },
    ],
  }), /forbidden fallback copy/);
});
