import assert from "node:assert/strict";
import test from "node:test";
import { getMarketSnapshot } from "../app/lib/market-data.ts";
import { createDashboardViewModel } from "../app/terminal/lib/dashboard-data.ts";
import { createDataProvenance } from "../app/terminal/lib/provenance.ts";
import { createTerminalMarketDataProvider } from "../app/terminal/lib/terminal-market-data-provider.ts";

test("builds a terminal dashboard view model from the market snapshot", () => {
  const snapshot = {
    status: "PREVIEW",
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
  assert.equal(viewModel.fearGreed.label, "GREED");
  assert.equal(viewModel.options.putCall, "0.88x");
  assert.equal(viewModel.eliteTradeSetup.direction, "Long");
  assert.equal(viewModel.eliteTradeSetup.status, "Waiting");

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

test("builds the terminal provider with the default adapter", () => {
  const provider = createTerminalMarketDataProvider();
  assert.equal(typeof provider, "object");
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
