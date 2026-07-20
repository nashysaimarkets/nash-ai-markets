import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { analyzeMarketSnapshot } from "../app/lib/market-intelligence-engine.ts";
import type { MarketGatewayStatus } from "../app/lib/live-market-gateway.ts";
import type { MarketSnapshot } from "../app/lib/market-data.ts";
import { createStructuredTradePlan } from "../app/lib/structured-trade-planner.ts";
import { createTradingDecision } from "../app/lib/trading-decision-engine.ts";
import { createLaunchDiagnostics } from "../app/terminal/lib/launch-diagnostics.ts";

function snapshot(status: MarketSnapshot["status"] = "LIVE"): MarketSnapshot {
  return { status, source: "Launch fixture", asOf: "2026-07-16T12:00:00.000Z", quotes: [
    { symbol: "ES", label: "ES", value: "6325", change: "+1", direction: "up" }, { symbol: "VIX", label: "VIX", value: "15", change: "-1", direction: "down" },
    { symbol: "US2Y", label: "2Y", value: "4.1%", change: "-2", direction: "down" }, { symbol: "US10Y", label: "10Y", value: "4.3%", change: "-1", direction: "down" }, { symbol: "DXY", label: "DXY", value: "98", change: "-0.2", direction: "down" },
  ], levels: [], events: [], bias: "BULLISH", risk: "MODERATE", summary: "fixture", evidence: { trend: 82, momentum: 78, volatility: 28, breadth: 76, macro: 70 } };
}

function status(overrides: Partial<MarketGatewayStatus> = {}): MarketGatewayStatus {
  return {
    connectionStatus: "connected",
    providerName: "Financial Modeling Prep",
    lastAttempt: "2026-07-16T12:01:00.000Z",
    lastSuccessfulUpdate: "2026-07-16T12:00:00.000Z",
    dataAgeMs: 60_000,
    failureCount: 0,
    fallbackActive: false,
    lastRefreshLatencyMs: 142,
    reconnectAttempts: 0,
    lastFailureCategory: null,
    providerAttempt: {
      resultCategory: "success",
      httpStatusCategory: "success",
      endpointStatusCategories: {
        sp500Futures: "success",
        vix: "success",
        treasuryYields: "success",
        usDollarIndex: "success",
      },
      responseReceived: true,
      schemaRecognized: true,
      quoteCount: 5,
      requiredInstrumentsFound: ["ES", "VIX", "US2Y", "US10Y", "DXY"],
      requiredInstrumentsMissing: [],
      providerTimestamp: "2026-07-16T12:00:00.000Z",
      failureReason: null,
    },
    dataClassification: "live",
    ...overrides,
  };
}

function diagnostics(current = snapshot(), gateway = status(), environment: Record<string, string | undefined> = {}) {
  const intelligence = analyzeMarketSnapshot(current);
  const decision = createTradingDecision({ intelligence, reasoning: intelligence.reasoning, dataStatus: current.status, providerStatus: gateway.connectionStatus, dataAgeMs: gateway.dataAgeMs, fallbackActive: gateway.fallbackActive, missingDataWarnings: intelligence.reasoning.missingDataWarnings });
  const plan = createStructuredTradePlan({ decision, intelligence, dataStatus: current.status, providerStatus: gateway.connectionStatus, dataAgeMs: gateway.dataAgeMs, fallbackActive: gateway.fallbackActive, missingDataWarnings: intelligence.reasoning.missingDataWarnings });
  return createLaunchDiagnostics({ snapshot: current, gatewayStatus: gateway, intelligence, decision, plan, chartState: "ready", providerType: "fmp", apiCredentialConfigured: true, accessibilityContract: true, environment });
}

