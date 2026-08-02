import type { MarketGatewayConnectionStatus } from "./live-market-gateway.ts";
import type { MarketDataStatus } from "./market-data.ts";
import type { MarketIntelligence, MissingDataWarning } from "./market-intelligence-engine.ts";
import type { TradingDecision } from "./trading-decision-engine.ts";

export type DirectionalPosture = "long-bias" | "short-bias" | "neutral" | "stand-aside";
export type ParticipationLevel = "none" | "very-small" | "small" | "normal";
export type PreferredSetupType = "trend-continuation" | "pullback" | "breakout" | "mean-reversion" | "fade" | "wait-for-confirmation" | "none";
export type ExecutionReadiness = "ready" | "conditional" | "not-ready";

export type UpcomingEventMetadata = {
  id: string;
  impact: "LOW" | "MEDIUM" | "HIGH";
  startsInMinutes: number | null;
  status: "UPCOMING" | "ACTIVE" | "COMPLETE";
};

export type TradePlannerInput = {
  decision: TradingDecision;
  intelligence: MarketIntelligence;
  dataStatus: MarketDataStatus;
  providerStatus: MarketGatewayConnectionStatus;
  dataAgeMs: number | null;
  fallbackActive: boolean;
  missingDataWarnings: MissingDataWarning[];
  upcomingEvents?: UpcomingEventMetadata[];
};

export type TradePlan = {
  schemaVersion: "1.0";
  directionalPosture: DirectionalPosture;
  participationLevel: ParticipationLevel;
  preferredSetupType: PreferredSetupType;
  executionReadiness: ExecutionReadiness;
  planConfidence: number;
  priorityChecklist: string[];
  requiredConfirmations: string[];
  invalidationConditions: Array<{ kind: string }>;
  eventRiskWarnings: Array<{ code: string; eventId: string; impact: UpcomingEventMetadata["impact"]; startsInMinutes: number | null }>;
  dataQualityWarnings: MissingDataWarning[];
  reasonsToRemainSidelined: string[];
  reviewTrigger: {
    kind: "RECALCULATE";
    conditions: string[];
  };
  provenance: {
    provider: string;
    asOf: string;
    dataStatus: MarketDataStatus;
    providerStatus: MarketGatewayConnectionStatus;
    dataAgeMs: number | null;
    fallbackActive: boolean;
  };
};

const MAX_DELAYED_AGE_MS = 30 * 60 * 1000;

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}

