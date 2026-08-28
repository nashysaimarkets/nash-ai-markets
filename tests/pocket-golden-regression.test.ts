import assert from "node:assert/strict";
import test from "node:test";
import {
  assertPocketGolden,
  assertPocketReleaseGate,
  summarizePocketBenchmark,
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
  scenario: "range",
  expectedReadability: ["clear", "partial"],
  maximumExtraGuides: 0,
  privacyReview: { reviewedAt: "2026-08-28T08:00:00.000Z", reviewer: "owner", consent: "owner-supplied", redactions: ["account details"] },
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

test("benchmark summary measures recall, complete chart passes and false positives", () => {
  const actual = {
    chartReadability: "clear" as const, directionalLean: "neutral" as const,
    summary: "Visible range.", observations: ["Both sides visible."],
    noTradeReasons: ["Wait for confirmation."], uncertainties: ["Screenshot only."],
    visualGuides: [
      { tool: "resistance" as const, yPercent: 25, confidence: "high" as const },
      { tool: "support" as const, yPercent: 74, confidence: "high" as const },
    ],
  };
  const metrics = summarizePocketBenchmark([{ golden: historicalClearRange, actual }]);
  assert.equal(metrics.guideRecallPercent, 100);
  assert.equal(metrics.chartPassPercent, 100);
  assert.equal(metrics.extraGuides, 0);
  assert.throws(() => assertPocketReleaseGate(metrics), /1\/30/);
});

test("release gate requires coverage and measured accuracy", () => {
  assert.doesNotThrow(() => assertPocketReleaseGate({
    charts: 30, requiredGuides: 60, matchedGuides: 57, guideRecallPercent: 95,
    chartsPassing: 27, chartPassPercent: 90, extraGuides: 3,
    scenarios: ["breakout", "range", "reversal", "trend"], timeframes: ["5m", "15m", "1h"],
  }));
  assert.throws(() => assertPocketReleaseGate({
    charts: 30, requiredGuides: 60, matchedGuides: 50, guideRecallPercent: 83,
    chartsPassing: 25, chartPassPercent: 83, extraGuides: 4,
    scenarios: ["range"], timeframes: ["5m"],
  }), /scenario families/);
});