test("reports a healthy connected live launch candidate", () => { const result = diagnostics(); assert.equal(result.readiness, "READY"); assert.equal(result.provider.apiAuthentication, "accepted"); assert.equal(result.provider.refreshLatencyMs, 142); assert.equal(result.modes.live, true); assert.equal(result.provider.staleDetected, false); });
test("reports safe provider schema and instrument metadata", () => {
  const result = diagnostics();
  assert.equal(result.provider.resultCategory, "success");
  assert.equal(result.provider.responseReceived, true);
  assert.equal(result.provider.schemaRecognized, true);
  assert.equal(result.provider.quoteCount, 5);
  assert.deepEqual(result.provider.requiredInstrumentsMissing, []);
  assert.equal(result.provider.providerTimestamp, "2026-07-16T12:00:00.000Z");
  assert.equal(result.provider.classification, "live");
});
test("keeps partial provider coverage out of ready state", () => {
  const gateway = status({
    providerAttempt: {
      ...status().providerAttempt,
      resultCategory: "partial_success",
      httpStatusCategory: "mixed",
      endpointStatusCategories: {
        ...status().providerAttempt.endpointStatusCategories,
        usDollarIndex: "plan_restricted",
      },
      quoteCount: 4,
      requiredInstrumentsFound: ["ES", "VIX", "US2Y", "US10Y"],
      requiredInstrumentsMissing: ["DXY"],
    },
  });
  const result = diagnostics(snapshot(), gateway);
  assert.equal(result.checks.find((item) => item.id === "provider-coverage")?.status, "WARN");
  assert.equal(result.readiness, "DEGRADED");
});
test("reports cache reuse and estimates FMP upstream calls avoided", () => {
  const current = snapshot();
  const gateway = status();
  const intelligence = analyzeMarketSnapshot(current);
  const decision = createTradingDecision({ intelligence, reasoning: intelligence.reasoning, dataStatus: current.status, providerStatus: gateway.connectionStatus, dataAgeMs: gateway.dataAgeMs, fallbackActive: gateway.fallbackActive, missingDataWarnings: intelligence.reasoning.missingDataWarnings });
  const plan = createStructuredTradePlan({ decision, intelligence, dataStatus: current.status, providerStatus: gateway.connectionStatus, dataAgeMs: gateway.dataAgeMs, fallbackActive: gateway.fallbackActive, missingDataWarnings: intelligence.reasoning.missingDataWarnings });
  const result = createLaunchDiagnostics({
    snapshot: current,
    gatewayStatus: gateway,
    intelligence,
    decision,
    plan,
    chartState: "ready",
    providerType: "fmp",
    requestCache: {
      status: "hit",
      ttlMs: 15_000,
      hits: 3,
      misses: 1,
      coalesced: 2,
      providerLoads: 1,
      estimatedProviderLoadsAvoided: 5,
    },
  });
  assert.equal(result.requestCache.status, "hit");
  assert.equal(result.requestCache.providerLoads, 1);
  assert.equal(result.requestCache.estimatedUpstreamRequestsAvoided, 20);
});
test("detects delayed mode without presenting it as live", () => { const result = diagnostics(snapshot("DELAYED"), status({ connectionStatus: "degraded", dataAgeMs: 10 * 60_000 })); assert.equal(result.readiness, "DEGRADED"); assert.equal(result.modes.delayed, true); assert.equal(result.modes.live, false); assert.equal(result.cacheStatus, "delayed"); });
test("detects preview mode and preserves fail-closed warnings", () => { const result = diagnostics(snapshot("PREVIEW"), status({ connectionStatus: "not_configured", dataAgeMs: null, fallbackActive: true })); assert.equal(result.modes.preview, true); assert.equal(result.modes.offline, true); assert.equal(result.cacheStatus, "fallback"); assert.ok(result.warnings.length > 0); });
test("reports offline fallback, staleness and reconnect attempts", () => { const result = diagnostics(snapshot("UNAVAILABLE"), status({ connectionStatus: "offline", dataAgeMs: null, fallbackActive: true, reconnectAttempts: 2, lastFailureCategory: "plan_restricted" })); assert.equal(result.modes.offline, true); assert.equal(result.provider.staleDetected, true); assert.equal(result.provider.reconnectAttempts, 2); assert.equal(result.provider.lastFailureCategory, "plan_restricted"); assert.notEqual(result.readiness, "READY"); });
test("reports only sanitized provider-variable presence", () => {
  const secret = "must-never-appear";
  const current = snapshot("UNAVAILABLE");
  const gateway = status({ connectionStatus: "offline", dataAgeMs: null, fallbackActive: true, lastFailureCategory: "authentication_rejected" });
  const intelligence = analyzeMarketSnapshot(current);
  const decision = createTradingDecision({ intelligence, reasoning: intelligence.reasoning, dataStatus: current.status, providerStatus: gateway.connectionStatus, dataAgeMs: gateway.dataAgeMs, fallbackActive: gateway.fallbackActive, missingDataWarnings: intelligence.reasoning.missingDataWarnings });
  const plan = createStructuredTradePlan({ decision, intelligence, dataStatus: current.status, providerStatus: gateway.connectionStatus, dataAgeMs: gateway.dataAgeMs, fallbackActive: gateway.fallbackActive, missingDataWarnings: intelligence.reasoning.missingDataWarnings });
  const result = createLaunchDiagnostics({
    snapshot: current,
    gatewayStatus: gateway,
    intelligence,
    decision,
    plan,
    chartState: "empty",
    providerType: "fmp",
    apiCredentialConfigured: true,
    providerEnvironment: {
      marketDataProviderConfigured: true,
      fmpApiKeyConfigured: true,
      fmpApiBaseUrlConfigured: false,
      fmpSp500FuturesSymbolConfigured: true,
      fmpVixSymbolConfigured: false,
      fmpUsDollarIndexSymbolConfigured: false,
      fmpRequestTimeoutConfigured: false,
      marketDataMaxRetriesConfigured: false,
      marketDataRetryDelayConfigured: false,
      supabaseUrlConfigured: true,
      supabasePublishableKeyConfigured: true,
      supabaseServiceRoleKeyConfigured: true,
      openAIApiKeyConfigured: false,
      openAIBriefModelConfigured: false,
      openAIMorningBriefModelConfigured: false,
    },
    environment: { FMP_API_KEY: secret, FMP_API_BASE_URL: secret },
  });
  assert.deepEqual(result.provider.configuration, {
    marketDataProviderConfigured: true,
    fmpApiKeyConfigured: true,
    fmpApiBaseUrlConfigured: false,
    fmpSp500FuturesSymbolConfigured: true,
    fmpVixSymbolConfigured: false,
    fmpUsDollarIndexSymbolConfigured: false,
    fmpRequestTimeoutConfigured: false,
    marketDataMaxRetriesConfigured: false,
    marketDataRetryDelayConfigured: false,
    supabaseUrlConfigured: true,
    supabasePublishableKeyConfigured: true,
    supabaseServiceRoleKeyConfigured: true,
    openAIApiKeyConfigured: false,
    openAIBriefModelConfigured: false,
    openAIMorningBriefModelConfigured: false,
    defaultBaseUrlActive: true,
  });
  assert.equal(result.provider.lastFailureCategory, "authentication_rejected");
  assert.equal(JSON.stringify(result).includes(secret), false);
});
test("validates engine synchronization and no-trade planner alignment", () => { const result = diagnostics(snapshot("UNAVAILABLE"), status({ connectionStatus: "offline", dataAgeMs: null, fallbackActive: true })); assert.equal(result.checks.find((item) => item.id === "engines")?.status, "PASS"); assert.equal(result.checks.find((item) => item.id === "planner")?.status, "PASS"); });
test("fails readiness when unavailable data is falsely marked live", () => { const result = diagnostics(snapshot("LIVE"), status({ connectionStatus: "offline", fallbackActive: true })); assert.equal(result.checks.find((item) => item.id === "truth")?.status, "FAIL"); assert.equal(result.readiness, "NOT_READY"); });
test("sanitizes all production metadata before display", () => { const result = diagnostics(snapshot(), status(), { NODE_ENV: "production", APP_VERSION: "2.1.0-beta.1", BUILD_TIMESTAMP: "2026-07-16T12:00:00Z", GIT_COMMIT_SHA: "abcdef1234567890", BULLSEYE_TEST_TOTALS: "92" }); assert.deepEqual(result.environment, { mode: "production", applicationVersion: "2.1.0-beta.1", buildTimestamp: "2026-07-16T12:00:00.000Z", gitCommit: "abcdef123456", testTotal: 92 }); });
test("rejects secret-bearing or malformed build metadata", () => { const secret = "key-secret-value"; const result = diagnostics(snapshot(), status(), { NODE_ENV: secret, APP_VERSION: secret, BUILD_TIMESTAMP: secret, GIT_COMMIT_SHA: secret, BULLSEYE_TEST_TOTALS: "-1" }); assert.equal(JSON.stringify(result).includes(secret), false); assert.equal(result.environment.mode, "unknown"); assert.equal(result.environment.gitCommit, "Unavailable"); assert.equal(result.environment.testTotal, null); });
test("keeps the diagnostics route protected, indexed off and free of secret output", async () => { const source = await readFile(new URL("../app/terminal/diagnostics/page.tsx", import.meta.url), "utf8"); assert.match(source, /getUser/); assert.match(source, /robots: \{ index: false, follow: false \}/); assert.match(source, /Boolean\(process\.env\.FMP_API_KEY\)/); assert.doesNotMatch(source, /\{process\.env\.FMP_API_KEY\}/); assert.doesNotMatch(source, /FMP_API_BASE_URL/); });
