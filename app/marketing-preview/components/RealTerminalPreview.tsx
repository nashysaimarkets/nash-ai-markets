import { MemberShell } from "../../components/MemberShell";
import { rangeLaneFromCandles } from "../../components/mini-visuals/mini-visual-data.ts";
import { createUnconfiguredMarketGatewayStatus, type MarketGatewayStatus } from "../../lib/live-market-gateway.ts";
import { createMarketDeskSignals, deskCandleContextFromRange } from "../../lib/market-desk-signals.ts";
import { createMarketStructureLevels } from "../../lib/market-structure-levels.ts";
import { analyzeMarketSnapshot } from "../../lib/market-intelligence-engine.ts";
import { createTradingDecision } from "../../lib/trading-decision-engine.ts";
import { createStructuredTradePlan } from "../../lib/structured-trade-planner.ts";
import { formatSnapshotAge, formatUkTimestamp, type MarketQuote, type MarketSnapshot } from "../../lib/market-data.ts";
import {
  CANDLE_INSTRUMENTS,
  isCandleInstrument,
  providerSymbolForInstrument,
  resolveCandleInstrumentMeta,
  type CandleInstrument,
} from "../../lib/providers/candle-instruments.ts";
import type { CustomerCandleSeries } from "../../lib/providers/financial-modeling-prep-candles.ts";
import { getMarketInstrument } from "../../lib/markets/market-catalog.ts";
import { sanitizeForClient } from "../../lib/serialize-for-client.ts";
import { createUnavailableMacroContext } from "../../lib/verified-macro-context.ts";
import { TradingDeskOS } from "../../terminal/components/TradingDeskOS.tsx";
import { DeskErrorBoundary } from "../../terminal/components/DeskErrorBoundary.tsx";
import { TerminalControls } from "../../terminal/components/TerminalControls.tsx";
import { createCatalystRadar } from "../../terminal/lib/catalyst-radar.ts";
import { formatCustomerParticipationWarnings } from "../../terminal/lib/customer-warnings.ts";
import { buildDeskDecisionPresentation } from "../../terminal/lib/desk-decision-presentation.ts";
import { createDefaultWorkspace } from "../../terminal/lib/desk-workspace.ts";
import { createEdgeBrief } from "../../terminal/lib/edge-brief.ts";
import { mapCandleFreshness, type DeskCandleBundle, type DeskFreshnessFeed, type TradingDeskPayload } from "../../terminal/lib/desk-payload.ts";
import { readSessionClock } from "../../terminal/lib/session-clock.ts";
import { terminalMarketState } from "../../terminal/lib/visual-terminal.ts";
import type { MarketingPreviewFixture } from "../lib/illustrative-fixtures.ts";

