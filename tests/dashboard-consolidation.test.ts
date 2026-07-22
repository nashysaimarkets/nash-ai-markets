import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { formatScoreDisplay, scoreIsDisplayable } from "../app/dashboard/lib/score-display.ts";
import { interpretCrossMarket } from "../app/dashboard/lib/cross-market-interpretation.ts";
import { buildMarketBrief } from "../app/lib/market-brief.ts";
import { analyzeMarketSnapshot } from "../app/lib/market-intelligence-engine.ts";
import { createUnavailableSnapshot, type MarketSnapshot } from "../app/lib/market-data.ts";
import { createTradingDecision } from "../app/lib/trading-decision-engine.ts";
import { createStructuredTradePlan } from "../app/lib/structured-trade-planner.ts";

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("score display never presents zero as a substitute for unavailable evidence", () => {
  assert.equal(formatScoreDisplay(0, false), "Not calculated");
  assert.equal(formatScoreDisplay(null, true), "Not calculated");
  assert.equal(formatScoreDisplay(72, true), "72 / 100");
  assert.equal(scoreIsDisplayable(0, false), false);
  assert.equal(scoreIsDisplayable(0, true), true);
});

test("cross-market interpretation is plain English and marks mixed evidence", () => {
  const snapshot = {
    status: "DELAYED",
    asOf: new Date().toISOString(),
    quotes: [
      { symbol: "ES", label: "ES", value: "7545.75", change: "-0.12%", direction: "down" },
      { symbol: "VIX", label: "VIX", value: "14.20", change: "-2.10%", direction: "down" },
      { symbol: "US2Y", label: "2Y", value: "3.90%", change: "0.00%", direction: "flat" },
      { symbol: "US10Y", label: "10Y", value: "4.20%", change: "0.00%", direction: "flat" },
      { symbol: "DXY", label: "DXY", value: "104.10", change: "+0.05%", direction: "up" },
    ],
    levels: [],
    events: [],
    evidence: {},
    source: "test",
    risk: "MED",
    bias: "neutral",
    summary: "test",
  } as unknown as MarketSnapshot;
  const copy = interpretCrossMarket(snapshot);
  assert.match(copy, /VIX is lower/i);
  assert.match(copy, /mixed|supportive|restrictive|balanced/i);
  assert.doesNotMatch(copy, /guarantee|will rise|buy|sell/i);
});

test("consolidated dashboard removes overlapping command sections and keeps four major blocks", async () => {
  const page = await read("../app/dashboard/page.tsx");
  assert.match(page, /MissionControl/);
  assert.match(page, /persistAnalysisSnapshot/);
  assert.match(page, /missionControlPage/);
  assert.doesNotMatch(page, /BullseyeMissionControl|TodaysBullseyePlan|TradeSetupOfTheDay|TodaysEdge|MorningBriefPanel|EliteScenarioCard|MarketStructureVisual|executiveKpiStrip|memberAccessMap|Classification Record/);
  assert.doesNotMatch(page, /BULLSEYE Command Centre/);
});

test("market brief omits unsupported probability percentages and withholds unavailable scores", () => {
  const unavailable = createUnavailableSnapshot();
  const intelligence = analyzeMarketSnapshot(unavailable);
  const decision = createTradingDecision({
    intelligence,
    reasoning: intelligence.reasoning,
    dataStatus: unavailable.status,
    providerStatus: "offline",
    dataAgeMs: null,
    fallbackActive: false,
    missingDataWarnings: intelligence.reasoning.missingDataWarnings,
  });
  const plan = createStructuredTradePlan({
    decision,
    intelligence,
    dataStatus: unavailable.status,
    providerStatus: "offline",
    dataAgeMs: null,
    fallbackActive: false,
    missingDataWarnings: intelligence.reasoning.missingDataWarnings,
  });
  const brief = buildMarketBrief(unavailable, intelligence, decision, plan);
  assert.equal(brief.confidence, null);
  assert.equal(brief.scenarios.length, 0);
  assert.doesNotMatch(brief.summary, /\d+%/);
  assert.match(brief.whatHappened, /unavailable|Cross-market/i);
});

test("market plan component uses truthful reference-level wording", async () => {
  const source = await read("../app/dashboard/components/DashboardMarketPlan.tsx");
  assert.match(source, /Verified rolling range and reference levels/);
  assert.match(source, /not labelled exchange support/);
  assert.match(source, /Bullish confirmation/);
  assert.match(source, /Bearish confirmation/);
  assert.match(source, /No-trade/);
  assert.match(source, /formatScoreDisplay/);
});

test("terminal scenarios do not advertise unsupported probability percentages", async () => {
  const terminal = await read("../app/terminal/components/CustomerTerminal.tsx");
  assert.doesNotMatch(terminal, /probability}% alignment/);
  assert.match(terminal, /formatScoreDisplay/);
  assert.match(terminal, /Verified rolling range and reference levels/);
});
