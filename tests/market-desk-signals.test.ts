import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { analyzeMarketSnapshot } from "../app/lib/market-intelligence-engine.ts";
import { createUnavailableSnapshot, type MarketSnapshot } from "../app/lib/market-data.ts";
import {
  createMarketDeskSignals,
  deskCandleContextFromRange,
} from "../app/lib/market-desk-signals.ts";
import { createStructuredTradePlan } from "../app/lib/structured-trade-planner.ts";
import { createTradingDecision } from "../app/lib/trading-decision-engine.ts";

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

function snapshot(overrides: Partial<MarketSnapshot> = {}): MarketSnapshot {
  return {
    status: "LIVE",
    source: "Desk signal fixture",
    asOf: "2026-07-16T12:00:00.000Z",
    quotes: [
      { symbol: "ES", label: "ES FUTURES", value: "6,325.50", change: "+0.75%", direction: "up" },
      { symbol: "VIX", label: "VIX", value: "15.00", change: "-1.20%", direction: "down" },
      { symbol: "US2Y", label: "2Y YIELD", value: "4.18%", change: "-2 bps", direction: "down" },
      { symbol: "US10Y", label: "10Y YIELD", value: "4.42%", change: "-1 bps", direction: "down" },
      { symbol: "DXY", label: "US DOLLAR", value: "98.12", change: "-0.16%", direction: "down" },
    ],
    levels: [
      { label: "R1", value: "6,335", note: "Primary resistance", type: "resistance" },
      { label: "S1", value: "6,300", note: "Primary support", type: "support" },
    ],
    events: [],
    bias: "BULLISH",
    risk: "MODERATE",
    summary: "fixture",
    evidence: { trend: 76, momentum: 72, volatility: 35, breadth: 70, macro: 64 },
    ...overrides,
  };
}

function build(input: MarketSnapshot, candle = deskCandleContextFromRange({
  current: 6330,
  high: 6360,
  low: 6280,
  firstClose: 6300,
  ema20: 6310,
})) {
  const intelligence = analyzeMarketSnapshot(input);
  const decision = createTradingDecision({
    intelligence,
    reasoning: intelligence.reasoning,
    dataStatus: input.status,
    providerStatus: "connected",
    dataAgeMs: 12_000,
    fallbackActive: false,
    missingDataWarnings: intelligence.reasoning.missingDataWarnings,
  });
  const plan = createStructuredTradePlan({
    decision,
    intelligence,
    dataStatus: input.status,
    providerStatus: "connected",
    dataAgeMs: 12_000,
    fallbackActive: false,
    missingDataWarnings: intelligence.reasoning.missingDataWarnings,
  });
  return createMarketDeskSignals({ snapshot: input, intelligence, decision, plan, candle });
}

test("desk signals fail closed when snapshot is unavailable", () => {
  const signals = build(createUnavailableSnapshot(), null);
  assert.equal(signals.overallLean, "insufficient");
  assert.equal(signals.buying.status, "unavailable");
  assert.equal(signals.selling.status, "unavailable");
  assert.match(signals.disclosure, /not broker execution signals/i);
  assert.ok(signals.buying.drivers.every((driver) => !/\$\d|strike|premium|greek/i.test(driver)));
});

test("risk-on verified inputs produce an educational buying lean", () => {
  const signals = build(snapshot());
  assert.equal(signals.schemaVersion, "1.0");
  assert.equal(signals.overallLean, "buying");
  assert.equal(signals.buying.status, "active");
  assert.ok(["strong", "moderate", "soft"].includes(signals.buying.strength));
  assert.equal(signals.selling.status, "inactive");
  assert.ok(signals.buying.drivers.some((driver) => /ES futures/i.test(driver)));
  assert.match(signals.buying.watchingFor, /confirmation/i);
  assert.match(signals.disclosure, /educational/i);
});

test("risk-off verified inputs produce an educational selling lean", () => {
  const signals = build(snapshot({
    quotes: [
      { symbol: "ES", label: "ES FUTURES", value: "6,250.00", change: "-0.90%", direction: "down" },
      { symbol: "VIX", label: "VIX", value: "22.40", change: "+8.10%", direction: "up" },
      { symbol: "US2Y", label: "2Y YIELD", value: "4.35%", change: "+4 bps", direction: "up" },
      { symbol: "US10Y", label: "10Y YIELD", value: "4.58%", change: "+5 bps", direction: "up" },
      { symbol: "DXY", label: "US DOLLAR", value: "99.40", change: "+0.55%", direction: "up" },
    ],
    bias: "BEARISH",
    evidence: { trend: 28, momentum: 30, volatility: 72, breadth: 32, macro: 34 },
  }), deskCandleContextFromRange({
    current: 6255,
    high: 6320,
    low: 6240,
    firstClose: 6305,
    ema20: 6288,
  }));
  assert.equal(signals.overallLean, "selling");
  assert.equal(signals.selling.status, "active");
  assert.equal(signals.buying.status, "inactive");
  assert.ok(signals.selling.drivers.some((driver) => /VIX is higher|ES futures latest move is lower/i.test(driver)));
});

test("flat / incomplete directional evidence stays neutral or mixed without inventing levels", () => {
  const signals = build(snapshot({
    quotes: [
      { symbol: "ES", label: "ES FUTURES", value: "6,300.00", change: "0.00%", direction: "flat" },
      { symbol: "VIX", label: "VIX", value: "16.00", change: "0.00%", direction: "flat" },
      { symbol: "US2Y", label: "2Y YIELD", value: "4.20%", change: "0 bps", direction: "flat" },
      { symbol: "US10Y", label: "10Y YIELD", value: "4.40%", change: "0 bps", direction: "flat" },
      { symbol: "DXY", label: "US DOLLAR", value: "98.50", change: "0.00%", direction: "flat" },
    ],
    levels: [],
    evidence: { trend: 50, momentum: 50, volatility: 50, breadth: 50, macro: 50 },
  }), null);
  assert.ok(["neutral", "mixed"].includes(signals.overallLean));
  assert.doesNotMatch(JSON.stringify(signals), /invent|fabricat|strike|delta|theta|premium/i);
  assert.ok(signals.contextNotes.some((note) => /candle structure not attached/i.test(note)));
});

test("desk candle helper never invents range when inputs are invalid", () => {
  assert.equal(deskCandleContextFromRange(null), null);
  assert.equal(deskCandleContextFromRange({ current: 10, high: 10, low: 10, firstClose: 10, ema20: 10 }), null);
  const ctx = deskCandleContextFromRange({ current: 50, high: 100, low: 0, firstClose: 40, ema20: 45 });
  assert.deepEqual(ctx, {
    aboveEma20: true,
    rangePositionPct: 50,
    sessionChangePositive: true,
  });
});

test("terminal and options surfaces wire desk signals with educational framing", async () => {
  const [terminal, options, styles, component] = await Promise.all([
    read("../app/terminal/page.tsx"),
    read("../app/options/page.tsx"),
    read("../app/mission-control.css"),
    read("../app/terminal/components/CustomerTerminal.tsx"),
  ]);
  assert.match(terminal, /createMarketDeskSignals/);
  assert.match(terminal, /MarketDeskSignalsPanel/);
  assert.match(options, /MarketDeskSignalsPanel/);
  assert.match(component, /Market buying &amp; selling signals|Market buying & selling signals/);
  assert.match(component, /Interpretive desk leans/);
  assert.match(styles, /\.ctDeskSignalPair/);
  assert.match(styles, /\.ctDeskSignalCard\.is-buying/);
  assert.match(styles, /\.ctDeskSignalCard\.is-selling/);
});
