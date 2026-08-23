import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { analyzeMarketSnapshot } from "../app/lib/market-intelligence-engine.ts";
import { createUnavailableSnapshot, type MarketSnapshot } from "../app/lib/market-data.ts";
import { createTradingDecision } from "../app/lib/trading-decision-engine.ts";
import { createStructuredTradePlan } from "../app/lib/structured-trade-planner.ts";
import { buildThirtySecondBrief } from "../app/lib/oracle/thirty-second-brief.ts";
import { buildSessionTimeline } from "../app/lib/oracle/session-timeline.ts";
import { buildConvictionExplainer } from "../app/lib/oracle/conviction-explainer.ts";
import {
  buildConfidenceChange,
  clearStoredConfidenceSnapshot,
  readStoredConfidenceSnapshot,
  writeStoredConfidenceSnapshot,
} from "../app/lib/oracle/confidence-change.ts";
import {
  buildDailyChecklist,
  coachingNoteFor,
  readDailyChecklist,
  resetDailyChecklist,
  writeDailyChecklist,
} from "../app/lib/oracle/daily-checklist.ts";
import {
  DEFAULT_DASHBOARD_WORKSPACE,
  readDashboardWorkspace,
  resetDashboardWorkspace,
  writeDashboardWorkspace,
} from "../app/lib/oracle/dashboard-workspace.ts";
import { buildEducationalOpportunityRadar } from "../app/lib/oracle/opportunity-conditions.ts";
import { buildSessionReplay } from "../app/lib/oracle/session-replay.ts";
import { buildDecisionDesk } from "../app/dashboard/lib/decision-desk.ts";
import { buildDeskDecisionPresentation } from "../app/terminal/lib/desk-decision-presentation.ts";
import { readSessionClock } from "../app/terminal/lib/session-clock.ts";
import { CONCEPT_EXPLAINERS } from "../app/lib/oracle/concept-explainers.ts";

const snapshot: MarketSnapshot = {
  status: "LIVE",
  source: "Verified provider",
  asOf: "2026-07-30T12:00:00.000Z",
  quotes: [
    { symbol: "ES", label: "ES", value: "6400", change: "+12", direction: "up" },
    { symbol: "VIX", label: "VIX", value: "14.2", change: "-0.4", direction: "down" },
    { symbol: "US10Y", label: "10Y", value: "4.25%", change: "-0.03", direction: "down" },
    { symbol: "DXY", label: "DXY", value: "104.1", change: "-0.2", direction: "down" },
  ],
  levels: [
    { label: "R1", value: "6420", note: "verified", type: "resistance" },
    { label: "S1", value: "6380", note: "verified", type: "support" },
  ],
  events: [{ time: "Thu 13:30", name: "Employment Cost Index QoQ", risk: "MED", at: "2026-07-31T12:30:00.000Z" }],
  bias: "BULLISH",
  risk: "MODERATE",
  summary: "verified",
  evidence: { trend: 72, momentum: 68, volatility: 34, breadth: 70, macro: 64 },
};

function engines(current: MarketSnapshot = snapshot) {
  const intelligence = analyzeMarketSnapshot(current);
  const decision = createTradingDecision({
    intelligence,
    reasoning: intelligence.reasoning,
    dataStatus: current.status,
    providerStatus: "connected",
    dataAgeMs: 60_000,
    fallbackActive: false,
    missingDataWarnings: intelligence.reasoning.missingDataWarnings,
  });
  const plan = createStructuredTradePlan({
    decision,
    intelligence,
    dataStatus: current.status,
    providerStatus: "connected",
    dataAgeMs: 60_000,
    fallbackActive: false,
    missingDataWarnings: intelligence.reasoning.missingDataWarnings,
  });
  return { intelligence, decision, plan };
}

function memoryStorage(seed: Record<string, string> = {}) {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => { map.set(key, value); },
    removeItem: (key: string) => { map.delete(key); },
  };
}

test("thirty-second brief fails closed when unverified", () => {
  const { decision, plan } = engines(createUnavailableSnapshot());
  const model = buildThirtySecondBrief({
    snapshot: createUnavailableSnapshot(),
    decision,
    plan,
    verified: false,
    freshnessLabel: "Delayed market data · age unavailable",
  });
  assert.equal(model.available, false);
  assert.match(model.posture, /patient/i);
  assert.doesNotMatch(model.avoid, /\bbuy\b|\bsell\b/i);
});

test("thirty-second brief uses verified catalyst and supporting factor", () => {
  const { decision, plan } = engines();
  const model = buildThirtySecondBrief({
    snapshot,
    decision,
    plan,
    verified: true,
    freshnessLabel: "Delayed market data · 12m ago",
    now: Date.parse("2026-07-30T12:00:00.000Z"),
  });
  assert.equal(model.available, true);
  assert.match(model.supportingFactor, /ES|volatility|dollar/i);
  assert.match(model.nextCatalyst, /Employment Cost Index/i);
});

test("session timeline highlights a single active stage", () => {
  const model = buildSessionTimeline(new Date("2026-07-30T18:00:00.000Z"));
  assert.equal(model.stages.filter((stage) => stage.active).length, 1);
  assert.ok(model.focus.length > 20);
  assert.match(model.disclosure, /not auto-detected|educational/i);
});

