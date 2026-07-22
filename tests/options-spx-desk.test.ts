import assert from "node:assert/strict";
import test from "node:test";
import { normalizeEconomicCalendar } from "../app/lib/providers/fmp-economic-calendar.ts";
import { normalizeStockNews } from "../app/lib/providers/fmp-market-news.ts";
import { buildOptionsFramework } from "../app/lib/options-framework.ts";
import { analyzeMarketSnapshot } from "../app/lib/market-intelligence-engine.ts";
import { createTradingDecision } from "../app/lib/trading-decision-engine.ts";
import { createStructuredTradePlan } from "../app/lib/structured-trade-planner.ts";
import type { MarketSnapshot } from "../app/lib/market-data.ts";

const now = Date.parse("2026-07-22T12:00:00.000Z");

test("economic calendar keeps only US medium/high impact events", () => {
  const events = normalizeEconomicCalendar([
    { date: "2026-07-23 13:30:00", country: "US", event: "Initial Jobless Claims", impact: "High" },
    { date: "2026-07-24 15:00:00", country: "US", event: "Existing Home Sales", impact: "Medium" },
    { date: "2026-07-23 09:00:00", country: "EU", event: "ECB Speech", impact: "High" },
    { date: "2026-07-23 13:30:00", country: "US", event: "Minor Print", impact: "Low" },
  ], now);
  assert.equal(events.length, 2);
  assert.equal(events[0]?.risk, "HIGH");
  assert.match(events[0]?.name ?? "", /Jobless/);
  assert.equal(events[1]?.risk, "MED");
});

test("stock news normalizer rejects non-https and incomplete headlines", () => {
  const headlines = normalizeStockNews([
    {
      title: "S&P 500 futures steady ahead of data",
      url: "https://example.com/a",
      publishedDate: "2026-07-22 10:00:00",
      site: "Example Wire",
      symbol: "SPY",
    },
    {
      title: "Bad link",
      url: "http://insecure.example/a",
      publishedDate: "2026-07-22 10:00:00",
      site: "Example",
    },
    { title: "Missing url", publishedDate: "2026-07-22 10:00:00" },
  ]);
  assert.equal(headlines.length, 1);
  assert.equal(headlines[0]?.symbols[0], "SPY");
});

test("options framework surfaces confirmation paths from intelligence", () => {
  const snapshot: MarketSnapshot = {
    status: "DELAYED",
    source: "test",
    asOf: "2026-07-22T11:50:00.000Z",
    quotes: [
      { symbol: "ES", label: "ES", value: "6350.25", change: "+0.4%", direction: "up" },
      { symbol: "VIX", label: "VIX", value: "16.2", change: "-2%", direction: "down" },
    ],
    levels: [],
    events: [{ time: "Thu 23 Jul, 13:30", name: "Initial Jobless Claims", risk: "HIGH" }],
    bias: "BULLISH",
    risk: "MODERATE",
    summary: "fixture",
    evidence: { trend: 70, momentum: 66, volatility: 40, breadth: 62, macro: 58 },
  };
  const intelligence = analyzeMarketSnapshot(snapshot);
  const decision = createTradingDecision({
    intelligence,
    reasoning: intelligence.reasoning,
    dataStatus: snapshot.status,
    providerStatus: "connected",
    dataAgeMs: 10 * 60_000,
    fallbackActive: false,
    missingDataWarnings: [],
  });
  const plan = createStructuredTradePlan({
    decision,
    intelligence,
    dataStatus: snapshot.status,
    providerStatus: "connected",
    dataAgeMs: 10 * 60_000,
    fallbackActive: false,
    missingDataWarnings: [],
  });
  const framework = buildOptionsFramework({
    snapshot,
    decision,
    plan,
    decisionReady: true,
    intelligence,
  });
  assert.equal(framework.ideas.length, 3);
  assert.match(framework.eventRisk, /verified US catalyst/);
  assert.ok(framework.bullishConfirm.length > 8);
  assert.ok(framework.ideas.every((idea) => idea.evidenceQuality === "framework-only"));
});