const SERIES_CONFIG: Record<CandleInstrument, { base: number; scale: number; label: string }> = {
  ES: { base: 6124.5, scale: 1, label: "S&P 500 Futures" },
  VIX: { base: 18.37, scale: 0.075, label: "VIX" },
  DXY: { base: 98.76, scale: 0.045, label: "US Dollar Index" },
  OIL: { base: 82.14, scale: 0.085, label: "Oil (USO)" },
  QQQ: { base: 556.42, scale: 0.32, label: "QQQ" },
  IXIC: { base: 21745.6, scale: 2.9, label: "Nasdaq Composite" },
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function signed(value: number, suffix = "") {
  const rounded = value.toFixed(2);
  return `${value > 0 ? "+" : ""}${rounded}${suffix}`;
}

function previewCandleSeries(
  fixture: MarketingPreviewFixture,
  instrument: CandleInstrument,
  now: number,
): CustomerCandleSeries {
  const config = SERIES_CONFIG[instrument];
  const sourceAnchor = fixture.candles[0]!.close;
  const convert = (value: number) => round2(config.base + (value - sourceAnchor) * config.scale);
  const meta = resolveCandleInstrumentMeta(instrument);

  return {
    symbol: providerSymbolForInstrument(instrument),
    contract: meta.contract,
    instrumentName: meta.instrumentName,
    exchange: "Illustrative preview",
    instrumentDetail: `${meta.instrumentName} example-only OHLCV for private product presentation. Not live market data.`,
    timeframe: "5m",
    classification: "delayed",
    dataAgeMs: 10 * 60_000,
    provider: "Financial Modeling Prep",
    status: "delayed",
    asOf: new Date(now - 10 * 60_000).toISOString(),
    candles: fixture.candles.map((candle) => ({
      time: candle.time,
      open: convert(candle.open),
      high: convert(candle.high),
      low: convert(candle.low),
      close: convert(candle.close),
      volume: Math.max(0, Math.round(candle.volume * (instrument === "ES" ? 1 : 0.62))),
    })),
    failureCategory: null,
  };
}

function quoteFromSeries(
  instrument: CandleInstrument,
  series: CustomerCandleSeries,
): MarketQuote {
  const config = SERIES_CONFIG[instrument];
  const first = series.candles[0]!;
  const last = series.candles.at(-1)!;
  const change = last.close - first.close;
  const percent = (change / first.close) * 100;
  const direction: MarketQuote["direction"] = change > 0 ? "up" : change < 0 ? "down" : "flat";
  return {
    symbol: instrument,
    label: config.label,
    value: last.close.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    change: `${signed(change)} · ${signed(percent, "%")}`,
    direction,
  };
}

function treasuryQuote(
  symbol: "US2Y" | "US10Y",
  fixture: MarketingPreviewFixture,
): MarketQuote {
  const defensive = fixture.id === "defensive";
  const value = symbol === "US2Y"
    ? (defensive ? "3.94%" : "3.86%")
    : (defensive ? "4.31%" : "4.21%");
  const change = symbol === "US2Y"
    ? (defensive ? "+3.8 bps" : "-1.6 bps")
    : (defensive ? "+5.2 bps" : "-2.1 bps");
  return {
    symbol,
    label: symbol === "US2Y" ? "US 2-year yield" : "US 10-year yield",
    value,
    change,
    direction: defensive ? "up" : "down",
  };
}

function previewSnapshot(
  fixture: MarketingPreviewFixture,
  bundle: DeskCandleBundle,
  now: number,
): MarketSnapshot {
  const { levels, posture } = fixture;
  return {
    status: "DELAYED",
    source: "Illustrative preview fixture — not a live feed",
    asOf: new Date(now - 10 * 60_000).toISOString(),
    quotes: [
      quoteFromSeries("ES", bundle.ES),
      quoteFromSeries("VIX", bundle.VIX),
      treasuryQuote("US2Y", fixture),
      treasuryQuote("US10Y", fixture),
      quoteFromSeries("DXY", bundle.DXY),
      quoteFromSeries("OIL", bundle.OIL),
      quoteFromSeries("QQQ", bundle.QQQ),
      quoteFromSeries("IXIC", bundle.IXIC),
    ],
    levels: [
      {
        label: "Illustrative resistance",
        value: levels.r1.toFixed(2),
        note: "Example-only upside reference",
        type: "resistance",
      },
      {
        label: "Illustrative pivot",
        value: levels.pivot.toFixed(2),
        note: "Example-only decision reference",
        type: "pivot",
      },
      {
        label: "Illustrative support",
        value: levels.s1.toFixed(2),
        note: "Example-only downside reference",
        type: "support",
      },
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

function previewGatewayStatus(snapshot: MarketSnapshot): MarketGatewayStatus {
  const base = createUnconfiguredMarketGatewayStatus("Illustrative preview fixture");
  return {
    ...base,
    connectionStatus: "connected",
    lastAttempt: snapshot.asOf,
    lastSuccessfulUpdate: snapshot.asOf,
    dataAgeMs: 10 * 60_000,
    failureCount: 0,
    fallbackActive: false,
    lastRefreshLatencyMs: 42,
    reconnectAttempts: 0,
    lastFailureCategory: null,
    providerAttempt: {
      ...base.providerAttempt,
      resultCategory: "success",
      httpStatusCategory: "success",
      endpointStatusCategories: {
        sp500Futures: "success",
        vix: "success",
        treasuryYields: "success",
        usDollarIndex: "success",
        oil: "success",
        qqq: "success",
        nasdaq: "success",
      },
      responseReceived: true,
      schemaRecognized: true,
      quoteCount: snapshot.quotes.length,
      requiredInstrumentsFound: ["ES", "VIX", "US2Y", "US10Y", "DXY"],
      requiredInstrumentsMissing: [],
      providerTimestamp: snapshot.asOf,
      failureReason: null,
    },
    dataClassification: "delayed",
  };
}

export function RealTerminalPreview({ fixture }: { fixture: MarketingPreviewFixture }) {
  const now = fixture.candles.at(-1)!.time * 1000 + 10 * 60_000;
  const bundle = Object.fromEntries(
    CANDLE_INSTRUMENTS.map((instrument) => [instrument, previewCandleSeries(fixture, instrument, now)]),
  ) as DeskCandleBundle;
  const snapshot = previewSnapshot(fixture, bundle, now);
  const gatewayStatus = previewGatewayStatus(snapshot);
  const intelligence = analyzeMarketSnapshot(snapshot);
  const decision = createTradingDecision({
    intelligence,
    reasoning: intelligence.reasoning,
    dataStatus: snapshot.status,
    providerStatus: gatewayStatus.connectionStatus,
    dataAgeMs: gatewayStatus.dataAgeMs,
    fallbackActive: gatewayStatus.fallbackActive,
    missingDataWarnings: intelligence.reasoning.missingDataWarnings,
  });
  const plan = createStructuredTradePlan({
    decision,
    intelligence,
    dataStatus: snapshot.status,
    providerStatus: gatewayStatus.connectionStatus,
    dataAgeMs: gatewayStatus.dataAgeMs,
    fallbackActive: gatewayStatus.fallbackActive,
    missingDataWarnings: intelligence.reasoning.missingDataWarnings,
  });
  const rangeLane = rangeLaneFromCandles(bundle.ES.candles);
  const deskSignals = createMarketDeskSignals({
    snapshot,
    intelligence,
    decision,
    plan,
    candle: deskCandleContextFromRange(rangeLane),
  });
  const structureLevels = createMarketStructureLevels({
    snapshot,
    candlesBySymbol: {
      ES: bundle.ES.candles,
      VIX: bundle.VIX.candles,
      DXY: bundle.DXY.candles,
      OIL: bundle.OIL.candles,
      QQQ: bundle.QQQ.candles,
      IXIC: bundle.IXIC.candles,
    },
  });
  const session = readSessionClock(new Date(now));
  const snapshotAge = formatSnapshotAge(snapshot.asOf, now);
  const customerWarnings = formatCustomerParticipationWarnings(
    decision.noTradeReasons,
    decision.dataQualityWarnings,
    plan.eventRiskWarnings.map((warning) => warning.code),
  );
  const decisionPresentation = buildDeskDecisionPresentation({
    decision,
    plan,
    signals: deskSignals,
    warnings: customerWarnings,
  });
  const initialWorkspace = createDefaultWorkspace("es");
  const active = getMarketInstrument(initialWorkspace.activeMarketId) ?? getMarketInstrument("es")!;
  const favourites = initialWorkspace.favourites
    .map((id) => getMarketInstrument(id))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
  const catalystRadar = createCatalystRadar({
    events: snapshot.events,
    active,
    favourites,
    now,
  });
  const edgeBriefByMarketId: TradingDeskPayload["edgeBriefByMarketId"] = {};
  for (const id of [active.id, ...initialWorkspace.favourites]) {
    const instrument = getMarketInstrument(id);
    if (!instrument) continue;
    const candle = isCandleInstrument(instrument.symbol) ? bundle[instrument.symbol] : null;
    edgeBriefByMarketId[instrument.id] = createEdgeBrief({
      instrument,
      snapshot,
      candle,
      structure: structureLevels.instruments.find((row) => row.symbol === instrument.symbol) ?? null,
      deskSignals,
      events: snapshot.events,
      session,
      snapshotAge,
    });
  }

  const freshnessFeeds: DeskFreshnessFeed[] = [
    {
      id: "snapshot",
      label: "Market snapshot",
      status: "DELAYED",
      ageLabel: snapshotAge,
      detail: "Illustrative private-preview snapshot — not live market data.",
    },
    ...CANDLE_INSTRUMENTS.map((instrument) =>
      mapCandleFreshness(bundle[instrument], `${instrument} candles`),
    ),
    {
      id: "calendar",
      label: "Economic calendar",
      status: "DELAYED",
      ageLabel: `${snapshot.events.length} example row`,
      detail: "Illustrative event row for private product presentation.",
    },
    {
      id: "news",
      label: "News intelligence",
      status: "UNAVAILABLE",
      ageLabel: "Unavailable",
      detail: "No verified news data connection is currently available.",
    },
    {
      id: "earnings",
      label: "Earnings calendar",
      status: "UNAVAILABLE",
      ageLabel: "Unavailable",
      detail: "No verified earnings data connection is currently available.",
    },
  ];

  const payload = sanitizeForClient({
    paid: true,
    tier: "elite",
    snapshot,
    gatewayStatus,
    marketState: terminalMarketState(snapshot.status, gatewayStatus.connectionStatus, gatewayStatus.fallbackActive),
    timestamp: formatUkTimestamp(snapshot.asOf),
    snapshotAge,
    candleSeriesByInstrument: bundle,
    structureLevels,
    deskSignals,
    session,
    edgeBriefByMarketId,
    catalystRadar,
    freshnessFeeds,
    customerWarnings,
    decisionPresentation,
    initialWorkspace,
    deskVideoShortcut: null,
    preview: {
      eligible: false,
      available: false,
      cadence: "weekly" as const,
    },
    macroContext: createUnavailableMacroContext(now),
  }) satisfies TradingDeskPayload;

  return (
    <MemberShell
      active="terminal"
      className="customerTerminal premiumTerminal terminalMemberPage tradingDeskPage marketingRealMemberPreview"
      toolbar={<div className="ctToolbar ctTopbar"><TerminalControls /></div>}
    >
      <aside className="dashPartialBanner" role="status">
        <strong>EXAMPLE-ONLY MEMBER EXPERIENCE</strong>
        <span>All figures, charts, levels and commentary on this private preview are illustrative — not live market data.</span>
      </aside>
      <div className="memberDashboardShell ctWorkspace deskWorkspaceShell" style={{ color: "#eef2f5" }}>
        <DeskErrorBoundary>
          <TradingDeskOS payload={payload} />
        </DeskErrorBoundary>
      </div>
    </MemberShell>
  );
}
