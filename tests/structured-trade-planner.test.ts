import assert from "node:assert/strict";
import test from "node:test";
import { analyzeMarketSnapshot } from "../app/lib/market-intelligence-engine.ts";
import type { MarketSnapshot } from "../app/lib/market-data.ts";
import { createTradingDecision, type DecisionEngineInput } from "../app/lib/trading-decision-engine.ts";
import { createStructuredTradePlan, type TradePlannerInput } from "../app/lib/structured-trade-planner.ts";

function snapshot(overrides: Partial<MarketSnapshot> = {}): MarketSnapshot {
  return {
    status: "LIVE", source: "Planner fixture", asOf: "2026-07-16T12:00:00.000Z",
    quotes: [
      { symbol: "ES", label: "ES", value: "6325", change: "+1", direction: "up" },
      { symbol: "VIX", label: "VIX", value: "15", change: "-1", direction: "down" },
      { symbol: "US2Y", label: "2Y", value: "4.1%", change: "-2", direction: "down" },
      { symbol: "US10Y", label: "10Y", value: "4.3%", change: "-1", direction: "down" },
      { symbol: "DXY", label: "DXY", value: "98", change: "-0.2", direction: "down" },
    ],
    levels: [
      { label: "R1", value: "6335", note: "fixture", type: "resistance" },
      { label: "S1", value: "6300", note: "fixture", type: "support" },
    ],
    events: [], bias: "BULLISH", risk: "MODERATE", summary: "fixture",
    evidence: { trend: 82, momentum: 78, volatility: 28, breadth: 76, macro: 70 },
    ...overrides,
  };
}

function plannerInput(currentSnapshot = snapshot(), overrides: Partial<TradePlannerInput> = {}): TradePlannerInput {
  const intelligence = analyzeMarketSnapshot(currentSnapshot);
  const decisionInput: DecisionEngineInput = {
    intelligence, reasoning: intelligence.reasoning, dataStatus: currentSnapshot.status,
    providerStatus: "connected", dataAgeMs: 60_000, fallbackActive: false,
    missingDataWarnings: intelligence.reasoning.missingDataWarnings,
  };
  const decision = createTradingDecision(decisionInput);
  return {
    decision, intelligence, dataStatus: currentSnapshot.status, providerStatus: "connected",
    dataAgeMs: 60_000, fallbackActive: false,
    missingDataWarnings: intelligence.reasoning.missingDataWarnings,
    ...overrides,
  };
}

test("creates a ready strong bullish plan", () => {
  const plan = createStructuredTradePlan(plannerInput());
  assert.equal(plan.directionalPosture, "long-bias");
  assert.equal(plan.executionReadiness, "ready");
  assert.ok(["small", "normal"].includes(plan.participationLevel));
  assert.equal(plan.preferredSetupType, "breakout");
});

test("creates a conditional strong bearish plan", () => {
  const current = snapshot({
    quotes: snapshot().quotes.map((quote) => ({ ...quote, direction: quote.symbol === "VIX" || quote.symbol === "DXY" || quote.symbol.startsWith("US") ? "up" as const : "down" as const })),
    evidence: { trend: 18, momentum: 20, volatility: 58, breadth: 20, macro: 22 },
  });
  const plan = createStructuredTradePlan(plannerInput(current));
  assert.equal(plan.directionalPosture, "short-bias");
  assert.equal(plan.executionReadiness, "conditional");
  assert.ok(["very-small", "small"].includes(plan.participationLevel));
});

test("keeps a neutral decision neutral", () => {
  const current = snapshot({ evidence: { trend: 50, momentum: 50, volatility: 45, breadth: 50, macro: 50 }, quotes: snapshot().quotes.map((quote) => ({ ...quote, direction: "flat" as const })) });
  const currentInput = plannerInput(current);
  currentInput.decision.marketBias = "neutral";
  currentInput.decision.recommendedPosture = "stand-aside";
  const plan = createStructuredTradePlan(currentInput);
  assert.equal(plan.directionalPosture, "neutral");
  assert.notEqual(plan.preferredSetupType, "trend-continuation");
});

test("conflicting drivers reduce participation and require confirmation", () => {
  const currentInput = plannerInput();
  currentInput.decision.conflictingDrivers = [{ factor: "TREND", score: 30, contribution: -20 }];
  const plan = createStructuredTradePlan(currentInput);
  assert.equal(plan.participationLevel, "very-small");
  assert.equal(plan.executionReadiness, "conditional");
  assert.equal(plan.preferredSetupType, "wait-for-confirmation");
  assert.ok(plan.requiredConfirmations.includes("DRIVER_CONFLICT_RESOLVED"));
});

