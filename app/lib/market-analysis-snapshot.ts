import { createHash } from "node:crypto";
import type { MarketSnapshot } from "./market-data.ts";
import type { MarketIntelligence } from "./market-intelligence-engine.ts";
import type { TradingDecision } from "./trading-decision-engine.ts";
import type { TradePlan } from "./structured-trade-planner.ts";
import type { MarketGatewayStatus } from "./live-market-gateway.ts";

export const METHODOLOGY_VERSION = "bullseye-analysis-1.1.0";

export type SnapshotKind = "morning" | "refresh" | "close" | "provider_change";

export type AnalysisSnapshotPayload = {
  version: typeof METHODOLOGY_VERSION;
  generatedAt: string;
  sessionDate: string;
  kind: SnapshotKind;
  market: {
    status: MarketSnapshot["status"];
    asOf: string;
    source: string;
    quotes: MarketSnapshot["quotes"];
    levels: MarketSnapshot["levels"];
    events: MarketSnapshot["events"];
    evidence: MarketSnapshot["evidence"];
  };
  scores: MarketIntelligence["scores"];
  decision: {
    marketBias: TradingDecision["marketBias"];
    riskRating: TradingDecision["riskRating"];
    tradePermission: TradingDecision["tradePermission"];
    volatilityRegime: TradingDecision["volatilityRegime"];
    confidenceScore: number;
    noTradeReasons: TradingDecision["noTradeReasons"];
    invalidationConditions: TradingDecision["invalidationConditions"];
    topSupportingDrivers: TradingDecision["topSupportingDrivers"];
    conflictingDrivers: TradingDecision["conflictingDrivers"];
  };
  plan: {
    directionalPosture: TradePlan["directionalPosture"];
    executionReadiness: TradePlan["executionReadiness"];
    preferredSetupType: TradePlan["preferredSetupType"];
    participationLevel: TradePlan["participationLevel"];
    requiredConfirmations: TradePlan["requiredConfirmations"];
    eventRiskWarnings: TradePlan["eventRiskWarnings"];
  };
  scenarios: MarketIntelligence["scenarios"];
  gateway: {
    connectionStatus: MarketGatewayStatus["connectionStatus"];
    dataAgeMs: number | null;
    fallbackActive: boolean;
  };
  candleRefs: {
    rangeHigh: number | null;
    rangeLow: number | null;
    firstClose: number | null;
    ema20: number | null;
    ema50: number | null;
    latest: number | null;
  } | null;
  generationMode: "deterministic" | "ai-assisted";
};

export type StoredAnalysisSnapshot = {
  id: string;
  session_date: string;
  kind: SnapshotKind;
  content_hash: string;
  methodology_version: string;
  data_quality: string;
  provider_health: string;
  bullseye_score: number | null;
  posture: string | null;
  risk_rating: string | null;
  trade_permission: string | null;
  volatility_regime: string | null;
  payload: AnalysisSnapshotPayload;
  created_at: string;
};

function sessionDateUtc(iso: string): string {
  const ms = Date.parse(iso);
  const date = Number.isFinite(ms) ? new Date(ms) : new Date();
  return date.toISOString().slice(0, 10);
}

function dataQuality(status: MarketSnapshot["status"]): StoredAnalysisSnapshot["data_quality"] {
  if (status === "LIVE") return "live";
  if (status === "DELAYED") return "delayed";
  if (status === "PREVIEW") return "stale";
  return "unavailable";
}

