import assert from "node:assert/strict";
import test from "node:test";
import { analyzeMarketSnapshot } from "../app/lib/market-intelligence-engine.ts";
import type { MarketSnapshot } from "../app/lib/market-data.ts";
import { createTradingDecision, type DecisionEngineInput } from "../app/lib/trading-decision-engine.ts";

function marketSnapshot(overrides: Partial<MarketSnapshot> = {}): MarketSnapshot {
  return {
    status: "LIVE",
    source: "Decision fixture",
    asOf: "2026-07-16T12:00:00.000Z",
    quotes: [
      { symbol: "ES", label: "ES", value: "6,325", change: "+1%", direction: "up" },
      { symbol: "VIX", label: "VIX", value: "15", change: "-1%", direction: "down" },
      { symbol: "US2Y", label: "2Y", value: "4.1%", change: "-2 bps", direction: "down" },
      { symbol: "US10Y", label: "10Y", value: "4.3%", change: "-1 bps", direction: "down" },
      { symbol: "DXY", label: "DXY", value: "98", change: "-0.2%", direction: "down" },
    ],
    levels: [
      { label: "R1", value: "6,335", note: "fixture", type: "resistance" },
      { label: "S1", value: "6,300", note: "fixture", type: "support" },
    ],
    events: [], bias: "BULLISH", risk: "MODERATE", summary: "fixture",
    evidence: { trend: 82, momentum: 78, volatility: 28, breadth: 76, macro: 70 },
    ...overrides,
  };
}

function input(snapshot = marketSnapshot(), overrides: Partial<DecisionEngineInput> = {}): DecisionEngineInput {
  const intelligence = analyzeMarketSnapshot(snapshot);
  return {
    intelligence,
    reasoning: intelligence.reasoning,
    dataStatus: snapshot.status,
    providerStatus: "connected",
    dataAgeMs: 60_000,
    fallbackActive: false,
    missingDataWarnings: intelligence.reasoning.missingDataWarnings,
    ...overrides,
  };
}

test("produces a strong bullish actionable decision", () => {
  const decision = createTradingDecision(input());
  assert.equal(decision.marketBias, "bullish");
  assert.equal(decision.tradePermission, "actionable");
  assert.equal(decision.recommendedPosture, "breakout");
  assert.ok(decision.confidenceScore >= 65);
  assert.deepEqual(decision.invalidationConditions[0], { kind: "BELOW_SUPPORT", level: "6,300" });
});

test("produces a strong bearish decision with confidence-based caution", () => {
  const snapshot = marketSnapshot({
    quotes: [
      { symbol: "ES", label: "ES", value: "6,100", change: "-2%", direction: "down" },
      { symbol: "VIX", label: "VIX", value: "24", change: "+5%", direction: "up" },
      { symbol: "US2Y", label: "2Y", value: "4.5%", change: "+4 bps", direction: "up" },
      { symbol: "US10Y", label: "10Y", value: "4.7%", change: "+3 bps", direction: "up" },
      { symbol: "DXY", label: "DXY", value: "104", change: "+1%", direction: "up" },
    ],
    evidence: { trend: 18, momentum: 22, volatility: 62, breadth: 20, macro: 25 },
  });
  const decision = createTradingDecision(input(snapshot));
  assert.equal(decision.marketBias, "bearish");
  assert.equal(decision.tradePermission, "caution");
  assert.equal(decision.recommendedPosture, "trend-following");
  assert.deepEqual(decision.invalidationConditions[0], { kind: "ABOVE_RESISTANCE", level: "6,335" });
});

test("mixed signals produce caution", () => {
  const snapshot = marketSnapshot({ evidence: { trend: 58, momentum: 45, volatility: 48, breadth: 52, macro: 50 } });
  const decision = createTradingDecision(input(snapshot));
  assert.equal(decision.tradePermission, "caution");
  assert.ok(decision.confidenceScore < 65);
});

