import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { analyzeMarketSnapshot } from "../app/lib/market-intelligence-engine.ts";
import type { MarketSnapshot } from "../app/lib/market-data.ts";
import { createStructuredTradePlan } from "../app/lib/structured-trade-planner.ts";
import { createTradingDecision } from "../app/lib/trading-decision-engine.ts";
import { buildDailyMission, formatEventCountdown, memberDisplayName, selectNextEconomicEvent } from "../app/dashboard/lib/daily-dashboard.ts";
import { summarizeVerifiedOutcomes, type VerifiedOutcome } from "../app/dashboard/lib/performance-history.ts";
import { commandCentreState, marketSessionState, primaryLevel } from "../app/dashboard/lib/command-centre.ts";

const NOW = Date.parse("2026-07-17T12:00:00.000Z");

function snapshot(overrides: Partial<MarketSnapshot> = {}): MarketSnapshot {
  return {
    status: "LIVE", source: "Verified provider", asOf: "2026-07-17T11:59:00.000Z",
    quotes: [
      { symbol: "ES", label: "ES", value: "6300", change: "+1", direction: "up" },
      { symbol: "VIX", label: "VIX", value: "16", change: "-1", direction: "down" },
      { symbol: "US2Y", label: "2Y", value: "4.1%", change: "-1", direction: "down" },
      { symbol: "US10Y", label: "10Y", value: "4.3%", change: "-1", direction: "down" },
      { symbol: "DXY", label: "DXY", value: "98", change: "-1", direction: "down" },
    ],
    levels: [{ label: "R1", value: "6320", note: "verified", type: "resistance" }, { label: "S1", value: "6280", note: "verified", type: "support" }],
    events: [], bias: "BULLISH", risk: "MODERATE", summary: "verified",
    evidence: { trend: 78, momentum: 74, volatility: 30, breadth: 70, macro: 66 },
    ...overrides,
  };
}

function mission(current = snapshot()) {
  const intelligence = analyzeMarketSnapshot(current);
  const decision = createTradingDecision({ intelligence, reasoning: intelligence.reasoning, dataStatus: current.status, providerStatus: current.status === "UNAVAILABLE" ? "offline" : "connected", dataAgeMs: current.status === "UNAVAILABLE" ? null : 60_000, fallbackActive: current.status === "UNAVAILABLE", missingDataWarnings: intelligence.reasoning.missingDataWarnings });
  const plan = createStructuredTradePlan({ decision, intelligence, dataStatus: current.status, providerStatus: current.status === "UNAVAILABLE" ? "offline" : "connected", dataAgeMs: current.status === "UNAVAILABLE" ? null : 60_000, fallbackActive: current.status === "UNAVAILABLE", missingDataWarnings: intelligence.reasoning.missingDataWarnings });
  return buildDailyMission(current, intelligence, decision, plan);
}

test("Today’s Mission uses synchronized verified engine output", () => {
  const result = mission();
  assert.equal(result.available, true);
  assert.ok(result.confidence !== null && result.confidence > 0);
  assert.match(result.marketCondition, /scenario/);
  assert.notEqual(result.directionalBias, "Neutral / stand aside");
  assert.ok(result.nextAction.length > 0);
});

test("Today’s Mission fails closed when current market data is unavailable", () => {
  const result = mission(snapshot({ status: "UNAVAILABLE", quotes: [], levels: [], evidence: {}, asOf: "1970-01-01T00:00:00.000Z" }));
  assert.deepEqual(result, {
    available: false,
    marketCondition: "Verified market condition unavailable",
    confidence: null,
    directionalBias: "Neutral / stand aside",
    keyWarning: "Current provider data is outside the decision window. No directional output is active.",
    nextAction: "Wait for a verified provider update, then refresh the dashboard.",
  });
});

test("Today’s Mission stays decision-ready for fresh live inputs even when optional evidence is incomplete", () => {
  const result = mission(snapshot({
    quotes: [{ symbol: "ES", label: "ES", value: "6300", change: "+1", direction: "up" }],
    levels: [],
    evidence: {},
  }));
  assert.equal(result.available, true);
  assert.notEqual(result.confidence, null);
});

test("event countdown rounds up and formats minutes, hours and days", () => {
  assert.equal(formatEventCountdown("2026-07-17T12:00:01.000Z", NOW), "1m");
  assert.equal(formatEventCountdown("2026-07-17T14:05:00.000Z", NOW), "2h 5m");
  assert.equal(formatEventCountdown("2026-07-19T15:00:00.000Z", NOW), "2d 3h");
  assert.equal(formatEventCountdown("2026-07-17T11:59:00.000Z", NOW), null);
});

test("next event selects only the nearest future event with a complete timestamp", () => {
  const result = selectNextEconomicEvent([
    { time: "13:30 UK", name: "Incomplete time", risk: "HIGH" },
    { time: "2026-07-17T15:00:00.000Z", name: "Later event", risk: "MED" },
    { time: "2026-07-17T13:00:00.000Z", name: "Next event", risk: "HIGH" },
  ], NOW);
  assert.equal(result?.name, "Next event");
  assert.equal(result?.countdown, "1h 0m");
});

