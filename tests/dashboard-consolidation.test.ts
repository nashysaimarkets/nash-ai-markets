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

test("hero chart and intelligence strip ship delayed-data badges", async () => {
  const [hero, strip, centre] = await Promise.all([
    read("../app/dashboard/components/HeroMarketChart.tsx"),
    read("../app/dashboard/components/MarketIntelligenceStrip.tsx"),
    read("../app/dashboard/components/MarketCommandCentre.tsx"),
  ]);
  assert.match(hero, /Market Data: Delayed \(\~10 minutes\)/);
  assert.match(hero, /EMA 9|EMA 200|VWAP|PDH|ONH/);
  assert.match(strip, /Awaiting coverage/);
  assert.match(centre, /HeroMarketChartLazy/);
  assert.match(centre, /MarketIntelligenceStrip/);
  assert.match(centre, /DecisionDesk/);
});

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

test("Market Command Centre restores Elite dashboard workspace", async () => {
  const page = await read("../app/dashboard/page.tsx");
  assert.match(page, /MarketCommandCentre/);
  assert.match(page, /resolveMembershipTier/);
  assert.match(page, /Market Data: Delayed/);
  assert.doesNotMatch(page, /redirect\("\/terminal"\)/);
  assert.doesNotMatch(page, /MissionControl|persistAnalysisSnapshot/);
  assert.doesNotMatch(page, /BullseyeMissionControl|TodaysBullseyePlan|TradeSetupOfTheDay|TodaysEdge|MorningBriefPanel|EliteScenarioCard|MarketStructureVisual|executiveKpiStrip|memberAccessMap|Classification Record/);
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

test("support and resistance copy stays truthful on directional gauges", async () => {
  const source = await read("../app/terminal/components/CustomerTerminal.tsx");
  assert.match(source, /Desk support/);
  assert.match(source, /Insufficient data/);
  assert.doesNotMatch(source, /probability}% alignment/);
  assert.doesNotMatch(source, /TodaysMarketPlan|formatScoreDisplay|Verified rolling range and reference levels/);
});

test("terminal scenarios do not advertise unsupported probability percentages", async () => {
  const terminal = await read("../app/terminal/components/CustomerTerminal.tsx");
  assert.doesNotMatch(terminal, /probability}% alignment/);
  assert.doesNotMatch(terminal, /Verified rolling range and reference levels/);
});
