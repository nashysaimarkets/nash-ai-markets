import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { analyzeMarketSnapshot } from "../app/lib/market-intelligence-engine.ts";
import { buildMarketBrief } from "../app/lib/market-brief.ts";
import type { MarketSnapshot } from "../app/lib/market-data.ts";
import { createStructuredTradePlan } from "../app/lib/structured-trade-planner.ts";
import { createTradingDecision } from "../app/lib/trading-decision-engine.ts";
import { buildDecisionDesk } from "../app/dashboard/lib/decision-desk.ts";
import { composeMorningMarketBrief } from "../app/brief/lib/compose-market-brief.ts";
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
    { time: "13:30", name: "US CPI", risk: "HIGH" },
    { time: "15:00", name: "Consumer sentiment", risk: "MED" },
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

test("composeMorningMarketBrief answers the six morning questions from verified inputs", () => {
  const { intelligence, decision, plan } = engines();
  const brief = buildMarketBrief(snapshot, intelligence, decision, plan);
  const desk = buildDecisionDesk({
    verified: true,
    decision,
    plan,
    intelligence,
    session: readSessionClock(new Date("2026-07-28T15:00:00Z")),
    candles: null,
    expectedMoveLabel: "18 pts (verified 48-bar range)",
    support: "6280",
    resistance: "6320",
  });
  const model = composeMorningMarketBrief({
    brief,
    desk,
    intelligence,
    decision,
    plan,
    snapshot,
    sessionLevels: {
      previousDayHigh: 6310,
      previousDayLow: 6270,
      overnightHigh: 6305,
      overnightLow: 6288,
      todaysOpen: 6295,
      source: "Derived from verified OHLCV",
    },
    support: "6280",
    resistance: "6320",
    expectedMoveLabel: "18 pts (verified 48-bar range)",
    asOfLabel: "28 Jul 12:59 UK",
    dataAgeLabel: "2m old",
    sessionLabel: "US cash open",
    sessionDetail: "Regular session",
    tierLabel: "ELITE",
    greeting: "Good morning",
    verified: true,
    youtubeId: null,
  });

  assert.equal(model.schemaVersion, "1.0");
  assert.equal(model.verified, true);
  assert.ok(model.summary.overnight.length > 20);
  assert.ok(model.summary.whatMatters.length > 10);
  assert.ok(model.summary.watch.length >= 1);
  assert.ok(model.summary.avoid.length >= 1);
  assert.match(model.summary.highestProbability, /%|favours|stance/i);
  assert.equal(model.crossAssets.find((card) => card.id === "VIX")?.available, true);
  assert.equal(model.crossAssets.find((card) => card.id === "DXY")?.available, true);
  assert.equal(model.crossAssets.find((card) => card.id === "US10Y")?.available, true);
  assert.match(model.crossAssets.find((card) => card.id === "BREADTH")?.detail ?? "", /not|engine|breadth/i);
  assert.ok(model.levels.rungs.some((rung) => rung.label === "Key support"));
  assert.ok(model.levels.rungs.some((rung) => rung.label === "Overnight high"));
  assert.equal(model.economicTimeline[0]?.name, "US CPI");
  assert.equal(model.overnightNews.available, false);
  assert.match(model.overnightNews.reason, /not connected|verified/i);
  assert.equal(model.video.available, false);
  assert.match(model.video.reason, /not linked|verified/i);
  assert.ok(model.playbook.steps.length >= 1);
  assert.ok(model.biggestRisk.label.length > 0);
});

test("composeMorningMarketBrief fails closed without verified decision inputs", () => {
  const unavailable: MarketSnapshot = {
    ...snapshot,
    status: "UNAVAILABLE",
    asOf: "1970-01-01T00:00:00.000Z",
    quotes: [],
    levels: [],
    events: [],
    evidence: {},
  };
  const { intelligence, decision, plan } = engines(unavailable);
  const brief = buildMarketBrief(unavailable, intelligence, decision, plan);
  const desk = buildDecisionDesk({
    verified: false,
    decision,
    plan,
    intelligence,
    session: readSessionClock(new Date("2026-07-28T11:00:00Z")),
    candles: null,
    expectedMoveLabel: "Expected move awaits a verified candle range",
    support: null,
    resistance: null,
  });
  const model = composeMorningMarketBrief({
    brief,
    desk,
    intelligence,
    decision,
    plan,
    snapshot: unavailable,
    sessionLevels: null,
    support: null,
    resistance: null,
    expectedMoveLabel: "Expected move awaits a verified candle range",
    asOfLabel: "Timestamp unavailable",
    dataAgeLabel: "Age unavailable",
    sessionLabel: "Pre-market",
    sessionDetail: "Awaiting open",
    tierLabel: "PRO",
    greeting: "Good morning",
    verified: false,
  });

  assert.equal(model.verified, false);
  assert.equal(model.aiBriefing.confidence, null);
  assert.match(model.summary.highestProbability, /withheld|await/i);
  assert.equal(model.crossAssets.every((card) => card.id === "BREADTH" || !card.available), true);
  assert.equal(model.levels.rungs.length, 0);
  assert.equal(model.economicTimeline[0]?.available, false);
  assert.equal(model.video.available, false);
});

test("Market Brief page renders the premium brief instead of redirecting to terminal", async () => {
  const [page, css, component, compose] = await Promise.all([
    readFile(new URL("../app/brief/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/market-brief.css", import.meta.url), "utf8"),
    readFile(new URL("../app/brief/components/MorningMarketBrief.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/brief/lib/compose-market-brief.ts", import.meta.url), "utf8"),
  ]);
  assert.match(page, /redirect\("\/login"\)/);
  assert.match(page, /robots: \{ index: false, follow: false \}/);
  assert.match(page, /createProgressiveAccess/);
  assert.match(page, /buildMarketBrief/);
  assert.match(page, /composeMorningMarketBrief/);
  assert.match(page, /MorningMarketBrief/);
  assert.match(page, /MemberShell active="brief"/);
  assert.doesNotMatch(page, /redirect\("\/terminal"\)/);
  assert.doesNotMatch(page, /LockedPremiumCard|CrossAssetCandleGallery/);
  assert.match(component, /What happened overnight/);
  assert.match(component, /What matters today/);
  assert.match(component, /Highest-probability behaviour/);
  assert.match(component, /Support \/ resistance ladder/);
  assert.match(component, /Today’s playbook/);
  assert.match(component, /Today’s biggest risk/);
  assert.match(component, /Daily market video/);
  assert.match(css, /\.morningMarketBrief\{/);
  assert.match(css, /@media\(max-width:720px\)/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(compose, /No verified breadth provider|not connected/);
  assert.match(compose, /Overnight news headlines are not connected/);
});
