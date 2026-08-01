import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { formatScoreDisplay, scoreIsDisplayable } from "../app/dashboard/lib/score-display.ts";
import { interpretCrossMarket } from "../app/dashboard/lib/cross-market-interpretation.ts";
import {
  buildDashboardCommandSummary,
  buildDashboardLevels,
  buildDashboardWeather,
} from "../app/dashboard/lib/dashboard-command-summary.ts";
import { buildMarketBrief } from "../app/lib/market-brief.ts";
import { analyzeMarketSnapshot } from "../app/lib/market-intelligence-engine.ts";
import { createUnavailableSnapshot, type MarketSnapshot } from "../app/lib/market-data.ts";
import { createTradingDecision } from "../app/lib/trading-decision-engine.ts";
import { createStructuredTradePlan } from "../app/lib/structured-trade-planner.ts";
import { readSessionClock } from "../app/terminal/lib/session-clock.ts";

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("dashboard command centre uses shared delayed candle age and Wait for confirmation / Not established language", async () => {
  const [centre, page, summaryLib, freshnessLib] = await Promise.all([
    read("../app/dashboard/components/MarketCommandCentre.tsx"),
    read("../app/dashboard/page.tsx"),
    read("../app/dashboard/lib/dashboard-command-summary.ts"),
    read("../app/lib/freshness-labels.ts"),
  ]);
  assert.match(centre, /Open Trading Desk/);
  assert.match(centre, /Open Morning Brief/);
  assert.match(centre, /Risk &amp; Journal|Risk & Journal/);
  assert.match(centre, /VERIFIED LEVELS/);
  assert.match(centre, /levels\.map|level\.label/);
  // The delayed-data disclosure is owned by the shared freshness formatter and
  // surfaced by the hero, so it is pinned at its source rather than as literal
  // markup the presentation layer is free to relabel.
  assert.match(freshnessLib, /Delayed market data · latest verified candle/);
  assert.match(centre, /hero\.delayedAgeLine/);
  assert.match(centre, /Data freshness/);
  assert.match(centre, /Breadth, put\/call and tick stay empty|Breadth is omitted/);
  assert.match(centre, /TodaysGamePlanPanel|COMMAND CENTRE/);
  assert.match(centre, /CommandStrip|dashCommandStrip/);
  assert.doesNotMatch(centre, /providerDelayNote|Nominal provider delay/);
  assert.match(page, /buildDashboardCommandSummary/);
  assert.match(page, /MarketCommandCentre/);
  assert.match(page, /getVerifiedMarketContext|sanitizeForClient/);
  assert.match(summaryLib, /formatDelayedVerifiedCandleAgeDisplay/);
  assert.match(summaryLib, /buildDeskDecisionPresentation/);
  assert.match(summaryLib, /24-hour low \/ downside reference/);
  assert.match(summaryLib, /Session opening reference/);
  assert.doesNotMatch(summaryLib, /formatNominalProviderDelayNote|providerDelayNote/);
  assert.doesNotMatch(centre, /Opportunity Radar|Trading Conditions Score|AI MARKET OUTLOOK/);
  assert.doesNotMatch(centre, /HeroMarketChartLazy|MarketIntelligenceStrip|DecisionDesk|MarketWeatherPanel/);
  assert.doesNotMatch(page, /coverage:\s*"live"/);
  assert.doesNotMatch(page, /redirect\("\/terminal"\)/);
});

test("dashboard empty catalyst stays compact and available events still render", async () => {
  const centre = await read("../app/dashboard/components/MarketCommandCentre.tsx");
  // The bespoke empty markup was replaced by the shared unavailable state, which
  // keeps the same truthful message in one consistent, compact shape.
  assert.match(centre, /AwaitingDataNote/);
  assert.match(centre, /No upcoming verified catalyst/);
  assert.match(centre, /No scheduled event has been verified/);
  assert.match(centre, /catalyst \? "dashSplitRow" : "dashLevelsStack"/);
  assert.match(centre, /Event risk ahead/);
  assert.match(centre, /catalyst\.name/);
  assert.doesNotMatch(centre, /No future verified calendar event is currently supplied/);
});

test("blocked decision copy omits defensive briefing clause", async () => {
  const presentation = await read("../app/terminal/lib/desk-decision-presentation.ts");
  assert.match(
    presentation,
    /This is a limited-confidence environment\. Wait for confirmation before treating any lean as a setup\./,
  );
  assert.doesNotMatch(presentation, /not because the whole briefing is unavailable/);
  assert.doesNotMatch(presentation, /permissionLabel: "Restricted"|return \{ label: "Restricted"/);
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
  assert.match(copy, /VIX is lower|volatility is easing/i);
  assert.match(copy, /mixed|supportive|restrictive|balanced/i);
  assert.doesNotMatch(copy, /, while .+, while /i);
  assert.doesNotMatch(copy, /guarantee|will rise|buy|sell/i);
});

test("dashboard weather omits missing quotes and never invents breadth", () => {
  const weather = buildDashboardWeather([
    { symbol: "ES", label: "ES", value: "5400.00", change: "+0.20%", direction: "up" },
    { symbol: "VIX", label: "VIX", value: "14.20", change: "-1.00%", direction: "down" },
  ] as MarketSnapshot["quotes"]);
  assert.equal(weather.find((item) => item.id === "ES")?.available, true);
  assert.equal(weather.find((item) => item.id === "DXY")?.available, false);
  assert.equal(weather.find((item) => item.id === "US10Y")?.available, false);
  assert.doesNotMatch(JSON.stringify(weather), /breadth/i);
});

test("dashboard levels use verified candle references with precise terminology", () => {
  const now = Math.floor(Date.now() / 1000);
  const candles = Array.from({ length: 30 }, (_, index) => ({
    time: now - (29 - index) * 300,
    open: 5400 + index,
    high: 5405 + index,
    low: 5395 + index,
    close: 5401 + index,
    volume: 1000 + index,
  }));
  const { levels, note } = buildDashboardLevels({
    symbol: "ES",
    contract: "ES",
    instrumentName: "E-mini S&P 500",
    exchange: "CME",
    instrumentDetail: "test",
    timeframe: "5m",
    classification: "delayed",
    dataAgeMs: 14 * 60_000,
    provider: "Financial Modeling Prep",
    status: "delayed",
    asOf: new Date().toISOString(),
    candles,
    failureCategory: null,
  });
  assert.ok(levels.some((item) => item.label === "24-hour low / downside reference"));
  assert.ok(levels.some((item) => item.label === "Range midpoint"));
  assert.ok(levels.some((item) => item.label === "Session opening reference"));
  assert.ok(levels.some((item) => item.label === "24-hour high / upside reference"));
  assert.match(note ?? "", /not confirmed support or resistance/i);
});

test("dashboard summary fails closed without inventing catalyst or live labels", () => {
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
  const summary = buildDashboardCommandSummary({
    snapshot,
    session: readSessionClock(new Date("2026-07-29T15:00:00Z")),
    candleSeries: null,
    decision,
    plan,
    signals: null,
    warnings: ["Confirmation data is incomplete"],
    now: Date.parse("2026-07-29T15:00:00Z"),
  });
  assert.equal(summary.catalyst, null);
  assert.equal(summary.levels.length, 0);
  assert.match(summary.hero.delayedAgeLine, /Delayed market data/i);
  assert.doesNotMatch(summary.hero.delayedAgeLine, /\blive\b/i);
  assert.equal(summary.decision.permissionLabel, "WAIT FOR CONFIRMATION");
  assert.ok(summary.unavailable.length > 0);
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
