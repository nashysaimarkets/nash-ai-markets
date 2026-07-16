import type { MarketDataStatus, MarketLevel, MarketQuote, MarketSnapshot } from "./market-data.ts";

export type IntelligenceScenarioType = "BULLISH" | "NEUTRAL" | "BEARISH";

export type IntelligenceScores = {
  riskOnRiskOff: number;
  marketSentiment: number;
  trend: number;
  volatility: number;
  bullseyeConfidence: number;
};

export type IntelligenceScenario = {
  type: IntelligenceScenarioType;
  probability: number;
  trigger: {
    kind: "ABOVE_RESISTANCE" | "INSIDE_RANGE" | "BELOW_SUPPORT";
    level: string | null;
  };
  invalidation: {
    kind: "BELOW_SUPPORT" | "OUTSIDE_RANGE" | "ABOVE_RESISTANCE";
    level: string | null;
  };
};

export type MarketIntelligence = {
  schemaVersion: "1.0";
  source: {
    provider: string;
    status: MarketDataStatus;
    asOf: string;
  };
  actionable: boolean;
  scores: IntelligenceScores;
  dominantScenario: IntelligenceScenarioType;
  scenarios: [IntelligenceScenario, IntelligenceScenario, IntelligenceScenario];
};

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));
const round = (value: number) => Math.round(clamp(value));

function evidence(snapshot: MarketSnapshot, key: string, fallback = 50): number {
  const value = snapshot.evidence[key];
  return typeof value === "number" && Number.isFinite(value) ? clamp(value) : fallback;
}

function quote(snapshot: MarketSnapshot, symbol: string): MarketQuote | undefined {
  return snapshot.quotes.find((candidate) => candidate.symbol === symbol);
}

function directionScore(value: MarketQuote | undefined): number {
  return value?.direction === "up" ? 65 : value?.direction === "down" ? 35 : 50;
}

function numericQuoteValue(value: MarketQuote | undefined): number | null {
  if (!value) return null;
  const parsed = Number.parseFloat(value.value.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function vixScore(snapshot: MarketSnapshot): number {
  const value = numericQuoteValue(quote(snapshot, "VIX"));
  return value === null ? 50 : clamp((value - 10) * 4);
}

function statusQuality(status: MarketDataStatus): number {
  if (status === "LIVE") return 1;
  if (status === "DELAYED") return 0.75;
  if (status === "PREVIEW") return 0.25;
  return 0;
}

function primaryLevel(levels: MarketLevel[], type: "support" | "resistance"): string | null {
  const prefix = type === "support" ? "S" : "R";
  const labelled = levels
    .filter((level) => level.type === type)
    .map((level) => ({ level, order: Number.parseInt(level.label.replace(new RegExp(`^${prefix}`, "i"), ""), 10) }))
    .filter((candidate) => Number.isFinite(candidate.order))
    .sort((left, right) => left.order - right.order)[0]?.level;
  if (labelled) return labelled.value;

  const numeric = levels
    .filter((level) => level.type === type)
    .map((level) => ({ level, value: Number.parseFloat(level.value.replace(/[^0-9.-]/g, "")) }))
    .filter((candidate) => Number.isFinite(candidate.value))
    .sort((left, right) => type === "support" ? right.value - left.value : left.value - right.value)[0]?.level;
  return numeric?.value ?? null;
}

function probabilities(composite: number): { bullish: number; neutral: number; bearish: number } {
  const bullishRaw = clamp(composite);
  const bearishRaw = 100 - bullishRaw;
  const neutralRaw = clamp(60 - Math.abs(composite - 50) * 2, 10, 60);
  const total = bullishRaw + neutralRaw + bearishRaw;
  const bullish = Math.round((bullishRaw / total) * 100);
  const neutral = Math.round((neutralRaw / total) * 100);
  return { bullish, neutral, bearish: 100 - bullish - neutral };
}

export function analyzeMarketSnapshot(snapshot: MarketSnapshot): MarketIntelligence {
  const trend = round(evidence(snapshot, "trend") * 0.65 + evidence(snapshot, "momentum") * 0.2 + directionScore(quote(snapshot, "ES")) * 0.15);
  const volatility = round(evidence(snapshot, "volatility") * 0.55 + vixScore(snapshot) * 0.45);
  const marketSentiment = round(trend * 0.35 + evidence(snapshot, "momentum") * 0.25 + evidence(snapshot, "breadth") * 0.25 + (100 - volatility) * 0.15);
  const riskOnRiskOff = round(
    directionScore(quote(snapshot, "ES")) * 0.25 +
    (100 - vixScore(snapshot)) * 0.25 +
    (100 - directionScore(quote(snapshot, "DXY"))) * 0.15 +
    evidence(snapshot, "breadth") * 0.2 +
    evidence(snapshot, "macro") * 0.15,
  );

  const directionalVolatility = 100 - volatility;
  const orientedSignals = [riskOnRiskOff, marketSentiment, trend, directionalVolatility];
  const composite = orientedSignals.reduce((sum, value) => sum + value, 0) / orientedSignals.length;
  const dispersion = orientedSignals.reduce((sum, value) => sum + Math.abs(value - composite), 0) / orientedSignals.length;
  const strength = Math.abs(composite - 50) * 2;
  const bullseyeConfidence = round(((100 - dispersion) * 0.4 + strength * 0.6) * statusQuality(snapshot.status));
  const scenarioProbabilities = probabilities(composite);
  const actionable = snapshot.status === "LIVE" || snapshot.status === "DELAYED";
  const probabilitiesForStatus = actionable
    ? scenarioProbabilities
    : { bullish: 0, neutral: 100, bearish: 0 };
  const support = primaryLevel(snapshot.levels, "support");
  const resistance = primaryLevel(snapshot.levels, "resistance");
  const scenarios: MarketIntelligence["scenarios"] = [
    { type: "BULLISH", probability: probabilitiesForStatus.bullish, trigger: { kind: "ABOVE_RESISTANCE", level: resistance }, invalidation: { kind: "BELOW_SUPPORT", level: support } },
    { type: "NEUTRAL", probability: probabilitiesForStatus.neutral, trigger: { kind: "INSIDE_RANGE", level: null }, invalidation: { kind: "OUTSIDE_RANGE", level: null } },
    { type: "BEARISH", probability: probabilitiesForStatus.bearish, trigger: { kind: "BELOW_SUPPORT", level: support }, invalidation: { kind: "ABOVE_RESISTANCE", level: resistance } },
  ];
  const dominantScenario = scenarios.reduce((dominant, scenario) => scenario.probability > dominant.probability ? scenario : dominant).type;

  return {
    schemaVersion: "1.0",
    source: { provider: snapshot.source, status: snapshot.status, asOf: snapshot.asOf },
    actionable,
    scores: { riskOnRiskOff, marketSentiment, trend, volatility, bullseyeConfidence },
    dominantScenario,
    scenarios,
  };
}
