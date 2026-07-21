import assert from "node:assert/strict";
import test from "node:test";
import { getMarketSnapshot } from "../app/lib/market-data.ts";
import { createDashboardViewModel } from "../app/terminal/lib/dashboard-data.ts";
import { createDataProvenance } from "../app/terminal/lib/provenance.ts";
import { createTerminalMarketDataProvider, getTerminalMarketData } from "../app/terminal/lib/terminal-market-data-provider.ts";
import { createCompositeMarketDataProvider, LiveMarketGateway, REQUIRED_MARKET_GATEWAY_COVERAGE } from "../app/lib/live-market-gateway.ts";
import { formatPanelTimestamp, panelMarketStatus, panelUnavailableMessage, TERMINAL_SHORTCUTS, TERMINAL_SKELETON_PANELS, terminalStatusMessage } from "../app/terminal/lib/terminal-state.ts";

test("builds a terminal dashboard view model from the market snapshot", () => {
  const snapshot = {
    status: "PREVIEW" as const,
    source: "NASH AI demonstration dataset",
    asOf: "2026-07-16T07:00:00.000Z",
    quotes: [
      { symbol: "ES", label: "ES FUTURES", value: "6,318.25", change: "+0.34%", direction: "up" as const },
      { symbol: "VIX", label: "VIX", value: "16.42", change: "−1.08%", direction: "down" as const },
      { symbol: "US10Y", label: "10Y YIELD", value: "4.31%", change: "+3 bps", direction: "up" as const },
      { symbol: "DXY", label: "US DOLLAR", value: "97.84", change: "FLAT", direction: "flat" as const },
    ],
    levels: [
      { label: "R2", value: "6,350", note: "Momentum breakout", type: "resistance" as const },
      { label: "R1", value: "6,332", note: "First resistance", type: "resistance" as const },
      { label: "PV", value: "6,310", note: "Daily pivot", type: "pivot" as const },
      { label: "S1", value: "6,288", note: "First support", type: "support" as const },
    ],
    events: [{ time: "13:30 UK", name: "US economic data", risk: "HIGH" as const }],
    bias: "NEUTRAL → BULLISH",
    risk: "ELEVATED" as const,
    summary: "Preview-only market structure.",
    evidence: { trend: 58, momentum: 55, volatility: 48, breadth: 54, macro: 50 },
  };

  const bullseye = {
    score: 63,
    confidence: 72,
    weather: "MIXED" as const,
    bias: "NEUTRAL → BULLISH",
    risk: "ELEVATED" as const,
    bullProbability: 57,
    bearProbability: 35,
    noTradeProbability: 23,
    dna: ["NEUTRAL → BULLISH", "ELEVATED RISK", "PREVIEW DATA"],
    bullTrigger: "Acceptance above resistance",
    bearTrigger: "Sustained loss of pivot",
    bullInvalidation: "Rejection back below resistance",
    bearInvalidation: "Recovery above pivot",
    standAside: "Stand aside when range persists.",
    riskWindowPrep: "Reduce size before the event window.",
    optionsApproach: "Use defined risk.",
    missionBrief: "The market is balanced but constructive.",
  };

  const viewModel = createDashboardViewModel(snapshot, bullseye as never);

  assert.equal(viewModel.futures.value, "6,318.25");
  assert.equal(viewModel.futures.bias, "NEUTRAL → BULLISH");
  assert.equal(viewModel.vix.value, "16.42");
  assert.equal(viewModel.options.putCall, "Unavailable");
  assert.equal(viewModel.eliteTradeSetup.direction, "None");
  assert.equal(viewModel.eliteTradeSetup.status, "Unavailable");
  assert.deepEqual(viewModel.movers, []);
  assert.deepEqual(viewModel.headlines, []);

  const provenance = createDataProvenance({ source: "Demo feed", lastUpdated: "2026-07-16T07:00:00.000Z", status: "PLACEHOLDER", kind: "fact", provider: "Demo Provider" });
  assert.equal(provenance.status, "PLACEHOLDER");
  assert.equal(provenance.source, "Demo feed");
  assert.equal(provenance.provider, "Demo Provider");
  assert.equal(provenance.badgeLabel, "Placeholder");
});

