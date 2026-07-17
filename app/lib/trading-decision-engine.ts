import type { MarketGatewayConnectionStatus } from "./live-market-gateway.ts";
import type { MarketDataStatus } from "./market-data.ts";
import type { MarketIntelligence, MissingDataWarning } from "./market-intelligence-engine.ts";

export type MarketBias = "bullish" | "neutral" | "bearish";
export type RiskRating = "low" | "medium" | "high" | "extreme";
export type RecommendedPosture = "trend-following" | "breakout" | "pullback" | "mean-reversion" | "fade" | "stand-aside";
export type VolatilityRegime = "compressed" | "normal" | "elevated" | "extreme";
export type TradePermission = "actionable" | "caution" | "no-trade";

export type DecisionEngineInput = {
  intelligence: MarketIntelligence;
  reasoning: MarketIntelligence["reasoning"];
  dataStatus: MarketDataStatus;
  providerStatus: MarketGatewayConnectionStatus;
  dataAgeMs: number | null;
  fallbackActive: boolean;
  missingDataWarnings: MissingDataWarning[];
};

export type DecisionDriver = {
  factor: string;
  score: number;
  contribution: number;
};

export type InvalidationCondition = {
  kind: "BELOW_SUPPORT" | "ABOVE_RESISTANCE" | "OUTSIDE_RANGE" | "CONFIDENCE_BELOW" | "DATA_QUALITY_FAILURE";
  level?: string;
  threshold?: number;
};

export type TradingDecision = {
  schemaVersion: "1.0";
  marketBias: MarketBias;
  confidenceScore: number;
  riskRating: RiskRating;
  recommendedPosture: RecommendedPosture;
  volatilityRegime: VolatilityRegime;
  tradePermission: TradePermission;
  topSupportingDrivers: DecisionDriver[];
  conflictingDrivers: DecisionDriver[];
  invalidationConditions: InvalidationCondition[];
  noTradeReasons: string[];
  dataQualityWarnings: MissingDataWarning[];
};

const MAX_DELAYED_AGE_MS = 30 * 60 * 1000;
const MAX_LIVE_AGE_MS = 5 * 60 * 1000;
const clamp = (value: number) => Math.min(100, Math.max(0, Math.round(value)));

function volatilityRegime(score: number): VolatilityRegime {
  if (score >= 85) return "extreme";
  if (score >= 65) return "elevated";
  if (score <= 30) return "compressed";
  return "normal";
}

function baseBias(intelligence: MarketIntelligence): MarketBias {
  if (intelligence.dominantScenario === "BULLISH") return "bullish";
  if (intelligence.dominantScenario === "BEARISH") return "bearish";
  return "neutral";
}

function orientedDrivers(intelligence: MarketIntelligence): DecisionDriver[] {
  return [
    { factor: "RISK_ON_RISK_OFF", score: intelligence.scores.riskOnRiskOff, contribution: intelligence.scores.riskOnRiskOff - 50 },
    { factor: "MARKET_SENTIMENT", score: intelligence.scores.marketSentiment, contribution: intelligence.scores.marketSentiment - 50 },
    { factor: "TREND", score: intelligence.scores.trend, contribution: intelligence.scores.trend - 50 },
    { factor: "INVERSE_VOLATILITY", score: 100 - intelligence.scores.volatility, contribution: 50 - intelligence.scores.volatility },
  ];
}

function driverGroups(drivers: DecisionDriver[], bias: MarketBias) {
  const supports = (driver: DecisionDriver) => bias === "bullish"
    ? driver.score > 55
    : bias === "bearish"
      ? driver.score < 45
      : Math.abs(driver.score - 50) <= 10;
  const conflicts = (driver: DecisionDriver) => bias === "bullish"
    ? driver.score < 45
    : bias === "bearish"
      ? driver.score > 55
      : Math.abs(driver.score - 50) > 20;
  const magnitude = (driver: DecisionDriver) => Math.abs(driver.contribution);
  return {
    supporting: drivers.filter(supports).sort((left, right) => magnitude(right) - magnitude(left)).slice(0, 3),
    conflicting: drivers.filter(conflicts).sort((left, right) => magnitude(right) - magnitude(left)),
  };
}