function uniqueWarnings(values: MissingDataWarning[]): MissingDataWarning[] {
  const seen = new Set<string>();
  return values.filter((warning) => {
    const key = `${warning.code}:${warning.field}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function criticalMissing(warnings: MissingDataWarning[]): boolean {
  return warnings.some((warning) =>
    (warning.code === "MISSING_QUOTE" && ["ES", "VIX", "US2Y", "US10Y", "DXY"].includes(warning.field)) ||
    (warning.code === "MISSING_EVIDENCE" && ["trend", "volatility"].includes(warning.field)) ||
    warning.code === "MISSING_LEVEL",
  );
}

function setupType(decision: TradingDecision): PreferredSetupType {
  if (decision.recommendedPosture === "trend-following") return "trend-continuation";
  if (decision.recommendedPosture === "breakout") return "breakout";
  if (decision.recommendedPosture === "pullback") return "pullback";
  if (decision.recommendedPosture === "mean-reversion") return "mean-reversion";
  if (decision.recommendedPosture === "fade") return "fade";
  return "none";
}

function eventWarnings(events: UpcomingEventMetadata[]): TradePlan["eventRiskWarnings"] {
  return events
    .filter((event) => event.status !== "COMPLETE" && event.impact === "HIGH")
    .map((event) => ({
      code: event.status === "ACTIVE" ? "HIGH_IMPACT_EVENT_ACTIVE" : "HIGH_IMPACT_EVENT_UPCOMING",
      eventId: event.id,
      impact: event.impact,
      startsInMinutes: event.startsInMinutes,
    }));
}

export function createStructuredTradePlan(input: TradePlannerInput): TradePlan {
  const events = input.upcomingEvents ?? [];
  const warnings = uniqueWarnings([...input.decision.dataQualityWarnings, ...input.missingDataWarnings]);
  const highImpactWarnings = eventWarnings(events);
  const imminentHighImpact = events.some((event) => event.impact === "HIGH" && event.status !== "COMPLETE" && (event.status === "ACTIVE" || event.startsInMinutes === null || event.startsInMinutes <= 15));
  const nearbyHighImpact = events.some((event) => event.impact === "HIGH" && event.status === "UPCOMING" && event.startsInMinutes !== null && event.startsInMinutes <= 60);
  const stale = input.dataAgeMs === null || input.dataAgeMs > MAX_DELAYED_AGE_MS;
  const providerUnavailable = input.providerStatus === "offline" || input.providerStatus === "not_configured";
  const incomplete = criticalMissing(warnings);
  const conflictCount = input.decision.conflictingDrivers.length;
  const failClosed = input.decision.tradePermission === "no-trade" || input.dataStatus === "PREVIEW" || input.dataStatus === "UNAVAILABLE" || stale || input.fallbackActive || providerUnavailable || incomplete || imminentHighImpact;

  const sidelined: string[] = [...input.decision.noTradeReasons];
  if (stale) sidelined.push(input.dataAgeMs === null ? "UNKNOWN_DATA_AGE" : "STALE_DATA");
  if (input.fallbackActive) sidelined.push("FALLBACK_ACTIVE");
  if (providerUnavailable) sidelined.push("PROVIDER_UNAVAILABLE");
  if (incomplete) sidelined.push("CRITICAL_INPUT_MISSING");
  if (imminentHighImpact) sidelined.push("IMMINENT_HIGH_IMPACT_EVENT");
  if (conflictCount >= 2) sidelined.push("MATERIAL_DRIVER_CONFLICT");

  let planConfidence = input.decision.confidenceScore;
  if (input.decision.tradePermission === "caution") planConfidence -= 10;
  if (conflictCount > 0) planConfidence -= Math.min(25, conflictCount * 10);
  if (input.decision.volatilityRegime === "elevated") planConfidence -= 15;
  if (input.decision.volatilityRegime === "extreme") planConfidence -= 30;
  if (nearbyHighImpact) planConfidence -= 15;
  if (warnings.length > 0) planConfidence -= Math.min(20, warnings.length * 4);
  if (failClosed) planConfidence = Math.min(planConfidence, 20);
  planConfidence = Math.max(0, Math.min(input.decision.confidenceScore, Math.round(planConfidence)));

  let directionalPosture: DirectionalPosture = input.decision.marketBias === "bullish"
    ? "long-bias"
    : input.decision.marketBias === "bearish"
      ? "short-bias"
      : "neutral";
  if (failClosed) directionalPosture = "stand-aside";

  let participationLevel: ParticipationLevel = "normal";
  if (failClosed || input.decision.volatilityRegime === "extreme") participationLevel = "none";
  else if (conflictCount > 0 || input.decision.volatilityRegime === "elevated" || nearbyHighImpact) participationLevel = "very-small";
  else if (input.decision.tradePermission === "caution" || planConfidence < 75) participationLevel = "small";

  let executionReadiness: ExecutionReadiness = "ready";
  if (failClosed) executionReadiness = "not-ready";
  else if (input.decision.tradePermission === "caution" || conflictCount > 0 || nearbyHighImpact || warnings.length > 0 || planConfidence < 70) executionReadiness = "conditional";

  let preferredSetupType = setupType(input.decision);
  if (failClosed) preferredSetupType = "none";
  else if (conflictCount > 0 || nearbyHighImpact) preferredSetupType = "wait-for-confirmation";

  const priorityChecklist = ["VERIFY_DATA_STATUS", "VERIFY_PROVIDER_STATUS", "VERIFY_WARNING_SET", "VERIFY_EVENT_WINDOW", "VERIFY_DECISION_STATE"];
  const requiredConfirmations = ["DATA_CURRENT", "PROVIDER_HEALTHY", "NO_CRITICAL_WARNINGS", "DECISION_PERMISSION_VALID"];
  if (conflictCount > 0) requiredConfirmations.push("DRIVER_CONFLICT_RESOLVED");
  if (highImpactWarnings.length > 0) requiredConfirmations.push("EVENT_WINDOW_CLEARED");
  if (input.decision.volatilityRegime === "elevated" || input.decision.volatilityRegime === "extreme") requiredConfirmations.push("VOLATILITY_REGIME_REASSESSED");

  return {
    schemaVersion: "1.0",
    directionalPosture,
    participationLevel,
    preferredSetupType,
    executionReadiness,
    planConfidence,
    priorityChecklist,
    requiredConfirmations: uniqueStrings(requiredConfirmations),
    invalidationConditions: input.decision.invalidationConditions.map((condition) => ({ kind: condition.kind })),
    eventRiskWarnings: highImpactWarnings,
    dataQualityWarnings: warnings,
    reasonsToRemainSidelined: uniqueStrings(sidelined),
    reviewTrigger: {
      kind: "RECALCULATE",
      conditions: ["PROVIDER_UPDATE", "DATA_STATUS_CHANGE", "DATA_AGE_THRESHOLD", "DECISION_CHANGE", "WARNING_SET_CHANGE", "EVENT_WINDOW_CHANGE"],
    },
    provenance: {
      provider: input.intelligence.source.provider,
      asOf: input.intelligence.source.asOf,
      dataStatus: input.dataStatus,
      providerStatus: input.providerStatus,
      dataAgeMs: input.dataAgeMs,
      fallbackActive: input.fallbackActive,
    },
  };
}
