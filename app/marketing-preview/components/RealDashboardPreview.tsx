import { MemberShell } from "../../components/MemberShell";
import { MarketCommandCentre } from "../../dashboard/components/MarketCommandCentre";
import { buildDashboardCommandSummary } from "../../dashboard/lib/dashboard-command-summary.ts";
import { buildDeskGreeting } from "../../dashboard/lib/market-weather.ts";
import { buildAiMarketInsight } from "../../lib/ai-market-insight.ts";
import { buildOracleBundle } from "../../lib/oracle/build-oracle-bundle.ts";
import { analyzeMarketSnapshot } from "../../lib/market-intelligence-engine.ts";
import { createTradingDecision } from "../../lib/trading-decision-engine.ts";
import { createStructuredTradePlan } from "../../lib/structured-trade-planner.ts";
import type { MarketQuote, MarketSnapshot } from "../../lib/market-data.ts";
import type { CustomerCandleSeries } from "../../lib/providers/financial-modeling-prep-candles.ts";
import { readSessionClock } from "../../terminal/lib/session-clock.ts";
import type { MarketingPreviewFixture } from "../lib/illustrative-fixtures.ts";

function signed(value: number, suffix = "") {
  const rounded = value.toFixed(2);
  return `${value > 0 ? "+" : ""}${rounded}${suffix}`;
}

function previewQuotes(fixture: MarketingPreviewFixture): MarketQuote[] {
  const first = fixture.candles[0]!;
  const last = fixture.candles.at(-1)!;
  const esChange = last.close - first.close;
  const esPct = (esChange / first.close) * 100;
  const direction = esChange > 0 ? "up" : esChange < 0 ? "down" : "flat";
  const vixDefensive = fixture.id === "defensive";
  const vixConstructive = fixture.id === "constructive";

  return [
    {
      symbol: "ES",
      label: "S&P 500 Futures",
      value: last.close.toFixed(2),
      change: `${signed(esChange)} pts · ${signed(esPct, "%")}`,
      direction,
    },
    {
      symbol: "VIX",
      label: "VIX",
      value: vixDefensive ? "21.84" : vixConstructive ? "15.92" : "18.37",
      change: vixDefensive ? "+4.20%" : vixConstructive ? "-3.10%" : "+0.40%",
      direction: vixDefensive ? "up" : vixConstructive ? "down" : "flat",
    },
    {
      symbol: "DXY",
      label: "US Dollar Index",
      value: fixture.id === "defensive" ? "99.42" : "98.76",
      change: fixture.id === "defensive" ? "+0.34%" : "-0.12%",
      direction: fixture.id === "defensive" ? "up" : "down",
    },
    {
      symbol: "US10Y",
      label: "US 10-year yield",
      value: fixture.id === "defensive" ? "4.31%" : "4.21%",
      change: fixture.id === "defensive" ? "+5.2 bps" : "-2.1 bps",
      direction: fixture.id === "defensive" ? "up" : "down",
    },
    {
      symbol: "US2Y",
      label: "US 2-year yield",
      value: fixture.id === "defensive" ? "3.94%" : "3.86%",
      change: fixture.id === "defensive" ? "+3.8 bps" : "-1.6 bps",
      direction: fixture.id === "defensive" ? "up" : "down",
    },
  ];
}

function previewSnapshot(fixture: MarketingPreviewFixture, now: number): MarketSnapshot {
  const { levels, posture } = fixture;
  return {
    status: "DELAYED",
    source: "Illustrative preview fixture — not a live feed",
    asOf: new Date(now - 10 * 60_000).toISOString(),
    quotes: previewQuotes(fixture),
    levels: [
      { label: "Illustrative resistance", value: levels.r1.toFixed(2), note: "Example-only upside reference", type: "resistance" },
      { label: "Illustrative pivot", value: levels.pivot.toFixed(2), note: "Example-only decision reference", type: "pivot" },
      { label: "Illustrative support", value: levels.s1.toFixed(2), note: "Example-only downside reference", type: "support" },
    ],
    events: [
      {
        time: "19:00 UK",
        name: "Illustrative high-impact US event",
        risk: "HIGH",
        at: new Date(now + 60 * 60_000).toISOString(),
      },
    ],
    bias: posture.lean.toUpperCase(),
    risk: fixture.id === "defensive" ? "ELEVATED" : fixture.id === "constructive" ? "MODERATE" : "HIGH",
    summary: `${posture.summary} Example-only presentation data.`,
    evidence: {
      trend: fixture.id === "constructive" ? 68 : fixture.id === "defensive" ? 32 : 50,
      volatility: fixture.id === "defensive" ? 72 : fixture.id === "constructive" ? 38 : 52,
      sentiment: fixture.id === "constructive" ? 66 : fixture.id === "defensive" ? 34 : 50,
      riskOnRiskOff: fixture.id === "constructive" ? 65 : fixture.id === "defensive" ? 35 : 50,
    },
  };
}