function uniqueWarnings(warnings: MissingDataWarning[]): MissingDataWarning[] {
  const seen = new Set<string>();
  return warnings.filter((warning) => {
    const key = `${warning.code}:${warning.field}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function criticalMissing(warnings: MissingDataWarning[]): boolean {
  return warnings.some((warning) =>
    (warning.code === "MISSING_QUOTE" && ["ES", "VIX"].includes(warning.field)) ||
    (warning.code === "MISSING_EVIDENCE" && ["trend", "volatility"].includes(warning.field)) ||
    (warning.code === "MISSING_LEVEL" && ["support", "resistance"].includes(warning.field)),
  );
}

function invalidations(intelligence: MarketIntelligence, failClosed: boolean): InvalidationCondition[] {
  if (failClosed) return [{ kind: "DATA_QUALITY_FAILURE" }];
  const scenario = intelligence.scenarios.find((candidate) => candidate.type === intelligence.dominantScenario);
  const conditions: InvalidationCondition[] = [{ kind: "CONFIDENCE_BELOW", threshold: 35 }];
  if (scenario?.invalidation.kind === "BELOW_SUPPORT" && scenario.invalidation.level) {
    conditions.unshift({ kind: "BELOW_SUPPORT", level: scenario.invalidation.level });
  } else if (scenario?.invalidation.kind === "ABOVE_RESISTANCE" && scenario.invalidation.level) {
    conditions.unshift({ kind: "ABOVE_RESISTANCE", level: scenario.invalidation.level });
  } else if (scenario?.invalidation.kind === "OUTSIDE_RANGE") {
    conditions.unshift({ kind: "OUTSIDE_RANGE" });
  }
  return conditions;
}

function riskRating(regime: VolatilityRegime, riskOnScore: number, treasuryScore: number, dollarScore: number): RiskRating {
  if (regime === "extreme") return "extreme";
  const riskOffInputs = [riskOnScore, treasuryScore, dollarScore].filter((score) => score < 40).length;
  if (regime === "elevated" || riskOffInputs >= 2) return "high";
  if (regime === "compressed" && riskOffInputs === 0) return "low";
  return "medium";
}

function posture(bias: MarketBias, permission: TradePermission, regime: VolatilityRegime, trend: number): RecommendedPosture {
  if (permission === "no-trade" || regime === "extreme") return "stand-aside";
  if (bias === "neutral") return regime === "elevated" ? "fade" : "mean-reversion";
  if (regime === "compressed") return "breakout";
  const alignedTrend = bias === "bullish" ? trend >= 70 : trend <= 30;
  if (alignedTrend) return "trend-following";
  return "pullback";
}

export function createTradingDecision(input: DecisionEngineInput): TradingDecision {
  const stale = input.dataAgeMs === null || input.dataAgeMs > MAX_DELAYED_AGE_MS;
  const delayedAge = input.dataAgeMs !== null && input.dataAgeMs > MAX_LIVE_AGE_MS;
  const unavailable = input.dataStatus === "UNAVAILABLE" || input.providerStatus === "offline" || input.providerStatus === "not_configured";
  const contextWarnings: MissingDataWarning[] = [];
  if (input.dataAgeMs === null) contextWarnings.push({ code: "UNKNOWN_DATA_AGE", field: "dataAgeMs" });
  else if (stale) contextWarnings.push({ code: "STALE_DATA", field: "dataAgeMs" });
  else if (delayedAge) contextWarnings.push({ code: "AGED_DATA", field: "dataAgeMs" });
  if (input.dataStatus !== "LIVE") contextWarnings.push({ code: `${input.dataStatus}_DATA`, field: "dataStatus" });
  if (input.providerStatus !== "connected") contextWarnings.push({ code: "PROVIDER_DEGRADED", field: "providerStatus" });
  if (input.fallbackActive) contextWarnings.push({ code: "FALLBACK_ACTIVE", field: "providerStatus" });
  const warnings = uniqueWarnings([...input.reasoning.missingDataWarnings, ...input.missingDataWarnings, ...contextWarnings]);
  const nonCurrent = input.dataStatus === "PREVIEW" || stale || unavailable || input.fallbackActive;
  const incomplete = criticalMissing(warnings);
  const failClosed = nonCurrent || incomplete || !input.intelligence.actionable;
  const initialBias = baseBias(input.intelligence);
  const drivers = orientedDrivers(input.intelligence);
  const bullishSignals = drivers.filter((driver) => driver.score > 60).length;
  const bearishSignals = drivers.filter((driver) => driver.score < 40).length;
  const materiallyConflicting = bullishSignals > 0 && bearishSignals > 0;
  const severelyConflicting = bullishSignals >= 2 && bearishSignals >= 2;
  const regime = volatilityRegime(input.intelligence.scores.volatility);

  let confidence = input.intelligence.scores.bullseyeConfidence;
  if (input.dataStatus === "DELAYED" || delayedAge) confidence -= 15;
  if (input.providerStatus === "degraded") confidence -= 10;
  if (warnings.length > 0) confidence -= Math.min(25, warnings.length * 5);
  if (materiallyConflicting) confidence -= 20;
  if (input.fallbackActive) confidence = 0;
  if (failClosed) confidence = Math.min(confidence, 20);
  confidence = clamp(confidence);

  const noTradeReasons: string[] = [];
  if (input.dataStatus === "PREVIEW") noTradeReasons.push("PREVIEW_DATA");
  if (input.dataStatus === "UNAVAILABLE") noTradeReasons.push("UNAVAILABLE_DATA");
  if (stale) noTradeReasons.push(input.dataAgeMs === null ? "UNKNOWN_DATA_AGE" : "STALE_DATA");
  if (input.fallbackActive) noTradeReasons.push("FALLBACK_ACTIVE");
  if (unavailable) noTradeReasons.push("PROVIDER_OFFLINE");
  if (incomplete) noTradeReasons.push("CRITICAL_INPUT_MISSING");
  if (severelyConflicting) noTradeReasons.push("SEVERE_SIGNAL_CONFLICT");
  if (regime === "extreme") noTradeReasons.push("EXTREME_VOLATILITY");
  if (confidence < 35) noTradeReasons.push("LOW_CONFIDENCE");

  const permission: TradePermission = failClosed || severelyConflicting || regime === "extreme" || confidence < 35
    ? "no-trade"
    : materiallyConflicting || input.dataStatus === "DELAYED" || input.providerStatus === "degraded" || warnings.length > 0 || confidence < 65 || regime === "elevated"
      ? "caution"
      : "actionable";
  const bias = permission === "no-trade" && (failClosed || severelyConflicting) ? "neutral" : initialBias;
  const groupedDrivers = driverGroups(drivers, bias);
  const rating = riskRating(regime, input.intelligence.scores.riskOnRiskOff, input.reasoning.treasuryImpact.normalizedScore, input.reasoning.dollarImpact.normalizedScore);

  return {
    schemaVersion: "1.0",
    marketBias: bias,
    confidenceScore: confidence,
    riskRating: rating,
    recommendedPosture: posture(bias, permission, regime, input.intelligence.scores.trend),
    volatilityRegime: regime,
    tradePermission: permission,
    topSupportingDrivers: groupedDrivers.supporting,
    conflictingDrivers: groupedDrivers.conflicting,
    invalidationConditions: invalidations(input.intelligence, failClosed),
    noTradeReasons: [...new Set(noTradeReasons)],
    dataQualityWarnings: warnings,
  };
}
