import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { analyzeMarketSnapshot } from "../app/lib/market-intelligence-engine.ts";
import { createUnavailableSnapshot, type MarketSnapshot } from "../app/lib/market-data.ts";
import { createTradingDecision } from "../app/lib/trading-decision-engine.ts";
import { createStructuredTradePlan } from "../app/lib/structured-trade-planner.ts";
import { readSessionClock } from "../app/terminal/lib/session-clock.ts";
import {
  buildDecisionDesk,
  confidenceBandFromScore,
  formatConfidenceBandLabel,
} from "../app/dashboard/lib/decision-desk.ts";
import { formatDeskConfidenceDisplay } from "../app/dashboard/lib/score-display.ts";

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("confidence bands prefer Moderate Confidence over raw N/100", () => {
  assert.equal(confidenceBandFromScore(34, true), "Low");
  assert.equal(formatConfidenceBandLabel(34, true), "Low Confidence");
  assert.equal(formatConfidenceBandLabel(55, true), "Moderate Confidence");
  assert.equal(formatDeskConfidenceDisplay(55, true), "Moderate Confidence");
  assert.equal(formatDeskConfidenceDisplay(null, false), "Confidence awaiting verified inputs");
});

test("Decision Desk fails closed without inventing setups or internal codes", () => {
  const snapshot = createUnavailableSnapshot();
  const intelligence = analyzeMarketSnapshot(snapshot);
  const decision = createTradingDecision({
    intelligence,
    reasoning: intelligence.reasoning,
    dataStatus: snapshot.status,
    providerStatus: "offline",
    dataAgeMs: null,
    fallbackActive: false,
    missingDataWarnings: intelligence.reasoning.missingDataWarnings,
  });
  const plan = createStructuredTradePlan({
    decision,
    intelligence,
    dataStatus: snapshot.status,
    providerStatus: "offline",
    dataAgeMs: null,
    fallbackActive: false,
    missingDataWarnings: intelligence.reasoning.missingDataWarnings,
  });
  const desk = buildDecisionDesk({
    verified: false,
    decision,
    plan,
    intelligence,
    session: readSessionClock(new Date("2026-07-28T15:00:00Z")),
    candles: null,
    expectedMoveLabel: "Unavailable without verified range inputs",
    support: null,
    resistance: null,
  });

  assert.equal(desk.opportunity.available, false);
  assert.match(desk.opportunity.headline, /No verified high-probability setup/i);
  assert.doesNotMatch(desk.tradeThesis, /CRITICAL_INPUT_MISSING|NULL|Undefined/);
  assert.doesNotMatch(desk.expectedMove.label, /\bUnavailable\b/);
  assert.equal(desk.confidence.band, "Awaiting inputs");
  assert.match(desk.confidence.factors.at(-1)!.detail, /Verified market data|Verified quotes|incomplete|needed|unavailable/i);
});

test("Decision Desk uses verified bias and structure when actionable", () => {
  const snapshot = {
    status: "DELAYED",
    asOf: new Date().toISOString(),
    quotes: [
      { symbol: "ES", label: "ES", value: "6400.00", change: "+0.40%", direction: "up" },
      { symbol: "VIX", label: "VIX", value: "13.20", change: "-2.10%", direction: "down" },
      { symbol: "US2Y", label: "2Y", value: "3.90%", change: "0.00%", direction: "flat" },
      { symbol: "US10Y", label: "10Y", value: "4.20%", change: "0.00%", direction: "flat" },
      { symbol: "DXY", label: "DXY", value: "104.10", change: "+0.05%", direction: "up" },
    ],
    levels: [
      { kind: "support", label: "Support", value: "6380.00", source: "test" },
      { kind: "resistance", label: "Resistance", value: "6420.00", source: "test" },
    ],
    events: [],
    evidence: { trend: 72, volatility: 40, breadth: 61 },
    source: "test",
    risk: "MED",
    bias: "bullish",
    summary: "test",
  } as unknown as MarketSnapshot;

  const intelligence = analyzeMarketSnapshot(snapshot);
  const decision = createTradingDecision({
    intelligence,
    reasoning: intelligence.reasoning,
    dataStatus: snapshot.status,
    providerStatus: "connected",
    dataAgeMs: 5 * 60 * 1000,
    fallbackActive: false,
    missingDataWarnings: intelligence.reasoning.missingDataWarnings,
  });
  const plan = createStructuredTradePlan({
    decision,
    intelligence,
    dataStatus: snapshot.status,
    providerStatus: "connected",
    dataAgeMs: 5 * 60 * 1000,
    fallbackActive: false,
    missingDataWarnings: intelligence.reasoning.missingDataWarnings,
  });

  const now = Math.floor(Date.now() / 1000);
  const candles = Array.from({ length: 40 }, (_, index) => {
    const base = 6380 + index * 0.8;
    return {
      time: now - (40 - index) * 300,
      open: base,
      high: base + 4,
      low: base - 2,
      close: base + 1.5,
      volume: 1000 + index,
    };
  });

  const desk = buildDecisionDesk({
    verified: intelligence.actionable,
    decision,
    plan,
    intelligence,
    session: readSessionClock(new Date()),
    candles,
    expectedMoveLabel: "32 pts (verified 48-bar range)",
    support: "6380.00",
    resistance: "6420.00",
  });

  assert.match(desk.tradeThesis, /bullish|neutral|bearish|Stand aside/i);
  assert.doesNotMatch(JSON.stringify(desk), /CRITICAL_INPUT_MISSING|\bNULL\b|Undefined/);
  assert.ok(desk.marketStructure.label.length > 0);
  assert.ok(desk.sessionStatus.label.length > 0);
});

test("Decision Desk ships under Market Command Centre without auth/chart edits", async () => {
  const [page, centre, deskUi, deskLib, outlook] = await Promise.all([
    read("../app/dashboard/page.tsx"),
    read("../app/dashboard/components/MarketCommandCentre.tsx"),
    read("../app/dashboard/components/DecisionDesk.tsx"),
    read("../app/dashboard/lib/decision-desk.ts"),
    read("../app/dashboard/components/AiMarketOutlook.tsx"),
  ]);
  assert.match(page, /buildDecisionDesk/);
  assert.match(page, /formatDeskConfidenceDisplay/);
  assert.match(centre, /DecisionDesk/);
  assert.match(centre, /decisionDesk/);
  assert.match(deskUi, /Decision Desk|Market diagnosis/);
  assert.match(deskLib, /No verified high-probability setup currently available/);
  assert.doesNotMatch(deskUi, /BEST OPPORTUNITY/);
  assert.match(outlook, /Not yet confirmed from verified feeds/);
  assert.match(outlook, /Bullish, Bearish/);
  assert.match(page, /supabase\.auth\.getUser/);
  assert.match(centre, /HeroMarketChartLazy/);
  assert.match(centre, /MarketIntelligenceStrip/);
});
