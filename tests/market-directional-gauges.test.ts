import assert from "node:assert/strict";
import test from "node:test";
import { createMarketDirectionalGauges } from "../app/lib/market-directional-gauges.ts";
import { MARKET_BOARD_SYMBOLS } from "../app/lib/market-board-instruments.ts";
import type { MarketSnapshot } from "../app/lib/market-data.ts";
import { createMarketDeskSignals } from "../app/lib/market-desk-signals.ts";
import { analyzeMarketSnapshot } from "../app/lib/market-intelligence-engine.ts";
import { createTradingDecision } from "../app/lib/trading-decision-engine.ts";
import { createStructuredTradePlan } from "../app/lib/structured-trade-planner.ts";

function liveSnapshot(): MarketSnapshot {
  return {
    status: "LIVE",
    source: "fixture",
    asOf: new Date().toISOString(),
    quotes: [
      { symbol: "ES", label: "ES", value: "6325", change: "+0.40%", direction: "up" },
      { symbol: "VIX", label: "VIX", value: "14.2", change: "-3.10%", direction: "down" },
      { symbol: "US2Y", label: "2Y", value: "4.20%", change: "—", direction: "flat" },
      { symbol: "US10Y", label: "10Y", value: "4.40%", change: "—", direction: "flat" },
      { symbol: "DXY", label: "DXY", value: "97.8", change: "-0.20%", direction: "down" },
      { symbol: "OIL", label: "OIL", value: "72.4", change: "+1.10%", direction: "up" },
      { symbol: "QQQ", label: "QQQ", value: "485.2", change: "+0.80%", direction: "up" },
      { symbol: "NQ", label: "NASDAQ", value: "17850", change: "+0.70%", direction: "up" },
    ],
    levels: [],
    events: [],
    bias: "BULLISH",
    risk: "MODERATE",
    summary: "fixture",
    evidence: { trend: 72, momentum: 68, volatility: 30, breadth: 70, macro: 65 },
  };
}

test("directional gauges cover the full market board and fail closed without quotes", () => {
  const snapshot = liveSnapshot();
  const intelligence = analyzeMarketSnapshot(snapshot);
  const decision = createTradingDecision({
    intelligence,
    reasoning: intelligence.reasoning,
    dataStatus: snapshot.status,
    providerStatus: "connected",
    dataAgeMs: 30_000,
    fallbackActive: false,
    missingDataWarnings: intelligence.reasoning.missingDataWarnings,
  });
  const plan = createStructuredTradePlan({
    decision,
    intelligence,
    dataStatus: snapshot.status,
    providerStatus: "connected",
    dataAgeMs: 30_000,
    fallbackActive: false,
    missingDataWarnings: intelligence.reasoning.missingDataWarnings,
  });
  const deskSignals = createMarketDeskSignals({ snapshot, intelligence, decision, plan });
  const gauges = createMarketDirectionalGauges({ snapshot, deskSignals });

  assert.equal(gauges.gauges.length, MARKET_BOARD_SYMBOLS.length);
  assert.deepEqual(gauges.gauges.map((gauge) => gauge.symbol), [...MARKET_BOARD_SYMBOLS]);
  assert.equal(gauges.gauges.find((gauge) => gauge.symbol === "ES")?.direction, "buy");
  assert.equal(gauges.gauges.find((gauge) => gauge.symbol === "VIX")?.direction, "sell");
  assert.equal(gauges.gauges.find((gauge) => gauge.symbol === "US2Y")?.scalarOnly, true);
  assert.equal(gauges.gauges.find((gauge) => gauge.symbol === "US2Y")?.direction, "neutral");
  assert.ok((gauges.gauges.find((gauge) => gauge.symbol === "QQQ")?.confidencePct ?? 0) > 0);
  assert.match(gauges.disclosure, /Interpretive educational/);

  const empty = createMarketDirectionalGauges({
    snapshot: { ...snapshot, status: "UNAVAILABLE", quotes: [] },
  });
  assert.ok(empty.gauges.every((gauge) => gauge.direction === "insufficient" && gauge.confidencePct == null));
});