test("elevated VIX raises risk and prevents unrestricted action", () => {
  const snapshot = marketSnapshot({
    quotes: marketSnapshot().quotes.map((quote) => quote.symbol === "VIX" ? { ...quote, value: "29", direction: "up" as const } : quote),
    evidence: { trend: 70, momentum: 68, volatility: 72, breadth: 65, macro: 60 },
  });
  const decision = createTradingDecision(input(snapshot));
  assert.equal(decision.volatilityRegime, "elevated");
  assert.equal(decision.riskRating, "high");
  assert.notEqual(decision.tradePermission, "actionable");
});

test("risk-off Treasury and Dollar conditions raise the risk rating", () => {
  const snapshot = marketSnapshot({
    quotes: marketSnapshot().quotes.map((quote) => ["US2Y", "US10Y", "DXY"].includes(quote.symbol) ? { ...quote, direction: "up" as const } : quote),
  });
  const decision = createTradingDecision(input(snapshot));
  assert.equal(decision.riskRating, "high");
});

test("stale data fails closed", () => {
  const decision = createTradingDecision(input(marketSnapshot(), { dataAgeMs: 31 * 60_000 }));
  assert.equal(decision.marketBias, "neutral");
  assert.equal(decision.tradePermission, "no-trade");
  assert.ok(decision.noTradeReasons.includes("STALE_DATA"));
  assert.ok(decision.dataQualityWarnings.some((warning) => warning.code === "STALE_DATA"));
});

test("missing critical data fails closed without invented levels", () => {
  const snapshot = marketSnapshot({ quotes: [], levels: [], evidence: {} });
  const decision = createTradingDecision(input(snapshot));
  assert.equal(decision.marketBias, "neutral");
  assert.equal(decision.recommendedPosture, "stand-aside");
  assert.deepEqual(decision.invalidationConditions, [{ kind: "DATA_QUALITY_FAILURE" }]);
  assert.ok(decision.noTradeReasons.includes("CRITICAL_INPUT_MISSING"));
});

test("fallback provider state forces no-trade", () => {
  const decision = createTradingDecision(input(marketSnapshot(), { fallbackActive: true }));
  assert.equal(decision.tradePermission, "no-trade");
  assert.equal(decision.confidenceScore, 0);
  assert.ok(decision.noTradeReasons.includes("FALLBACK_ACTIVE"));
});

test("materially conflicting evidence produces caution", () => {
  const intelligence = analyzeMarketSnapshot(marketSnapshot());
  intelligence.scores.riskOnRiskOff = 75;
  intelligence.scores.marketSentiment = 68;
  intelligence.scores.trend = 48;
  intelligence.scores.volatility = 72;
  const decision = createTradingDecision(input(marketSnapshot(), { intelligence, reasoning: intelligence.reasoning }));
  assert.equal(decision.tradePermission, "caution");
  assert.ok(decision.conflictingDrivers.length > 0);
});

test("severe conflict produces a neutral no-trade output", () => {
  const intelligence = analyzeMarketSnapshot(marketSnapshot());
  intelligence.scores.riskOnRiskOff = 80;
  intelligence.scores.marketSentiment = 75;
  intelligence.scores.trend = 20;
  intelligence.scores.volatility = 80;
  const decision = createTradingDecision(input(marketSnapshot(), { intelligence, reasoning: intelligence.reasoning }));
  assert.equal(decision.marketBias, "neutral");
  assert.equal(decision.tradePermission, "no-trade");
  assert.ok(decision.noTradeReasons.includes("SEVERE_SIGNAL_CONFLICT"));
});

test("preview output is always no-trade", () => {
  const snapshot = marketSnapshot({ status: "PREVIEW" });
  const decision = createTradingDecision(input(snapshot));
  assert.equal(decision.tradePermission, "no-trade");
  assert.equal(decision.recommendedPosture, "stand-aside");
  assert.ok(decision.noTradeReasons.includes("PREVIEW_DATA"));
});

test("is deterministic, versioned and JSON-serializable", () => {
  const currentInput = input();
  const first = createTradingDecision(currentInput);
  const second = createTradingDecision(currentInput);
  assert.deepEqual(first, second);
  assert.equal(first.schemaVersion, "1.0");
  assert.deepEqual(JSON.parse(JSON.stringify(first)), first);
});