function previewCandles(fixture: MarketingPreviewFixture, now: number): CustomerCandleSeries {
  return {
    symbol: "ESUSD",
    contract: "S&P 500 futures · illustrative",
    instrumentName: "S&P 500 futures",
    exchange: "Illustrative preview",
    instrumentDetail: "Example-only OHLCV for private product presentation. Not live market data.",
    timeframe: "5m",
    classification: "delayed",
    dataAgeMs: 10 * 60_000,
    provider: "Financial Modeling Prep",
    status: "delayed",
    asOf: new Date(now - 10 * 60_000).toISOString(),
    candles: fixture.candles.map((candle) => ({ ...candle })),
    failureCategory: null,
  };
}

export function RealDashboardPreview({ fixture }: { fixture: MarketingPreviewFixture }) {
  const now = fixture.candles.at(-1)!.time * 1000 + 10 * 60_000;
  const snapshot = previewSnapshot(fixture, now);
  const candleSeries = previewCandles(fixture, now);
  const session = readSessionClock(new Date(now));
  const intelligence = analyzeMarketSnapshot(snapshot);
  const decision = createTradingDecision({
    intelligence,
    reasoning: intelligence.reasoning,
    dataStatus: snapshot.status,
    providerStatus: "connected",
    dataAgeMs: 10 * 60_000,
    fallbackActive: false,
    missingDataWarnings: intelligence.reasoning.missingDataWarnings,
  });
  const plan = createStructuredTradePlan({
    decision,
    intelligence,
    dataStatus: snapshot.status,
    providerStatus: "connected",
    dataAgeMs: 10 * 60_000,
    fallbackActive: false,
    missingDataWarnings: intelligence.reasoning.missingDataWarnings,
  });
  const greeting = buildDeskGreeting("Member", session, new Date(now));
  const summary = buildDashboardCommandSummary({
    snapshot,
    session,
    candleSeries,
    decision,
    plan,
    signals: null,
    warnings: ["Illustrative private-preview data — not live market data"],
    candleAccess: true,
    now,
  });
  const insight = buildAiMarketInsight({
    snapshot,
    intelligence,
    decision,
    plan,
    verified: false,
    warnings: ["Illustrative private-preview data — not live market data"],
    now,
  });
  const oracle = buildOracleBundle({
    snapshot,
    intelligence,
    decision,
    plan,
    session,
    verified: false,
    freshnessLabel: "EXAMPLE ONLY · 10-minute illustrative delay",
    warnings: ["Illustrative private-preview data — not live market data"],
    candles: candleSeries.candles,
    support: fixture.levels.s1,
    resistance: fixture.levels.r1,
    now,
  });

  return (
    <MemberShell active="dashboard" className="marketingRealMemberPreview">
      <aside className="dashPartialBanner" role="status">
        <strong>EXAMPLE-ONLY MEMBER EXPERIENCE</strong>
        <span>All figures, charts, levels and commentary on this private preview are illustrative — not live market data.</span>
      </aside>
      <MarketCommandCentre
        greeting={greeting}
        tierLabel="Elite example"
        summary={summary}
        insight={insight}
        oracle={oracle}
        candleSeries={candleSeries}
        now={now}
        session={session}
        quotes={snapshot.quotes}
        plan={plan}
        macroContext={null}
      />
    </MemberShell>
  );
}