test("high and extreme volatility reduce or prevent participation", () => {
  const elevated = plannerInput();
  elevated.decision.volatilityRegime = "elevated";
  assert.equal(createStructuredTradePlan(elevated).participationLevel, "very-small");
  const extreme = plannerInput();
  extreme.decision.volatilityRegime = "extreme";
  extreme.decision.tradePermission = "no-trade";
  const plan = createStructuredTradePlan(extreme);
  assert.equal(plan.participationLevel, "none");
  assert.equal(plan.directionalPosture, "stand-aside");
});

test("stale data fails closed", () => {
  const plan = createStructuredTradePlan(plannerInput(snapshot(), { dataAgeMs: 31 * 60_000 }));
  assert.equal(plan.directionalPosture, "stand-aside");
  assert.equal(plan.participationLevel, "none");
  assert.equal(plan.executionReadiness, "not-ready");
  assert.ok(plan.reasonsToRemainSidelined.includes("STALE_DATA"));
});

test("fallback provider fails closed", () => {
  const plan = createStructuredTradePlan(plannerInput(snapshot(), { fallbackActive: true }));
  assert.equal(plan.executionReadiness, "not-ready");
  assert.equal(plan.preferredSetupType, "none");
  assert.ok(plan.reasonsToRemainSidelined.includes("FALLBACK_ACTIVE"));
});

test("incomplete critical data fails closed", () => {
  const current = snapshot({ quotes: [], levels: [], evidence: {} });
  const plan = createStructuredTradePlan(plannerInput(current));
  assert.equal(plan.directionalPosture, "stand-aside");
  assert.equal(plan.participationLevel, "none");
  assert.equal(plan.executionReadiness, "not-ready");
});

test("upcoming high-impact events create warnings and reduce readiness", () => {
  const plan = createStructuredTradePlan(plannerInput(snapshot(), { upcomingEvents: [{ id: "EVENT_1", impact: "HIGH", startsInMinutes: 45, status: "UPCOMING" }] }));
  assert.equal(plan.eventRiskWarnings[0]?.code, "HIGH_IMPACT_EVENT_UPCOMING");
  assert.equal(plan.executionReadiness, "conditional");
  assert.equal(plan.participationLevel, "very-small");
  assert.ok(plan.requiredConfirmations.includes("EVENT_WINDOW_CLEARED"));
});

test("no-trade decisions remain no-trade", () => {
  const currentInput = plannerInput();
  currentInput.decision.tradePermission = "no-trade";
  currentInput.decision.noTradeReasons = ["LOW_CONFIDENCE"];
  const plan = createStructuredTradePlan(currentInput);
  assert.equal(plan.directionalPosture, "stand-aside");
  assert.equal(plan.preferredSetupType, "none");
  assert.equal(plan.executionReadiness, "not-ready");
  assert.ok(plan.reasonsToRemainSidelined.includes("LOW_CONFIDENCE"));
});

test("planner confidence never exceeds decision confidence", () => {
  const currentInput = plannerInput();
  currentInput.decision.confidenceScore = 42;
  const plan = createStructuredTradePlan(currentInput);
  assert.ok(plan.planConfidence <= 42);
});

test("output strips inherited market levels and prohibited sizing fields", () => {
  const plan = createStructuredTradePlan(plannerInput());
  const serialized = JSON.stringify(plan);
  assert.equal(serialized.includes("6335"), false);
  assert.equal(serialized.includes("6300"), false);
  const keys = new Set<string>();
  const collectKeys = (value: unknown): void => {
    if (Array.isArray(value)) value.forEach(collectKeys);
    else if (value && typeof value === "object") {
      Object.entries(value).forEach(([key, nested]) => {
        keys.add(key.toLowerCase());
        collectKeys(nested);
      });
    }
  };
  collectKeys(plan);
  for (const prohibited of ["entryPrice", "stopPrice", "targetPrice", "supportValue", "resistanceValue", "expectedMove", "contracts", "leverage", "capitalPercentage"]) {
    assert.equal(keys.has(prohibited.toLowerCase()), false);
  }
});

test("is deterministic, versioned and JSON-serializable", () => {
  const currentInput = plannerInput();
  const first = createStructuredTradePlan(currentInput);
  const second = createStructuredTradePlan(currentInput);
  assert.deepEqual(first, second);
  assert.equal(first.schemaVersion, "1.0");
  assert.deepEqual(JSON.parse(JSON.stringify(first)), first);
});