test("event area returns unavailable rather than inventing an event", () => {
  assert.equal(selectNextEconomicEvent([], NOW), null);
  assert.equal(selectNextEconomicEvent([{ time: "13:30 UK", name: "No date", risk: "HIGH" }], NOW), null);
});

test("command centre classifies live, delayed, stale, unavailable and partial inputs", () => {
  const gateway = { providerName: "Verified provider", connectionStatus: "connected" as const, lastSuccessfulUpdate: null, lastAttemptAt: null, dataAgeMs: 60_000, refreshLatencyMs: null, fallbackActive: false, reconnectAttempts: 0, lastFailureCategory: null, responseReceived: true, schemaRecognized: true, quoteCount: 5, requiredInstrumentsFound: ["ES", "VIX", "US2Y", "US10Y", "DXY"], requiredInstrumentsMissing: [], providerTimestamp: null, lastResultCategory: "success" as const, lastFailureReason: null };
  assert.equal(commandCentreState(snapshot(), gateway, "London session"), "live");
  assert.equal(commandCentreState(snapshot({ status: "DELAYED" }), gateway, "London session"), "delayed");
  assert.equal(commandCentreState(snapshot(), { ...gateway, dataAgeMs: 31 * 60_000 }, "London session"), "stale");
  assert.equal(commandCentreState(snapshot({ status: "UNAVAILABLE" }), { ...gateway, connectionStatus: "offline" }, "London session"), "unavailable");
  assert.equal(commandCentreState(snapshot({ quotes: snapshot().quotes.slice(0, 2) }), gateway, "London session"), "partial");
});

test("session and primary levels use only deterministic time and supplied levels", () => {
  assert.equal(marketSessionState(Date.parse("2026-07-20T09:00:00Z")).label, "London session");
  assert.equal(marketSessionState(Date.parse("2026-07-19T09:00:00Z")).label, "Weekend closed");
  assert.equal(primaryLevel(snapshot(), "support")?.value, "6280");
  assert.equal(primaryLevel(snapshot({ levels: [] }), "support"), null);
});

test("member welcome prefers verified profile name and safely falls back to email", () => {
  assert.equal(memberDisplayName("nash.user@example.com", { full_name: "Nash User" }), "Nash User");
  assert.equal(memberDisplayName("nash.user@example.com", {}), "Nash User");
  assert.equal(memberDisplayName("x@example.com", { full_name: " ".repeat(4) }), "X");
});

function outcome(index: number, match = true): VerifiedOutcome {
  const predicted = index % 2 ? "bullish" : "bearish";
  return { predicted_bias: predicted, actual_bias: match ? predicted : "neutral", snapshot_as_of: `2026-06-${String(index + 1).padStart(2, "0")}T20:00:00.000Z`, verified_at: `2026-06-${String(index + 1).padStart(2, "0")}T21:00:00.000Z`, verification_source: "Verified close" };
}

test("accuracy remains hidden with insufficient verified history", () => {
  assert.deepEqual(summarizeVerifiedOutcomes([outcome(0), outcome(1)]), { status: "insufficient", sampleSize: 2, required: 20 });
});

test("accuracy uses only valid verified stored outcomes", () => {
  const outcomes = Array.from({ length: 20 }, (_, index) => outcome(index, index < 15));
  const result = summarizeVerifiedOutcomes(outcomes);
  assert.equal(result.status, "verified");
  if (result.status === "verified") {
    assert.equal(result.sampleSize, 20);
    assert.equal(result.correct, 15);
    assert.equal(result.accuracyPercent, 75);
  }
});

test("invalid or unverified outcome rows never count toward accuracy", () => {
  const invalid = { ...outcome(0), verification_source: "" };
  assert.deepEqual(summarizeVerifiedOutcomes([invalid]), { status: "insufficient", sampleSize: 0, required: 20 });
});

test("dashboard keeps locked premium output out of conditional server rendering", async () => {
  const source = await readFile(new URL("../app/dashboard/page.tsx", import.meta.url), "utf8");
  assert.match(source, /MarketCommandCentre/);
  assert.match(source, /resolveMembershipTier/);
  assert.doesNotMatch(source, /fake countdown|limited time|hurry/i);
});

test("dashboard includes recoverable loading and error states", async () => {
  const [loading, error] = await Promise.all([
    readFile(new URL("../app/dashboard/loading.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/error.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(loading, /aria-busy="true"/);
  assert.match(error, /No market mission, event countdown, or performance result has been inferred/);
  assert.match(error, /onClick=\{reset\}/);
});

test("verified outcome migration is server-only and rejects synthetic rows by schema", async () => {
  const migration = await readFile(new URL("../supabase/migrations/202607170002_verified_outcomes.sql", import.meta.url), "utf8");
  assert.match(migration, /enable row level security/);
  assert.doesNotMatch(migration, /create policy/i);
  assert.match(migration, /verification_source text not null/);
  assert.match(migration, /unique \(snapshot_as_of, horizon\)/);
});
