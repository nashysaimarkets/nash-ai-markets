import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { analyzeMarketSnapshot } from "../app/lib/market-intelligence-engine.ts";
import { buildMarketBrief } from "../app/lib/market-brief.ts";
import type { MarketSnapshot } from "../app/lib/market-data.ts";
import { createUnavailableSnapshot } from "../app/lib/market-data.ts";
import { createStructuredTradePlan } from "../app/lib/structured-trade-planner.ts";
import { createTradingDecision } from "../app/lib/trading-decision-engine.ts";
import { buildDecisionDesk } from "../app/dashboard/lib/decision-desk.ts";
import { interpretCrossMarket } from "../app/dashboard/lib/cross-market-interpretation.ts";
import {
  composeMorningMarketBrief,
  customerFacingBriefCopy,
  dedupePracticalItems,
} from "../app/brief/lib/compose-market-brief.ts";
import { readSessionClock } from "../app/terminal/lib/session-clock.ts";

const snapshot: MarketSnapshot = {
  status: "LIVE",
  source: "Verified provider",
  asOf: "2026-07-28T11:59:00.000Z",
  quotes: [
    { symbol: "ES", label: "ES", value: "6300", change: "+1", direction: "up" },
    { symbol: "VIX", label: "VIX", value: "16", change: "-1", direction: "down" },
    { symbol: "US2Y", label: "2Y", value: "4.1%", change: "-1", direction: "down" },
    { symbol: "US10Y", label: "10Y", value: "4.3%", change: "-1", direction: "down" },
    { symbol: "DXY", label: "DXY", value: "98", change: "-1", direction: "down" },
  ],
  levels: [
    { label: "R1", value: "6320", note: "verified", type: "resistance" },
    { label: "S1", value: "6280", note: "verified", type: "support" },
  ],
  events: [
    { time: "2099-07-28T13:30:00.000Z", name: "US CPI", risk: "HIGH" },
    { time: "2099-07-28T15:00:00.000Z", name: "Consumer sentiment", risk: "MED" },
  ],
  bias: "BULLISH",
  risk: "MODERATE",
  summary: "verified",
  evidence: { trend: 78, momentum: 74, volatility: 30, breadth: 70, macro: 66 },
};

function engines(current: MarketSnapshot = snapshot) {
  const intelligence = analyzeMarketSnapshot(current);
  const providerStatus = current.status === "UNAVAILABLE" ? "offline" : "connected";
  const decision = createTradingDecision({
    intelligence,
    reasoning: intelligence.reasoning,
    dataStatus: current.status,
    providerStatus,
    dataAgeMs: current.status === "UNAVAILABLE" ? null : 60_000,
    fallbackActive: current.status === "UNAVAILABLE",
    missingDataWarnings: intelligence.reasoning.missingDataWarnings,
  });
  const plan = createStructuredTradePlan({
    decision,
    intelligence,
    dataStatus: current.status,
    providerStatus,
    dataAgeMs: current.status === "UNAVAILABLE" ? null : 60_000,
    fallbackActive: current.status === "UNAVAILABLE",
    missingDataWarnings: intelligence.reasoning.missingDataWarnings,
  });
  return { intelligence, decision, plan };
}

function compose(current: MarketSnapshot = snapshot) {
  const { intelligence, decision, plan } = engines(current);
  const brief = buildMarketBrief(current, intelligence, decision, plan);
  const verified = current.status !== "UNAVAILABLE" && intelligence.actionable;
  const desk = buildDecisionDesk({
    verified,
    decision,
    plan,
    intelligence,
    session: readSessionClock(new Date("2026-07-28T15:00:00Z")),
    candles: null,
    expectedMoveLabel: "18 pts (verified 48-bar range)",
    support: "6280",
    resistance: "6320",
  });
  return composeMorningMarketBrief({
    brief,
    desk,
    intelligence,
    decision,
    plan,
    snapshot: current,
    sessionLevels: null,
    support: "6280",
    resistance: "6320",
    expectedMoveLabel: "18 pts (verified 48-bar range)",
    asOfLabel: "28 Jul 2026, 12:59",
    dataAgeLabel: "Delayed market data · latest verified candle 14 minutes old",
    sessionLabel: "US cash open",
    sessionDetail: "Regular hours",
    tierLabel: "ELITE",
    greeting: "Good afternoon, Nash",
    verified,
    now: Date.parse("2026-07-28T12:00:00.000Z"),
  });
}

