import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { buildAnalysisSnapshot, diffSnapshots, METHODOLOGY_VERSION } from "../app/lib/market-analysis-snapshot.ts";
import { buildOptionsFramework } from "../app/lib/options-framework.ts";
import { journalPerformance } from "../app/lib/journal-performance.ts";
import { createUnavailableSnapshot } from "../app/lib/market-data.ts";
import type { MarketGatewayStatus } from "../app/lib/live-market-gateway.ts";
import { analyzeMarketSnapshot } from "../app/lib/market-intelligence-engine.ts";
import { createTradingDecision } from "../app/lib/trading-decision-engine.ts";
import { createStructuredTradePlan } from "../app/lib/structured-trade-planner.ts";

function mockGateway(): MarketGatewayStatus {
  return {
    connectionStatus: "offline",
    providerName: "test",
    lastAttempt: null,
    lastSuccessfulUpdate: null,
    dataAgeMs: 0,
    failureCount: 0,
    fallbackActive: true,
    lastRefreshLatencyMs: null,
    reconnectAttempts: 0,
    lastFailureCategory: null,
    providerAttempt: {
      resultCategory: "failed",
      httpStatusCategory: "not_attempted",
      endpointStatusCategories: {
        sp500Futures: "not_attempted",
        vix: "not_attempted",
        treasuryYields: "not_attempted",
        usDollarIndex: "not_attempted",
      },
      responseReceived: false,
      schemaRecognized: false,
      quoteCount: 0,
      requiredInstrumentsFound: [],
      requiredInstrumentsMissing: ["ES", "VIX", "US2Y", "US10Y", "DXY"],
      providerTimestamp: null,
      failureReason: "test",
    },
    dataClassification: "unavailable",
  };
}

test("analysis snapshots are versioned, hashed and never invent quotes", () => {
  const snapshot = createUnavailableSnapshot();
  const intelligence = analyzeMarketSnapshot(snapshot);
  const gateway = mockGateway();
  const decision = createTradingDecision({
    intelligence,
    reasoning: intelligence.reasoning,
    dataStatus: snapshot.status,
    providerStatus: "offline",
    dataAgeMs: 0,
    fallbackActive: true,
    missingDataWarnings: intelligence.reasoning.missingDataWarnings,
  });
  const plan = createStructuredTradePlan({
    decision,
    intelligence,
    dataStatus: snapshot.status,
    providerStatus: "offline",
    dataAgeMs: 0,
    fallbackActive: true,
    missingDataWarnings: intelligence.reasoning.missingDataWarnings,
  });
  const built = buildAnalysisSnapshot({
    snapshot,
    intelligence,
    decision,
    plan,
    gateway,
    kind: "morning",
    nowIso: "2026-07-22T08:00:00.000Z",
  });
  assert.equal(built.payload.version, METHODOLOGY_VERSION);
  assert.equal(built.payload.market.quotes.length, snapshot.quotes.length);
  assert.equal(built.contentHash.length, 32);
  const again = buildAnalysisSnapshot({
    snapshot,
    intelligence,
    decision,
    plan,
    gateway,
    kind: "morning",
    nowIso: "2026-07-22T08:00:00.000Z",
  });
  assert.equal(built.contentHash, again.contentHash);
  assert.equal(createHash("sha256").update(JSON.stringify(built.payload)).digest("hex").slice(0, 32), built.contentHash);
  const changed = diffSnapshots(null, built.payload);
  assert.equal(changed.hasPrevious, false);
});

test("options framework never fabricates strikes premiums or greeks", () => {
  const snapshot = createUnavailableSnapshot();
  const intelligence = analyzeMarketSnapshot(snapshot);
  const decision = createTradingDecision({
    intelligence,
    reasoning: intelligence.reasoning,
    dataStatus: snapshot.status,
    providerStatus: "offline",
    dataAgeMs: 0,
    fallbackActive: true,
    missingDataWarnings: intelligence.reasoning.missingDataWarnings,
  });
  const plan = createStructuredTradePlan({
    decision,
    intelligence,
    dataStatus: snapshot.status,
    providerStatus: "offline",
    dataAgeMs: 0,
    fallbackActive: true,
    missingDataWarnings: intelligence.reasoning.missingDataWarnings,
  });
  const framework = buildOptionsFramework({ snapshot, decision, plan, decisionReady: false });
  assert.equal(framework.providerState, "unavailable");
  assert.equal(framework.expectedMove, "unavailable");
  assert.equal(framework.label, "Underlying-based framework");
  const blob = JSON.stringify(framework);
  assert.doesNotMatch(blob, /strike price|option premium|delta|gamma|theta|vega|implied volatility curve/i);
  assert.ok(framework.ideas.every((idea) => idea.evidenceQuality === "framework-only"));
  assert.ok(framework.ideas.every((idea) => !/\d{3,}\s*call|\d{3,}\s*put/i.test(idea.strikeSelectionLogic)));
});

test("journal performance withholds percentages until sample size is honest", () => {
  const thin = journalPerformance([
    { pnl: 10, direction: "long", instrument_class: "futures", followed_plan: true, traded_at: "2026-07-01", vix_regime: null, bullseye_score: null },
    { pnl: -5, direction: "short", instrument_class: "options", followed_plan: false, traded_at: "2026-07-02", vix_regime: null, bullseye_score: null },
  ]);
  assert.equal(thin.sufficient, false);
  assert.match(thin.message, /Insufficient sample/);
});

test("workflow routes and migration exist without placeholder-only pages", async () => {
  const files = [
    "../app/review/page.tsx",
    "../app/archive/page.tsx",
    "../app/options/page.tsx",
    "../app/journal/page.tsx",
    "../app/performance/page.tsx",
    "../app/results/page.tsx",
    "../app/replay/page.tsx",
    "../app/methodology/page.tsx",
    "../app/dashboard/page.tsx",
    "../app/components/mission-control/MissionControl.tsx",
    "../supabase/migrations/202607220010_market_snapshots_and_journal.sql",
    "../docs/WORKFLOW_ENTITLEMENT_MATRIX.md",
  ];
  for (const file of files) {
    const source = await readFile(new URL(file, import.meta.url), "utf8");
    assert.ok(source.length > 200, file);
    assert.doesNotMatch(source, /TODO implement|lorem ipsum|fake strike/i);
  }
  const dashboard = await readFile(new URL("../app/dashboard/page.tsx", import.meta.url), "utf8");
  assert.match(dashboard, /MissionControl/);
  assert.match(dashboard, /persistAnalysisSnapshot/);
});