test("uses a custom provider when fetching the market snapshot", async () => {
  const snapshot = await getMarketSnapshot({
    now: Date.now(),
    provider: async () => ({
      status: "LIVE",
      source: "Live provider",
      asOf: new Date().toISOString(),
      quotes: [
        { symbol: "ES", label: "ES FUTURES", value: "6,325.50", change: "+0.75%", direction: "up" as const },
        { symbol: "VIX", label: "VIX", value: "15.88", change: "-0.42", direction: "down" as const },
        { symbol: "US10Y", label: "10Y YIELD", value: "4.38%", change: "+4 bps", direction: "up" as const },
        { symbol: "DXY", label: "US DOLLAR", value: "98.12", change: "+0.16", direction: "up" as const },
      ],
      levels: [
        { label: "R1", value: "6,330", note: "First resistance", type: "resistance" as const },
        { label: "S1", value: "6,310", note: "First support", type: "support" as const },
      ],
      events: [{ time: "13:30 UK", name: "CPI print", risk: "HIGH" as const }],
      bias: "BULLISH",
      risk: "MODERATE" as const,
      summary: "Live provider data",
      evidence: { trend: 72, momentum: 70, volatility: 45, breadth: 68, macro: 66 },
    }),
  });

  assert.equal(snapshot.status, "LIVE");
  assert.equal(snapshot.source, "Live provider");
  assert.equal(snapshot.quotes.find((quote) => quote.symbol === "ES")?.value, "6,325.50");
  assert.equal(snapshot.events[0]?.name, "CPI print");
});

test("does not create a live adapter when no provider is configured", () => {
  const provider = createTerminalMarketDataProvider();
  assert.equal(provider, undefined);
});

test("exposes a reusable not-configured gateway status without live values", async () => {
  const result = await getTerminalMarketData(undefined, Date.parse("2026-07-16T12:00:00.000Z"));
  assert.equal(result.snapshot.status, "UNAVAILABLE");
  assert.deepEqual(result.snapshot.quotes, []);
  assert.deepEqual(result.snapshot.events, []);
  assert.equal(result.gatewayStatus.connectionStatus, "not_configured");
  assert.equal(result.gatewayStatus.lastAttempt, null);
  assert.equal(result.gatewayStatus.lastSuccessfulUpdate, null);
  assert.equal(result.gatewayStatus.dataAgeMs, null);
  assert.equal(result.gatewayStatus.lastRefreshLatencyMs, null);
  assert.equal(result.gatewayStatus.reconnectAttempts, 0);
  assert.equal(result.gatewayStatus.failureCount, 0);
  assert.equal(result.gatewayStatus.fallbackActive, true);
  assert.equal(result.cache.status, "disabled");
  assert.equal(result.cache.providerLoads, 0);
});

test("defines all required future provider coverage", () => {
  assert.deepEqual(REQUIRED_MARKET_GATEWAY_COVERAGE, [
    "sp500Futures",
    "vix",
    "us2YearYield",
    "us10YearYield",
    "usDollarIndex",
    "economicCalendar",
  ]);
});

test("maps provider-backed market data into the terminal panels", async () => {
  const snapshot = await getMarketSnapshot({
    now: Date.now(),
    provider: async () => ({
      status: "LIVE",
      source: "Live provider",
      asOf: new Date().toISOString(),
      quotes: [
        { symbol: "ES", label: "ES FUTURES", value: "6,325.50", change: "+0.75%", direction: "up" as const },
        { symbol: "VIX", label: "VIX", value: "15.88", change: "-0.42", direction: "down" as const },
        { symbol: "US2Y", label: "2Y YIELD", value: "4.12%", change: "-2 bps", direction: "down" as const },
        { symbol: "US10Y", label: "10Y YIELD", value: "4.38%", change: "+4 bps", direction: "up" as const },
        { symbol: "US30Y", label: "30Y YIELD", value: "4.86%", change: "+3 bps", direction: "up" as const },
        { symbol: "DXY", label: "US DOLLAR", value: "98.12", change: "+0.16", direction: "up" as const },
      ],
      levels: [
        { label: "R1", value: "6,330", note: "First resistance", type: "resistance" as const },
        { label: "S1", value: "6,310", note: "First support", type: "support" as const },
      ],
      events: [{ time: "13:30 UK", name: "CPI print", risk: "HIGH" as const }],
      bias: "BULLISH",
      risk: "MODERATE" as const,
      summary: "Live provider data",
      evidence: { trend: 72, momentum: 70, volatility: 45, breadth: 68, macro: 66 },
    }),
  });

  const bullseye = {
    score: 69,
    confidence: 74,
    weather: "MIXED" as const,
    bias: "BULLISH",
    risk: "MODERATE" as const,
    bullProbability: 60,
    bearProbability: 28,
    noTradeProbability: 18,
    dna: ["BULLISH", "MODERATE RISK"],
    bullTrigger: "Breakout confirmation",
    bearTrigger: "Fade below support",
    bullInvalidation: "Rejection into range",
    bearInvalidation: "Break above resistance",
    standAside: "Stand aside if range persists.",
    riskWindowPrep: "Monitor the event window.",
    optionsApproach: "Use defined risk.",
    missionBrief: "Momentum is constructive but the range remains active.",
  };

  const viewModel = createDashboardViewModel(snapshot, bullseye as never);
  assert.equal(viewModel.futures.value, "6,325.50");
  assert.equal(viewModel.vix.value, "15.88");
  assert.equal(viewModel.treasuries[0]?.value, "4.12%");
  assert.equal(viewModel.treasuries[1]?.value, "4.38%");
  assert.equal(viewModel.treasuries[2]?.value, "4.86%");
  assert.equal(viewModel.dollar.value, "98.12");
  assert.equal(viewModel.economicEvents[0]?.name, "CPI print");
});