test("composeMorningMarketBrief answers the morning questions from verified inputs", () => {
  const model = compose();
  assert.match(model.executiveSummary, /ES is higher|volatility is easing|dollar is softer/i);
  assert.match(model.posture.eyebrow, /TODAY.?S POSTURE/i);
  assert.match(model.posture.summary, /lean|patient|caution|restricted|selective/i);
  assert.match(model.summary.setupReading, /lean|setup|confirmation|restricted|caution|selective/i);
  assert.doesNotMatch(model.summary.setupReading, /\d+%\s*engine weight/i);
  assert.ok(model.summary.watch.length >= 1);
  assert.ok(model.summary.avoid.length >= 1);
  assert.ok(model.summary.watch.length <= 4);
  assert.ok(model.summary.avoid.length <= 4);
  assert.equal(model.crossAssets.some((card) => card.id === "ES"), true);
  assert.equal(model.crossAssets.some((card) => card.label === "Breadth"), false);
  assert.ok(model.economicTimeline.length >= 1);
  // Optional video/news/breadth gaps no longer force a permanent coverage strip.
  assert.equal(model.serviceStatus.some((item) => /breadth/i.test(item.label)), false);
  assert.equal(
    model.serviceStatusSummary == null || !/some optional indicators are currently unavailable/i.test(model.serviceStatusSummary),
    true,
  );
});

test("composeMorningMarketBrief fails closed without verified decision inputs", () => {
  const unavailable = createUnavailableSnapshot();
  const model = compose(unavailable);
  assert.equal(model.verified, false);
  assert.match(model.summary.setupReading, /incomplete|not established|withheld|unavailable/i);
  assert.doesNotMatch(model.summary.setupReading, /\d+%\s*engine weight/i);
  assert.equal(model.crossAssets.some((card) => card.label === "Breadth"), false);
});

test("false Breadth presentation never shows engine sentiment as breadth", () => {
  const model = compose();
  const labels = model.crossAssets.map((card) => card.label);
  assert.equal(labels.includes("Breadth"), false);
  assert.equal(model.crossAssets.every((card) => !/breadth/i.test(card.label)), true);
  assert.doesNotMatch(JSON.stringify(model.serviceStatus), /breadth/i);
  assert.doesNotMatch(JSON.stringify(model.crossAssets), /Engine sentiment score only/);
});

test("editorial cross-market copy avoids while-chains and inventing news", () => {
  const constructive = interpretCrossMarket(snapshot);
  assert.match(constructive, /ES is higher/i);
  assert.match(constructive, /volatility is easing|dollar is softer/i);
  assert.doesNotMatch(constructive, /, while .+, while /i);
  assert.doesNotMatch(constructive, /because|due to|after the|fed|cpi caused/i);

  const restrictiveSnap = {
    ...snapshot,
    quotes: snapshot.quotes.map((quote) => ({
      ...quote,
      direction: quote.symbol === "ES" || quote.symbol === "VIX" || quote.symbol === "DXY"
        ? ("up" as const)
        : quote.direction,
      change: "+1",
    })),
  };
  // Force restrictive: ES down, VIX up, DXY up
  restrictiveSnap.quotes = [
    { symbol: "ES", label: "ES", value: "6300", change: "-1", direction: "down" },
    { symbol: "VIX", label: "VIX", value: "18", change: "+1", direction: "up" },
    { symbol: "US10Y", label: "10Y", value: "4.3%", change: "0", direction: "flat" },
    { symbol: "DXY", label: "DXY", value: "99", change: "+1", direction: "up" },
  ];
  const restrictive = interpretCrossMarket(restrictiveSnap);
  assert.match(restrictive, /restrictive|rising|firmer|lower/i);
  assert.doesNotMatch(restrictive, /, while .+, while /i);

  const mixedSnap: MarketSnapshot = {
    ...snapshot,
    quotes: [
      { symbol: "ES", label: "ES", value: "6300", change: "+1", direction: "up" },
      { symbol: "VIX", label: "VIX", value: "18", change: "+1", direction: "up" },
      { symbol: "DXY", label: "DXY", value: "98", change: "-1", direction: "down" },
    ],
  };
  const mixed = interpretCrossMarket(mixedSnap);
  assert.match(mixed, /mixed|incomplete/i);

  const empty = interpretCrossMarket({ ...snapshot, quotes: [] });
  assert.match(empty, /unavailable/i);
});

test("Watch/Avoid bullets stay unique and practical", () => {
  const deduped = dedupePracticalItems([
    "Critical input missing",
    "Confirmation data is incomplete",
    "Low confidence",
    "Missing evidence",
    "Volatility pressure",
    "Range location",
  ], 3);
  assert.equal(deduped.length, 3);
  assert.equal(deduped.filter((item) => /critical input|missing evidence|confirmation data/i.test(item)).length <= 1, true);

  const model = compose();
  const keys = new Set(model.summary.avoid.map((item) => item.toLowerCase()));
  assert.equal(keys.size, model.summary.avoid.length);
  assert.doesNotMatch(model.summary.avoid.join(" | "), /critical input missing.*critical input missing/i);
});