test("conviction explainer keeps breadth unavailable and explains verified factors", () => {
  const { intelligence, decision } = engines();
  const model = buildConvictionExplainer({
    snapshot,
    intelligence,
    decision,
    verified: true,
    now: Date.parse("2026-07-30T12:00:00.000Z"),
  });
  const breadth = model.factors.find((item) => item.id === "breadth");
  assert.equal(breadth?.relation, "unavailable");
  assert.ok(model.factors.some((item) => item.id === "volatility" && item.dataStatus === "Verified delayed"));
  assert.match(model.methodology, /not calibrated win probabilities/i);
});

test("confidence change handles first visit, valid compare and corrupted storage", () => {
  const storage = memoryStorage();
  assert.equal(readStoredConfidenceSnapshot(storage), null);
  const first = buildConfidenceChange({
    previous: null,
    current: {
      score: 55,
      band: "Medium",
      posture: "Stay patient",
      lean: "Mild bullish lean",
      factorIds: ["trend"],
      freshness: "12m",
    },
  });
  assert.equal(first.comparable, false);
  writeStoredConfidenceSnapshot(first.current, storage);
  const second = buildConfidenceChange({
    previous: readStoredConfidenceSnapshot(storage),
    current: {
      score: 70,
      band: "High",
      posture: "Selective",
      lean: "Bullish lean",
      factorIds: ["trend", "volatility"],
      freshness: "8m",
    },
  });
  assert.equal(second.comparable, true);
  assert.equal(second.direction, "up");
  assert.deepEqual(second.added, ["volatility"]);
  storage.setItem("nash-oracle-confidence-v1", "{bad");
  assert.equal(readStoredConfidenceSnapshot(storage), null);
  clearStoredConfidenceSnapshot(storage);
});

test("checklist daily reset and coaching notes stay non-promotional", () => {
  const storage = memoryStorage();
  const state = readDailyChecklist(storage, new Date("2026-07-30T15:00:00.000Z"));
  state.items.thesis = true;
  writeDailyChecklist(state, storage);
  const model = buildDailyChecklist(state, {
    postureHeadline: "Stay patient",
    permissionTone: "caution",
    hasUpcomingEvent: true,
  }, new Date("2026-07-30T15:00:00.000Z"));
  assert.match(model.coachingNote, /event risk|protect capital|incomplete/i);
  assert.doesNotMatch(coachingNoteFor({
    postureHeadline: "Selective",
    permissionTone: "open",
    hasUpcomingEvent: false,
    completedPrep: 8,
  }), /trade more|guaranteed profit/i);
  const reset = resetDailyChecklist(storage, new Date("2026-07-30T15:00:00.000Z"));
  assert.equal(Object.values(reset.items).every((value) => value === false), true);
});

test("dashboard workspace recovers from corrupted prefs without hiding essentials", () => {
  const storage = memoryStorage({ "nash-oracle-dashboard-workspace-v1": "{nope" });
  const prefs = readDashboardWorkspace(storage);
  assert.deepEqual(prefs.order.slice(0, 3), DEFAULT_DASHBOARD_WORKSPACE.order.slice(0, 3));
  assert.ok(prefs.pinned.includes("thirty-second"));
  writeDashboardWorkspace(prefs, storage);
  assert.equal(resetDashboardWorkspace(storage).favouriteMarketId, "es");
});

test("opportunity radar fails closed without inventing buy or sell commands", () => {
  const { intelligence, decision, plan } = engines(createUnavailableSnapshot());
  const desk = buildDecisionDesk({
    verified: false,
    decision,
    plan,
    intelligence,
    session: readSessionClock(new Date("2026-07-30T15:00:00.000Z")),
    candles: null,
    expectedMoveLabel: "Unavailable",
    support: null,
    resistance: null,
  });
  const model = buildEducationalOpportunityRadar({
    snapshot: createUnavailableSnapshot(),
    intelligence,
    decision,
    plan,
    desk,
    verified: false,
    freshness: "Unavailable",
  });
  assert.ok(model.cards.every((card) => !/\bbuy\b|\bsell\b|\benter\b/i.test(`${card.category} ${card.supporting.join(" ")}`)));
  assert.ok(model.cards.some((card) => /insufficient|no-trade/i.test(card.category)));
});

test("session replay foundation stays factual when candles missing", () => {
  const { decision } = engines();
  const presentation = buildDeskDecisionPresentation({ decision, plan: engines().plan, signals: null, warnings: [] });
  const model = buildSessionReplay({
    snapshot,
    decision,
    presentation,
    candles: null,
    verified: true,
  });
  assert.equal(model.available, false);
  assert.match(model.primaryActionLabel, /Review today’s session/i);
});

test("concept explainers cover required market vocabulary", () => {
  for (const id of ["vix", "dxy", "trin", "tick", "gamma", "dealer", "delayed-data"] as const) {
    assert.ok(CONCEPT_EXPLAINERS[id].summary.length > 10);
  }
});

test("focus mode preference persists locally and exits with Escape", async () => {
  const [desk, css, workspace] = await Promise.all([
    readFile(new URL("../app/terminal/components/TradingDeskOS.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/oracle/oracle.css", import.meta.url), "utf8"),
    readFile(new URL("../app/terminal/lib/desk-workspace.ts", import.meta.url), "utf8"),
  ]);
  assert.match(desk, /Exit Focus Mode/);
  assert.match(desk, /event\.key === "Escape"/);
  assert.match(desk, /deskFocusStrip/);
  assert.match(desk, /Open trading checklist/);
  assert.match(css, /\.tradingDeskOS\.is-oracle-focus/);
  assert.match(workspace, /focusMode/);
});