export function buildAnalysisSnapshot(input: {
  snapshot: MarketSnapshot;
  intelligence: MarketIntelligence;
  decision: TradingDecision;
  plan: TradePlan;
  gateway: MarketGatewayStatus;
  kind?: SnapshotKind;
  candleRefs?: AnalysisSnapshotPayload["candleRefs"];
  generationMode?: "deterministic" | "ai-assisted";
  nowIso?: string;
}): { payload: AnalysisSnapshotPayload; contentHash: string; row: Omit<StoredAnalysisSnapshot, "id" | "created_at"> } {
  const generatedAt = input.nowIso ?? new Date().toISOString();
  const kind = input.kind ?? "refresh";
  const payload: AnalysisSnapshotPayload = {
    version: METHODOLOGY_VERSION,
    generatedAt,
    sessionDate: sessionDateUtc(input.snapshot.asOf || generatedAt),
    kind,
    market: {
      status: input.snapshot.status,
      asOf: input.snapshot.asOf,
      source: input.snapshot.source,
      quotes: input.snapshot.quotes,
      levels: input.snapshot.levels,
      events: input.snapshot.events,
      evidence: input.snapshot.evidence,
    },
    scores: input.intelligence.scores,
    decision: {
      marketBias: input.decision.marketBias,
      riskRating: input.decision.riskRating,
      tradePermission: input.decision.tradePermission,
      volatilityRegime: input.decision.volatilityRegime,
      confidenceScore: input.decision.confidenceScore,
      noTradeReasons: input.decision.noTradeReasons,
      invalidationConditions: input.decision.invalidationConditions,
      topSupportingDrivers: input.decision.topSupportingDrivers,
      conflictingDrivers: input.decision.conflictingDrivers,
    },
    plan: {
      directionalPosture: input.plan.directionalPosture,
      executionReadiness: input.plan.executionReadiness,
      preferredSetupType: input.plan.preferredSetupType,
      participationLevel: input.plan.participationLevel,
      requiredConfirmations: input.plan.requiredConfirmations,
      eventRiskWarnings: input.plan.eventRiskWarnings,
    },
    scenarios: input.intelligence.scenarios,
    gateway: {
      connectionStatus: input.gateway.connectionStatus,
      dataAgeMs: input.gateway.dataAgeMs,
      fallbackActive: input.gateway.fallbackActive,
    },
    candleRefs: input.candleRefs ?? null,
    generationMode: input.generationMode ?? "deterministic",
  };
  const contentHash = createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 32);
  return {
    payload,
    contentHash,
    row: {
      session_date: payload.sessionDate,
      kind,
      content_hash: contentHash,
      methodology_version: METHODOLOGY_VERSION,
      data_quality: dataQuality(input.snapshot.status),
      provider_health: input.gateway.connectionStatus,
      bullseye_score: Math.round(input.decision.confidenceScore),
      posture: input.plan.directionalPosture,
      risk_rating: input.decision.riskRating,
      trade_permission: input.decision.tradePermission,
      volatility_regime: input.decision.volatilityRegime,
      payload,
    },
  };
}

/** Compare two stored payloads for “what changed” without inventing values. */
export function diffSnapshots(previous: AnalysisSnapshotPayload | null, current: AnalysisSnapshotPayload) {
  const find = (payload: AnalysisSnapshotPayload, symbol: string) => payload.market.quotes.find((q) => q.symbol === symbol);
  const quoteChange = (symbol: string) => {
    const a = previous ? find(previous, symbol) : null;
    const b = find(current, symbol);
    return {
      symbol,
      from: a?.value ?? null,
      to: b?.value ?? null,
      fromChange: a?.change ?? null,
      toChange: b?.change ?? null,
      changed: Boolean(a && b && (a.value !== b.value || a.change !== b.change)),
    };
  };
  return {
    hasPrevious: Boolean(previous),
    quotes: ["ES", "VIX", "US2Y", "US10Y", "DXY"].map(quoteChange),
    score: { from: previous?.decision.confidenceScore ?? null, to: current.decision.confidenceScore },
    posture: { from: previous?.plan.directionalPosture ?? null, to: current.plan.directionalPosture },
    risk: { from: previous?.decision.riskRating ?? null, to: current.decision.riskRating },
    permission: { from: previous?.decision.tradePermission ?? null, to: current.decision.tradePermission },
    dataQuality: { from: previous?.market.status ?? null, to: current.market.status },
    provider: { from: previous?.gateway.connectionStatus ?? null, to: current.gateway.connectionStatus },
  };
}
