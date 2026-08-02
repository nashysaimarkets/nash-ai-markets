/**
 * The Morning Brief assembles data inside a try/catch, but React renders the
 * presentation components *after* the page function returns, so a render-phase
 * throw escapes that catch and blanks the whole route with the generic
 * "The brief could not finish loading." boundary.
 *
 * Economic-calendar rows come from an external provider and are not
 * schema-guaranteed per row, so these tests render the brief against row shapes
 * the provider can legitimately emit.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { MorningMarketBrief } from "../../app/brief/components/MorningMarketBrief.tsx";
import { composeMorningMarketBrief } from "../../app/brief/lib/compose-market-brief.ts";
import { buildMarketBrief } from "../../app/lib/market-brief.ts";
import { buildAiMarketInsight } from "../../app/lib/ai-market-insight.ts";
import { buildOracleBundle } from "../../app/lib/oracle/build-oracle-bundle.ts";
import type { MarketSnapshot } from "../../app/lib/market-data.ts";
import { analyzeMarketSnapshot } from "../../app/lib/market-intelligence-engine.ts";
import { createTradingDecision } from "../../app/lib/trading-decision-engine.ts";
import { createStructuredTradePlan } from "../../app/lib/structured-trade-planner.ts";
import { readSessionClock } from "../../app/terminal/lib/session-clock.ts";
import { buildDecisionDesk } from "../../app/dashboard/lib/decision-desk.ts";
import { resolveSessionMarketVideos } from "../../app/lib/market-video/session-placement.ts";
import { sanitizeForClient } from "../../app/lib/serialize-for-client.ts";

const NOW = Date.parse("2026-07-31T12:00:00.000Z");

function snapshotWithEvents(events: MarketSnapshot["events"]): MarketSnapshot {
  return {
    status: "LIVE",
    source: "Verified provider",
    asOf: "2026-07-31T11:59:00.000Z",
    quotes: [
      { symbol: "ES", label: "ES", value: "6300", change: "+12.25", direction: "up" },
      { symbol: "VIX", label: "VIX", value: "16.2", change: "-0.8", direction: "down" },
      { symbol: "US2Y", label: "2Y", value: "4.1%", change: "-0.02", direction: "down" },
      { symbol: "US10Y", label: "10Y", value: "4.3%", change: "-0.01", direction: "down" },
      { symbol: "DXY", label: "DXY", value: "98.4", change: "-0.21", direction: "down" },
    ],
    levels: [
      { label: "R1", value: "6320", note: "verified", type: "resistance" },
      { label: "S1", value: "6280", note: "verified", type: "support" },
    ],
    events,
    bias: "BULLISH",
    risk: "MODERATE",
    summary: "verified",
    evidence: { trend: 78, momentum: 74, volatility: 30, breadth: 70, macro: 66 },
  };
}

function renderBrief(snapshot: MarketSnapshot): string {
  const intelligence = analyzeMarketSnapshot(snapshot);
  const session = readSessionClock(new Date(NOW));
  const shared = {
    intelligence,
    dataStatus: snapshot.status,
    providerStatus: "connected" as const,
    dataAgeMs: 60_000,
    fallbackActive: false,
    missingDataWarnings: intelligence.reasoning.missingDataWarnings,
  };
  const decision = createTradingDecision({ ...shared, reasoning: intelligence.reasoning });
  const plan = createStructuredTradePlan({ ...shared, decision });
  const desk = buildDecisionDesk({
    verified: true,
    decision,
    plan,
    intelligence,
    session,
    candles: null,
    expectedMoveLabel: "18 pts (verified 48-bar range)",
    support: "6280",
    resistance: "6320",
  });
  const sessionVideos = resolveSessionMarketVideos({ phase: session.phase, now: NOW });

  const model = composeMorningMarketBrief({
    brief: buildMarketBrief(snapshot, intelligence, decision, plan, null),
    desk,
    intelligence,
    decision,
    plan,
    snapshot,
    sessionLevels: null,
    support: "6280",
    resistance: "6320",
    expectedMoveLabel: "18 pts (verified 48-bar range)",
    asOfLabel: "31 Jul 2026, 12:59",
    dataAgeLabel: "Delayed market data · latest verified candle 14 minutes old",
    sessionLabel: session.label,
    sessionDetail: session.detail,
    tierLabel: "Elite",
    greeting: "Good afternoon, Nash",
    briefHeadline: "Here is today’s market briefing.",
    verified: true,
    videoSlot: sessionVideos.briefPrimary,
    earlierVideoSlot: sessionVideos.briefEarlier,
    sessionPhase: session.phase,
    now: NOW,
  });

  const props = sanitizeForClient({
    model,
    insight: buildAiMarketInsight({ snapshot, intelligence, decision, plan, verified: true, now: NOW }),
    oracle: buildOracleBundle({
      snapshot,
      intelligence,
      decision,
      plan,
      session,
      verified: true,
      freshnessLabel: "Delayed market data · latest verified candle 14 minutes old",
      candles: null,
      support: "6280",
      resistance: "6320",
      expectedMoveLabel: "18 pts (verified 48-bar range)",
      now: NOW,
    }),
    archiveAvailable: sessionVideos.archive.length > 0,
  });

  return renderToStaticMarkup(createElement(MorningMarketBrief, props as never));
}

test("morning brief renders when a calendar row omits its impact rating", () => {
  const html = renderBrief(
    snapshotWithEvents([
      { time: "2099-07-31T13:30:00.000Z", name: "US CPI" } as never,
      { time: "2099-07-31T15:00:00.000Z", name: "Consumer sentiment", risk: "MED" },
    ]),
  );
  assert.match(html, /Impact not verified/);
  assert.match(html, /MED impact/);
});

test("morning brief renders when a calendar row has a null or unusable impact", () => {
  for (const risk of [null, undefined, 0, {}, "  "]) {
    const html = renderBrief(
      snapshotWithEvents([{ time: "2099-07-31T13:30:00.000Z", name: "US CPI", risk } as never]),
    );
    assert.match(html, /Impact not verified/);
  }
});

test("morning brief renders when a calendar row omits its name", () => {
  const html = renderBrief(
    snapshotWithEvents([
      { time: "2099-07-31T13:30:00.000Z", risk: "HIGH" } as never,
      { time: "2099-07-31T15:00:00.000Z", name: "Consumer sentiment", risk: "MED" },
    ]),
  );
  // Unnamed rows are dropped rather than shown as an anonymous catalyst.
  assert.match(html, /Consumer sentiment/);
  assert.doesNotMatch(html, /HIGH impact/);
});

test("morning brief renders with well-formed and empty calendars", () => {
  const populated = renderBrief(
    snapshotWithEvents([{ time: "2099-07-31T13:30:00.000Z", name: "US CPI", risk: "HIGH" }]),
  );
  assert.match(populated, /HIGH impact/);
  assert.match(populated, /US CPI/);

  const empty = renderBrief(snapshotWithEvents([]));
  assert.match(empty, /No upcoming verified event is currently available/);
});
