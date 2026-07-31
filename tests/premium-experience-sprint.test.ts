import assert from "node:assert/strict";
import test from "node:test";
import { buildTodaysGamePlan } from "../app/dashboard/lib/todays-game-plan.ts";
import { buildCommandStrip } from "../app/dashboard/lib/command-strip.ts";
import { delightCardForDay } from "../app/dashboard/lib/delight-card.ts";
import { buildSessionReplay } from "../app/lib/oracle/session-replay.ts";
import { DEFAULT_DASHBOARD_WORKSPACE, ESSENTIAL_DASHBOARD_SECTIONS } from "../app/lib/oracle/dashboard-workspace.ts";
import type { DeskDecisionPresentation } from "../app/terminal/lib/desk-decision-presentation.ts";
import type { MarketSnapshot } from "../app/lib/market-data.ts";
import type { TradingDecision } from "../app/lib/trading-decision-engine.ts";

const decision: DeskDecisionPresentation = {
  leanLabel: "Neutral",
  leanTone: "neutral",
  permissionLabel: "WAIT FOR CONFIRMATION",
  permissionTone: "blocked",
  confidenceLabel: "NOT ESTABLISHED",
  confidenceDetail: "Awaiting evidence",
  confidenceScore: null,
  riskLabel: "Elevated",
  why: "Incomplete confirmation",
  supporting: [],
  opposing: [],
  primaryRisk: "Confirmation evidence is incomplete",
  analysisAvailable: true,
};

test("Today’s Game Plan never invents a trade of the day", () => {
  const plan = buildTodaysGamePlan({
    decision,
    plan: null,
    levels: [
      { label: "24-hour low / downside reference", value: "5000.00" },
      { label: "24-hour high / upside reference", value: "5100.00" },
    ],
    candleSeries: null,
    sessionLabel: "PRE-MARKET",
  });
  assert.equal(plan.tradeOfTheDay, null);
  assert.match(plan.tradeOfTheDayNote, /No guaranteed/i);
  assert.equal(plan.expectedMove, null);
  assert.match(plan.disclosure, /Educational/);
});

test("Command strip keeps breadth/put-call/tick/SPY empty without inventing values", () => {
  const strip = buildCommandStrip({
    hero: {
      symbolLabel: "ES",
      price: "5050.00",
      netChange: "+1.25",
      percentChange: "+0.02%",
      direction: "up",
      sessionLabel: "PRE-MARKET",
      sessionDetail: "Preparing",
      delayedAgeLine: "Delayed · 15 min",
      priceSourceLabel: "Verified quote",
      rangePositionPct: 55,
      rangeLow: "5000",
      rangeHigh: "5100",
      rangeNote: null,
      deskHref: "/terminal",
    },
    decision,
    weather: [
      {
        id: "VIX",
        name: "VIX",
        value: "16.2",
        change: "-0.3",
        direction: "down",
        interpretation: "VIX lower",
        available: true,
      },
    ],
    session: {
      phase: "premarket",
      label: "Pre-market",
      detail: "Preparing",
      countdownLabel: "Opens in 01:20",
      countdownMs: 4800000,
      nowEt: "07:00 ET",
      nextEventLabel: "Cash open",
      source: "clock",
    },
    quotes: [],
    expectedMove: null,
  });
  const emptyIds = ["breadth", "pc", "tick", "SPY", "GOLD", "BTC"];
  for (const id of emptyIds) {
    const cell = strip.cells.find((item) => item.id === id);
    assert.ok(cell);
    assert.equal(cell!.available, false);
    assert.equal(cell!.value, "—");
  }
  assert.equal(strip.cells.find((item) => item.id === "ES")?.available, true);
});

test("Session replay withholds forecast accuracy without inventing scores", () => {
  const snapshot = {
    quotes: [],
    events: [],
    levels: [],
    status: "DELAYED",
  } as unknown as MarketSnapshot;
  const replay = buildSessionReplay({
    snapshot,
    decision: { tradePermission: "restricted" } as TradingDecision,
    presentation: decision,
    candles: null,
    verified: false,
  });
  assert.equal(replay.forecastAccuracy, null);
  assert.match(replay.rollingAccuracyNote, /not estimated/i);
  assert.equal(replay.available, false);
});

test("Delight card is stable for a New York trading day", () => {
  const a = delightCardForDay(Date.parse("2026-07-31T14:00:00.000Z"));
  const b = delightCardForDay(Date.parse("2026-07-31T20:00:00.000Z"));
  assert.equal(a.id, b.id);
  assert.ok(a.title.length > 3);
});

test("Default workspace includes Game Plan in the morning workflow and essentials", () => {
  assert.ok(DEFAULT_DASHBOARD_WORKSPACE.order.includes("game-plan"));
  assert.ok(DEFAULT_DASHBOARD_WORKSPACE.order.includes("video-centre"));
  assert.ok(DEFAULT_DASHBOARD_WORKSPACE.order.indexOf("weather") < DEFAULT_DASHBOARD_WORKSPACE.order.indexOf("game-plan"));
  assert.ok(ESSENTIAL_DASHBOARD_SECTIONS.includes("game-plan"));
  assert.equal(DEFAULT_DASHBOARD_WORKSPACE.density, "comfortable");
});