test("falls back to an empty unavailable snapshot and records provider failures", async () => {
  const gateway = new LiveMarketGateway({
    provider: { fetchSnapshot: async () => { throw new Error("boom"); } },
    providerName: "Test provider",
    maxRetries: 1,
    retryDelayMs: 0,
    logger: () => undefined,
  });

  const now = Date.parse("2026-07-16T12:00:00.000Z");
  const snapshot = await gateway.fetchSnapshot(now);
  const status = gateway.getStatus();
  assert.equal(snapshot.status, "UNAVAILABLE");
  assert.deepEqual(snapshot.quotes, []);
  assert.equal(status.connectionStatus, "offline");
  assert.equal(status.providerName, "Test provider");
  assert.equal(status.lastAttempt, new Date(now).toISOString());
  assert.equal(status.lastSuccessfulUpdate, null);
  assert.equal(status.dataAgeMs, null);
  assert.equal(status.failureCount, 2);
  assert.ok(status.lastRefreshLatencyMs !== null && status.lastRefreshLatencyMs >= 0);
  assert.equal(status.reconnectAttempts, 1);
  assert.equal(status.fallbackActive, true);
});

test("records provider success, connection status and data age", async () => {
  const now = Date.parse("2026-07-16T12:00:00.000Z");
  const asOf = new Date(now - 2 * 60_000).toISOString();
  const gateway = new LiveMarketGateway({
    providerName: "Test provider",
    maxRetries: 0,
    logger: () => undefined,
    provider: { fetchSnapshot: async () => ({
      status: "LIVE",
      source: "Test provider",
      asOf,
      quotes: [],
      levels: [],
      events: [],
      bias: "NEUTRAL",
      risk: "MODERATE",
      summary: "Test data",
      evidence: {},
    }) },
  });

  const snapshot = await gateway.fetchSnapshot(now);
  const status = gateway.getStatus();
  assert.equal(snapshot.status, "LIVE");
  assert.equal(status.connectionStatus, "connected");
  assert.equal(status.lastSuccessfulUpdate, asOf);
  assert.equal(status.dataAgeMs, 2 * 60_000);
  assert.equal(status.failureCount, 0);
  assert.ok(status.lastRefreshLatencyMs !== null && status.lastRefreshLatencyMs >= 0);
  assert.equal(status.reconnectAttempts, 0);
  assert.equal(status.fallbackActive, false);
});

test("marks permitted delayed provider data as degraded without fallback", async () => {
  const now = Date.parse("2026-07-16T12:00:00.000Z");
  const asOf = new Date(now - 10 * 60_000).toISOString();
  const gateway = new LiveMarketGateway({
    providerName: "Delayed test provider",
    maxRetries: 0,
    logger: () => undefined,
    provider: { fetchSnapshot: async () => ({
      status: "DELAYED",
      source: "Delayed test provider",
      asOf,
      quotes: [],
      levels: [],
      events: [],
      bias: "NEUTRAL",
      risk: "MODERATE",
      summary: "Delayed test data",
      evidence: {},
    }) },
  });

  const snapshot = await gateway.fetchSnapshot(now);
  const status = gateway.getStatus();
  assert.equal(snapshot.status, "DELAYED");
  assert.equal(status.connectionStatus, "degraded");
  assert.equal(status.dataAgeMs, 10 * 60_000);
  assert.equal(status.fallbackActive, false);
});

