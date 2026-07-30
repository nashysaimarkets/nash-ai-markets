import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createUnavailableSnapshot, type MarketSnapshot } from "../app/lib/market-data.ts";
import { analyzeMarketSnapshot } from "../app/lib/market-intelligence-engine.ts";
import { createTradingDecision } from "../app/lib/trading-decision-engine.ts";
import { createStructuredTradePlan } from "../app/lib/structured-trade-planner.ts";
import {
  buildAiMarketInsight,
  buildBullBearMeter,
  buildMarketInternals,
} from "../app/lib/ai-market-insight.ts";

const snapshot: MarketSnapshot = {
  status: "LIVE",
  source: "Verified provider",
  asOf: "2026-07-30T12:00:00.000Z",
  quotes: [
    { symbol: "ES", label: "ES", value: "6400", change: "+12", direction: "up" },
    { symbol: "VIX", label: "VIX", value: "14.2", change: "-0.4", direction: "down" },
    { symbol: "US2Y", label: "2Y", value: "4.1%", change: "-0.02", direction: "down" },
    { symbol: "US10Y", label: "10Y", value: "4.25%", change: "-0.03", direction: "down" },
    { symbol: "DXY", label: "DXY", value: "104.1", change: "-0.2", direction: "down" },
  ],
  levels: [
    { label: "R1", value: "6420", note: "verified", type: "resistance" },
    { label: "S1", value: "6380", note: "verified", type: "support" },
  ],
  events: [
    { time: "Thu 13:30", name: "Employment Cost Index QoQ", risk: "MED", at: "2026-07-31T12:30:00.000Z" },
  ],
  bias: "BULLISH",
  risk: "MODERATE",
  summary: "verified",
  evidence: { trend: 72, momentum: 68, volatility: 34, breadth: 70, macro: 64 },
};

function insightFor(snap: MarketSnapshot, verified = true) {
  const intelligence = analyzeMarketSnapshot(snap);
  const decision = createTradingDecision({
    intelligence,
    reasoning: intelligence.reasoning,
    dataStatus: snap.status,
    providerStatus: "connected",
    dataAgeMs: 60_000,
    fallbackActive: false,
    missingDataWarnings: intelligence.reasoning.missingDataWarnings,
  });
  const plan = createStructuredTradePlan({
    decision,
    intelligence,
    dataStatus: snap.status,
    providerStatus: "connected",
    dataAgeMs: 60_000,
    fallbackActive: false,
    missingDataWarnings: intelligence.reasoning.missingDataWarnings,
  });
  return buildAiMarketInsight({
    snapshot: snap,
    intelligence,
    decision,
    plan,
    verified: verified && intelligence.actionable,
    now: Date.parse("2026-07-30T12:00:00.000Z"),
  });
}

test("AI Market Insight produces a concise educational narrative without certainty claims", () => {
  const model = insightFor(snapshot);
  assert.equal(model.title, "AI Market Insight");
  assert.ok(model.wordCount >= 40);
  assert.ok(model.wordCount <= 160);
  assert.match(model.narrative, /ES is higher|volatility is easing|dollar is softer/i);
  assert.match(model.narrative, /watch|opportunity|danger|conditional|incomplete|verification/i);
  assert.doesNotMatch(model.narrative, /\bwill rise\b|\bguaranteed\b|\bbuy now\b|\bsell now\b/i);
  assert.match(model.disclosure, /not personalised advice|not a prediction/i);
});

test("Bull vs Bear meter uses scenario weights and explains factors", () => {
  const intelligence = analyzeMarketSnapshot(snapshot);
  const meter = buildBullBearMeter(intelligence, true);
  assert.equal(meter.available, true);
  assert.ok(meter.bullish.probability + meter.neutral.probability + meter.bearish.probability > 0);
  assert.ok(meter.bullish.factors.length >= 1);
  assert.match(meter.disclosure, /not calibrated win probabilities/i);
});

test("Market Internals stay unavailable without inventing breadth put-call or TRIN", () => {
  const cards = buildMarketInternals();
  assert.equal(cards.length, 3);
  assert.deepEqual(
    cards.map((card) => card.id),
    ["breadth", "put-call", "trin"],
  );
  assert.ok(cards.every((card) => card.available === false && card.status === "Unavailable"));
  assert.match(cards[0]!.detail, /advance\/decline/i);
});

test("fail-closed insight withholds opportunity when unverified", () => {
  const model = insightFor(createUnavailableSnapshot(), false);
  assert.equal(model.available, false);
  assert.equal(model.opportunity, null);
  assert.equal(model.bullBear.available, false);
  assert.equal(model.confidence.band, "Awaiting inputs");
});

test("Dashboard and Brief mount the companion insight surfaces", async () => {
  const [dashboard, brief, centre, morning] = await Promise.all([
    readFile(new URL("../app/dashboard/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/brief/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/components/MarketCommandCentre.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/brief/components/MorningMarketBrief.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(dashboard, /buildAiMarketInsight/);
  assert.match(brief, /buildAiMarketInsight/);
  assert.match(centre, /AiMarketInsightCard|MarketInternalsPanel|DashboardCandlestickChart/);
  assert.match(morning, /AiMarketInsightCard|MarketInternalsPanel/);
  assert.match(centre, /compact/);
});
