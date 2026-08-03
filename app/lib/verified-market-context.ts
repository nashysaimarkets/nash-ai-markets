/**
 * Shared verified-market orchestration for Dashboard, Morning Brief and Desk.
 * Isolates independent sources, returns partial context when safe, never invents values.
 */

import { analyzeMarketSnapshot, type MarketIntelligence } from "./market-intelligence-engine.ts";
import {
  createUnavailableSnapshot,
  formatSnapshotAge,
  isDecisionReadySnapshot,
  type MarketSnapshot,
} from "./market-data.ts";
import { createTradingDecision, type TradingDecision } from "./trading-decision-engine.ts";
import { createStructuredTradePlan, type TradePlan } from "./structured-trade-planner.ts";
import {
  getConfiguredFmpCandlesForInstruments,
  toCustomerCandleSeries,
  type CustomerCandleSeries,
  type VerifiedCandleSeries,
} from "./providers/financial-modeling-prep-candles.ts";
import type { CandleInstrument } from "./providers/candle-instruments.ts";
import {
  createUnconfiguredMarketGatewayStatus,
  type MarketGatewayStatus,
} from "./live-market-gateway.ts";
import { getTerminalMarketData } from "../terminal/lib/terminal-market-data-provider.ts";
import { readSessionClock, type SessionClockReading } from "../terminal/lib/session-clock.ts";
import { formatCustomerParticipationWarnings } from "../terminal/lib/customer-warnings.ts";
import { formatMembershipAwareMarketDataDisplay } from "./freshness-labels.ts";
import { sanitizeForClient } from "./serialize-for-client.ts";

export type VerifiedMarketContextStatus = "complete" | "partial" | "unavailable";

export type VerifiedMarketContext = {
  status: VerifiedMarketContextStatus;
  generatedAt: string;
  primaryMarket: "ES";
  session: SessionClockReading;
  freshness: {
    snapshotAge: string;
    candleAgeMs: number | null;
    delayedLabel: string;
    snapshotStatus: MarketSnapshot["status"];
  };
  snapshot: MarketSnapshot;
  gatewayStatus: MarketGatewayStatus;
  candles: CustomerCandleSeries | null;
  candleBundle: Record<CandleInstrument, VerifiedCandleSeries> | null;
  intelligence: MarketIntelligence;
  decision: TradingDecision;
  plan: TradePlan;
  verified: boolean;
  warnings: string[];
  missingInputs: string[];
  provenance: string;
  correlationId: string;
  diagnostics: {
    route?: string;
    snapshotOk: boolean;
    candlesOk: boolean;
    durationMs: number;
  };
};

function newCorrelationId(): string {
  return `vmc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function logContextDiagnostic(payload: Record<string, unknown>): void {
  try {
    console.info("[verified-market-context]", JSON.stringify(payload));
  } catch {
    // never throw from diagnostics
  }
}

export async function getVerifiedMarketContext(input: {
  paid: boolean;
  now?: number;
  route?: string;
  timeframe?: "1m" | "5m" | "15m" | "1h" | "4h" | "1d";
}): Promise<VerifiedMarketContext> {
  const started = Date.now();
  const now = input.now ?? Date.now();
  const correlationId = newCorrelationId();
  const session = readSessionClock(new Date(now));
  const timeframe = input.timeframe ?? "5m";

  const settled = await Promise.allSettled([
    getTerminalMarketData(),
    input.paid
      ? getConfiguredFmpCandlesForInstruments(timeframe)
      : Promise.resolve(null),
  ]);

  const snapshotResult = settled[0];
  const candlesResult = settled[1];

  let snapshot: MarketSnapshot;
  let gatewayStatus: MarketGatewayStatus;
  let snapshotOk = false;

  if (snapshotResult.status === "fulfilled") {
    snapshot = snapshotResult.value.snapshot;
    gatewayStatus = snapshotResult.value.gatewayStatus;
    snapshotOk = true;
  } else {
    logContextDiagnostic({
      correlationId,
      route: input.route ?? null,
      stage: "snapshot",
      status: "rejected",
      message: snapshotResult.reason instanceof Error ? snapshotResult.reason.name : "snapshot_failed",
    });
    snapshot = createUnavailableSnapshot();
    gatewayStatus = createUnconfiguredMarketGatewayStatus("Verified market context recovery");
  }

  let candleBundle: Record<CandleInstrument, VerifiedCandleSeries> | null = null;
  let candlesOk = false;
  if (candlesResult.status === "fulfilled") {
    candleBundle = candlesResult.value;
    candlesOk = Boolean(candleBundle);
  } else {
    logContextDiagnostic({
      correlationId,
      route: input.route ?? null,
      stage: "candles",
      status: "rejected",
      message: candlesResult.reason instanceof Error ? candlesResult.reason.name : "candles_failed",
    });
  }

  const candles = candleBundle ? toCustomerCandleSeries(candleBundle.ES) : null;
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

  const verified = isDecisionReadySnapshot(snapshot) && intelligence.actionable;
  const warnings = formatCustomerParticipationWarnings(
    decision.noTradeReasons,
    decision.dataQualityWarnings,
    plan.eventRiskWarnings.map((warning) => warning.code),
  );

  const missingInputs: string[] = [];
  if (!snapshotOk || snapshot.status === "UNAVAILABLE") missingInputs.push("Verified market snapshot");
  if (input.paid && !candles?.candles?.length) missingInputs.push("Verified ES candles");
  if (!snapshot.events.length) missingInputs.push("Upcoming economic calendar rows");
  if (!snapshot.quotes.some((quote) => quote.symbol === "VIX")) missingInputs.push("VIX quote");
  if (!snapshot.quotes.some((quote) => quote.symbol === "DXY")) missingInputs.push("DXY quote");

  let status: VerifiedMarketContextStatus = "unavailable";
  if (verified && snapshotOk) status = candlesOk || !input.paid ? "complete" : "partial";
  else if (snapshotOk && (snapshot.quotes.length > 0 || snapshot.events.length > 0)) status = "partial";
  else if (snapshotOk) status = "partial";

  const context: VerifiedMarketContext = {
    status,
    generatedAt: new Date(now).toISOString(),
    primaryMarket: "ES",
    session,
    freshness: {
      snapshotAge: formatSnapshotAge(snapshot.asOf),
      candleAgeMs: candles?.dataAgeMs ?? null,
      delayedLabel: formatMembershipAwareMarketDataDisplay({
        candleAgeMs: candles?.dataAgeMs ?? null,
        candleAccess: input.paid,
        quoteAvailable: snapshot.quotes.some((quote) => quote.symbol === "ES"),
      }),
      snapshotStatus: snapshot.status,
    },
    snapshot,
    gatewayStatus,
    candles,
    candleBundle,
    intelligence,
    decision,
    plan,
    verified,
    warnings,
    missingInputs,
    provenance: snapshot.source || "Verified provider",
    correlationId,
    diagnostics: {
      route: input.route,
      snapshotOk,
      candlesOk,
      durationMs: Date.now() - started,
    },
  };

  logContextDiagnostic({
    correlationId,
    route: input.route ?? null,
    status,
    verified,
    snapshotOk,
    candlesOk,
    durationMs: context.diagnostics.durationMs,
    missingCount: missingInputs.length,
  });

  return sanitizeForClient(context);
}