test("recovers on retry after a failed provider response", async () => {
  const now = Date.parse("2026-07-16T12:00:00.000Z");
  let attempts = 0;
  const gateway = new LiveMarketGateway({
    providerName: "Recovering provider",
    maxRetries: 1,
    retryDelayMs: 0,
    logger: () => undefined,
    provider: { fetchSnapshot: async () => {
      attempts += 1;
      if (attempts === 1) throw new Error("temporary timeout");
      return {
        status: "LIVE",
        source: "Recovering provider",
        asOf: new Date(now - 30_000).toISOString(),
        quotes: [{ symbol: "ES", label: "ES FUTURES", value: "6,320.00", change: "+0.20%", direction: "up" as const }],
        levels: [],
        events: [],
        bias: "NEUTRAL",
        risk: "MODERATE" as const,
        summary: "Recovered provider data",
        evidence: {},
      };
    } },
  });

  const snapshot = await gateway.fetchSnapshot(now);
  const status = gateway.getStatus();
  assert.equal(attempts, 2);
  assert.equal(snapshot.status, "LIVE");
  assert.equal(snapshot.quotes[0]?.symbol, "ES");
  assert.equal(status.connectionStatus, "connected");
  assert.equal(status.failureCount, 1);
  assert.equal(status.reconnectAttempts, 1);
  assert.equal(status.fallbackActive, false);
});

test("defines loading placeholders for every terminal market panel", () => {
  assert.equal(TERMINAL_SKELETON_PANELS.length, 23);
  assert.equal(new Set(TERMINAL_SKELETON_PANELS.map((panel) => panel.key)).size, 23);
  assert.deepEqual(new Set(TERMINAL_SKELETON_PANELS.map((panel) => panel.className)), new Set([
    "panelProvenance", "panelVerdict", "panelEliteTrade", "panelFutures", "panelBrief", "panelBriefing",
    "panelCalendarCompact", "panelMovers", "panelHeadlines", "panelSentiment", "panelRisk", "panelProbabilities",
    "panelExpectedMove", "panelBias", "panelOptionsBias", "panelLevels", "panelVix", "panelTreasuries",
    "panelDollar", "panelCalendar", "panelFearGreed", "panelOptions",
  ]));
});

test("provides recovery-safe unavailable messaging", () => {
  assert.match(terminalStatusMessage("UNAVAILABLE", 2), /TEMPORARILY UNAVAILABLE/);
  assert.match(terminalStatusMessage("UNAVAILABLE", 2), /NO CURRENT MARKET SIGNALS/);
  assert.doesNotMatch(terminalStatusMessage("UNAVAILABLE", 2), /FAILED ATTEMPT/);
  assert.match(panelUnavailableMessage("UNAVAILABLE") ?? "", /recover automatically/);
  assert.equal(panelUnavailableMessage("LIVE"), null);
});

test("maps panel provenance to dashboard market status indicators", () => {
  assert.equal(panelMarketStatus("LIVE"), "Live");
  assert.equal(panelMarketStatus("DELAYED"), "Delayed");
  assert.equal(panelMarketStatus("MODELLED"), "Cached");
  assert.equal(panelMarketStatus("PLACEHOLDER"), "Cached");
  assert.equal(panelMarketStatus("UNAVAILABLE"), "Offline");
  assert.equal(formatPanelTimestamp("2026-07-16T12:34:56.000Z"), "13:34:56 UK");
  assert.equal(formatPanelTimestamp("invalid"), "Awaiting first verified update");
  assert.equal(formatPanelTimestamp("1970-01-01T00:00:00.000Z"), "Awaiting first verified update");
});

test("defines refresh, full-screen and help keyboard shortcuts", () => {
  assert.deepEqual(TERMINAL_SHORTCUTS.map((shortcut) => shortcut.key), ["R", "F", "?"]);
});

test("merges market slice adapters into a composite snapshot", async () => {
  const provider = createCompositeMarketDataProvider([
    {
      name: "futures",
      fetchSnapshot: async () => ({
        status: "LIVE",
        source: "Futures slice",
        asOf: new Date().toISOString(),
        quotes: [{ symbol: "ES", label: "ES FUTURES", value: "6,320.00", change: "+0.40%", direction: "up" as const }],
        levels: [{ label: "R1", value: "6,330", note: "Resistance", type: "resistance" as const }],
        events: [],
        bias: "BULLISH",
        risk: "MODERATE" as const,
        summary: "slice",
        evidence: { trend: 60, momentum: 62, volatility: 50, breadth: 58, macro: 55 },
      }),
    },
    {
      name: "calendar",
      fetchSnapshot: async () => ({
        status: "LIVE",
        source: "Calendar slice",
        asOf: new Date().toISOString(),
        quotes: [],
        levels: [],
        events: [{ time: "13:30 UK", name: "CPI print", risk: "HIGH" as const }],
        bias: "BULLISH",
        risk: "MODERATE" as const,
        summary: "slice",
        evidence: { trend: 60, momentum: 62, volatility: 50, breadth: 58, macro: 55 },
      }),
    },
  ]);

  const snapshot = await provider.fetchSnapshot();
  assert.ok(snapshot);
  assert.equal(snapshot.quotes.find((quote) => quote.symbol === "ES")?.value, "6,320.00");
  assert.equal(snapshot.events[0]?.name, "CPI print");
});