test("restricted setup reading never reads like a trade recommendation", () => {
  const model = compose();
  assert.doesNotMatch(model.summary.setupReading, /buy now|sell now|enter long|enter short|place order/i);
  if (/restricted|incomplete|not establish/i.test(model.summary.setupReading + model.playbook.posture)) {
    assert.doesNotMatch(model.summary.setupReading, /\d+%\s*engine weight favours/i);
  }
});

test("unavailable catalyst returns compact empty timeline", () => {
  const noEvents = { ...snapshot, events: [] };
  const model = compose(noEvents);
  assert.equal(model.economicTimeline.length, 0);
  assert.match(model.serviceStatus.map((item) => item.detail).join(" "), /No upcoming verified event/i);
});

test("Morning Brief page and component preserve auth and delayed-data honesty", async () => {
  const [page, css, component, composeSource, pulseSource, toolsSource] = await Promise.all([
    readFile(new URL("../app/brief/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/market-brief.css", import.meta.url), "utf8"),
    readFile(new URL("../app/brief/components/MorningMarketBrief.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/brief/lib/compose-market-brief.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/brief/components/BullseyePulse.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/brief/components/BriefExperienceTools.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(page, /redirect\("\/login"\)/);
  assert.match(page, /robots: \{ index: false, follow: false \}/);
  assert.match(page, /composeMorningMarketBrief/);
  assert.match(page, /formatDelayedVerifiedCandleAgeDisplay/);
  assert.match(component, /Executive market summary|executiveSummary/);
  assert.match(component, /todays-posture|Wait for confirmation|Stay patient|model\.posture/);
  assert.match(component, /Open Trading Desk/);
  assert.match(component, /Market weather/);
  assert.match(component, /Breadth is omitted|advance\/decline/);
  assert.match(component, /No upcoming verified event is currently available/);
  assert.match(component, /Risk &amp; Journal|Risk & Journal/);
  assert.match(component, /Technical engine detail/);
  assert.match(component, /Morning Brief sections|Briefing route/);
  assert.match(component, /mbIntelligenceDrawer|Deep evidence/);
  assert.match(component, /#todays-posture|#what-changed|#verified-levels|#watch-avoid|#next-actions/);
  assert.doesNotMatch(component, /Highest-probability behaviour|engine weight favours/);
  assert.doesNotMatch(component, /label === "Breadth"|BREADTH/);
  assert.match(component, /model\.briefHeadline|pre-market briefing|session update|post-market review/);
  assert.match(component, /BullseyePulse/);
  assert.match(pulseSource, /Bullseye pulse|Focus mode|mbHeartbeat|OF 5 LAYERS/);
  assert.match(pulseSource, /Market weather|Session storyline|mbSessionStory/);
  assert.match(toolsSource, /Download mission card|Command centre|localStorage|Preparation state/);
  assert.match(css, /\.morningMarketBrief\{/);
  assert.match(css, /mbCatalystEmpty|mbServiceStatus|mbActionGrid/);
  assert.match(css, /\.mbBriefRoute/);
  assert.match(css, /mbRadarSweep|mbIntelligenceDrawer|mbPulseRadar|mbHeartbeat|mbFocusDeck/);
  assert.match(css, /\.mbBriefRoute\{\s*position:relative/);
  assert.match(css, /align-items:\s*start/);
  assert.match(composeSource, /dedupePracticalItems/);
  assert.match(composeSource, /customerFacingBriefCopy/);
  assert.match(composeSource, /buildTodaysPosture|serviceStatusSummary/);
  assert.doesNotMatch(composeSource, /id: "BREADTH"/);
  assert.doesNotMatch(composeSource, /some optional indicators are currently unavailable/);
});

test("customer-facing Brief copy softens internal no-trade terminology", () => {
  assert.match(
    customerFacingBriefCopy("Bullseye is maintaining a no-trade posture until conditions clear."),
    /Trade participation remains restricted/i,
  );
  assert.doesNotMatch(
    customerFacingBriefCopy("Bullseye is maintaining a no-trade posture until conditions clear."),
    /Bullseye is maintaining a no-trade posture/i,
  );
  const model = compose();
  assert.doesNotMatch(model.executiveSummary, /while confirmation remains incomplete/i);
  assert.doesNotMatch(`${model.summary.headline} ${model.biggestRisk.label}`, /Bullseye is maintaining a no-trade posture/i);
});
