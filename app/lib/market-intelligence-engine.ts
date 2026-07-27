import type { MarketDataStatus, MarketLevel, MarketQuote, MarketSnapshot } from "./market-data.ts";

export type IntelligenceScenarioType = "BULLISH" | "NEUTRAL" | "BEARISH";

export type IntelligenceScores = {
  riskOnRiskOff: number;
  marketSentiment: number;
  trend: number;
  volatility: number;
  bullseyeConfidence: number;
};

export type ScoreDriver = {
  factor: string;
  rawValue: number | null;
  normalizedScore: number;
  weight: number;
  contribution: number;
};

export type StructuredImpact = {
  availability: "AVAILABLE" | "PARTIAL" | "MISSING";
  normalizedScore: number;
  inputs: Array<{ factor: string; value: number | null; direction: MarketQuote["direction"] | "missing" }>;
};

export type MissingDataWarning = {
  code: string;
  field: string;
};

export type ScenarioEvidence = {
  factor: string;
  score: number;
  relation: "SUPPORTS" | "NEUTRAL" | "OPPOSES";
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
  evidence: ScenarioEvidence[];
};

export type MarketIntelligence = {
  schemaVersion: "1.1";
  source: {
    provider: string;
    status: MarketDataStatus;
    asOf: string;
  };
  actionable: boolean;
  scores: IntelligenceScores;
  reasoning: {
    overallConfidence: {
      score: number;
      dataQuality: number;
      compositeScore: number;
      dispersion: number;
      directionalStrength: number;
      inputs: ScoreDriver[];
    };
    riskDrivers: ScoreDriver[];
    sentimentDrivers: ScoreDriver[];
    trendDrivers: ScoreDriver[];
    volatilityDrivers: ScoreDriver[];
    treasuryImpact: StructuredImpact;
    dollarImpact: StructuredImpact;
    vixImpact: StructuredImpact;
    missingDataWarnings: MissingDataWarning[];
  };
  dominantScenario: IntelligenceScenarioType;
  scenarios: [IntelligenceScenario, IntelligenceScenario, IntelligenceScenario];
};

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));
const round = (value: number) => Math.round(clamp(value));

function evidence(snapshot: MarketSnapshot, key: string, fallback = 50): number {
  const value = snapshot.evidence[key];
  return typeof value === "number" && Number.isFinite(value) ? clamp(value) : fallback;
}

function rawEvidence(snapshot: MarketSnapshot, key: string): number | null {
  const value = snapshot.evidence[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
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

function weightedDriver(factor: string, rawValue: number | null, normalizedScore: number, weight: number): ScoreDriver {
  return {
    factor,
    rawValue,
    normalizedScore: round(normalizedScore),
    weight,
    contribution: Math.round(normalizedScore * weight * 100) / 100,
  };
}

function weightedScore(drivers: ScoreDriver[]): number {
  return round(drivers.reduce((sum, driver) => sum + driver.contribution, 0));
}

function treasuryImpact(snapshot: MarketSnapshot): StructuredImpact {
  const twoYear = quote(snapshot, "US2Y");
  const tenYear = quote(snapshot, "US10Y");
  const available = [twoYear, tenYear].filter(Boolean).length;
  const normalizedScore = round(((100 - directionScore(twoYear)) + (100 - directionScore(tenYear))) / 2);
  return {
    availability: available === 2 ? "AVAILABLE" : available === 1 ? "PARTIAL" : "MISSING",
    normalizedScore,
    inputs: [
      { factor: "US2Y", value: numericQuoteValue(twoYear), direction: twoYear?.direction ?? "missing" },
      { factor: "US10Y", value: numericQuoteValue(tenYear), direction: tenYear?.direction ?? "missing" },
    ],
  };
}

function quoteImpact(snapshot: MarketSnapshot, symbol: "DXY" | "VIX", normalizedScore: number): StructuredImpact {
  const value = quote(snapshot, symbol);
  return {
    availability: value ? "AVAILABLE" : "MISSING",
    normalizedScore: round(normalizedScore),
    inputs: [{ factor: symbol, value: numericQuoteValue(value), direction: value?.direction ?? "missing" }],
  };
}

function missingDataWarnings(snapshot: MarketSnapshot): MissingDataWarning[] {
  const warnings: MissingDataWarning[] = [];
  for (const symbol of ["ES", "VIX", "US2Y", "US10Y", "DXY"]) {
    if (!quote(snapshot, symbol)) warnings.push({ code: "MISSING_QUOTE", field: symbol });
  }
  for (const key of ["trend", "momentum", "volatility", "breadth", "macro"]) {
    if (typeof snapshot.evidence[key] !== "number" || !Number.isFinite(snapshot.evidence[key])) {
      warnings.push({ code: "MISSING_EVIDENCE", field: key });
    }
  }
  if (!snapshot.levels.some((level) => level.type === "support")) warnings.push({ code: "MISSING_LEVEL", field: "support" });
  if (!snapshot.levels.some((level) => level.type === "resistance")) warnings.push({ code: "MISSING_LEVEL", field: "resistance" });
  return warnings;
}

function scenarioEvidence(type: IntelligenceScenarioType, factors: Array<{ factor: string; score: number }>): ScenarioEvidence[] {
  return factors.map(({ factor, score }) => ({
    factor,
    score,
    relation: type === "NEUTRAL"
      ? Math.abs(score - 50) <= 10 ? "SUPPORTS" : "OPPOSES"
      : type === "BULLISH"
        ? score > 55 ? "SUPPORTS" : score < 45 ? "OPPOSES" : "NEUTRAL"
        : score < 45 ? "SUPPORTS" : score > 55 ? "OPPOSES" : "NEUTRAL",
  }));
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
  const es = quote(snapshot, "ES");
  const dxy = quote(snapshot, "DXY");
  const vix = quote(snapshot, "VIX");
  const treasury = treasuryImpact(snapshot);
  const trendDrivers = [
    weightedDriver("TREND_EVIDENCE", rawEvidence(snapshot, "trend"), evidence(snapshot, "trend"), 0.65),
    weightedDriver("MOMENTUM_EVIDENCE", rawEvidence(snapshot, "momentum"), evidence(snapshot, "momentum"), 0.2),
    weightedDriver("ES_DIRECTION", numericQuoteValue(es), directionScore(es), 0.15),
  ];
  const trend = weightedScore(trendDrivers);
  const volatilityDrivers = [
    weightedDriver("VOLATILITY_EVIDENCE", rawEvidence(snapshot, "volatility"), evidence(snapshot, "volatility"), 0.55),
    weightedDriver("VIX_LEVEL", numericQuoteValue(vix), vixScore(snapshot), 0.45),
  ];
  const volatility = weightedScore(volatilityDrivers);
  const sentimentDrivers = [
    weightedDriver("TREND_SCORE", trend, trend, 0.35),
    weightedDriver("MOMENTUM_EVIDENCE", rawEvidence(snapshot, "momentum"), evidence(snapshot, "momentum"), 0.25),
    weightedDriver("BREADTH_EVIDENCE", rawEvidence(snapshot, "breadth"), evidence(snapshot, "breadth"), 0.25),
    weightedDriver("INVERSE_VOLATILITY", volatility, 100 - volatility, 0.15),
  ];
  const marketSentiment = weightedScore(sentimentDrivers);
  const riskDrivers = [
    weightedDriver("ES_DIRECTION", numericQuoteValue(es), directionScore(es), 0.22),
    weightedDriver("INVERSE_VIX", numericQuoteValue(vix), 100 - vixScore(snapshot), 0.23),
    weightedDriver("INVERSE_DXY_DIRECTION", numericQuoteValue(dxy), 100 - directionScore(dxy), 0.15),
    weightedDriver("BREADTH_EVIDENCE", rawEvidence(snapshot, "breadth"), evidence(snapshot, "breadth"), 0.18),
    weightedDriver("MACRO_EVIDENCE", rawEvidence(snapshot, "macro"), evidence(snapshot, "macro"), 0.12),
    weightedDriver("TREASURY_DIRECTION", null, treasury.normalizedScore, 0.1),
  ];
  const riskOnRiskOff = weightedScore(riskDrivers);

  const directionalVolatility = 100 - volatility;
  const orientedSignals = [riskOnRiskOff, marketSentiment, trend, directionalVolatility];
  const composite = orientedSignals.reduce((sum, value) => sum + value, 0) / orientedSignals.length;
  const dispersion = orientedSignals.reduce((sum, value) => sum + Math.abs(value - composite), 0) / orientedSignals.length;
  const strength = Math.abs(composite - 50) * 2;
  const dataQuality = statusQuality(snapshot.status);
  const bullseyeConfidence = round(((100 - dispersion) * 0.4 + strength * 0.6) * dataQuality);
  const scenarioProbabilities = probabilities(composite);
  const actionable = snapshot.status === "LIVE" || snapshot.status === "DELAYED";
  const probabilitiesForStatus = actionable
    ? scenarioProbabilities
    : { bullish: 0, neutral: 100, bearish: 0 };
  const support = primaryLevel(snapshot.levels, "support");
  const resistance = primaryLevel(snapshot.levels, "resistance");
  const evidenceFactors = [
    { factor: "RISK_ON_RISK_OFF", score: riskOnRiskOff },
    { factor: "MARKET_SENTIMENT", score: marketSentiment },
    { factor: "TREND", score: trend },
    { factor: "INVERSE_VOLATILITY", score: directionalVolatility },
  ];
  const scenarios: MarketIntelligence["scenarios"] = [
    { type: "BULLISH", probability: probabilitiesForStatus.bullish, trigger: { kind: "ABOVE_RESISTANCE", level: resistance }, invalidation: { kind: "BELOW_SUPPORT", level: support }, evidence: scenarioEvidence("BULLISH", evidenceFactors) },
    { type: "NEUTRAL", probability: probabilitiesForStatus.neutral, trigger: { kind: "INSIDE_RANGE", level: null }, invalidation: { kind: "OUTSIDE_RANGE", level: null }, evidence: scenarioEvidence("NEUTRAL", evidenceFactors) },
    { type: "BEARISH", probability: probabilitiesForStatus.bearish, trigger: { kind: "BELOW_SUPPORT", level: support }, invalidation: { kind: "ABOVE_RESISTANCE", level: resistance }, evidence: scenarioEvidence("BEARISH", evidenceFactors) },
  ];
  const dominantScenario = scenarios.reduce((dominant, scenario) => scenario.probability > dominant.probability ? scenario : dominant).type;

  return {
    schemaVersion: "1.1",
    source: { provider: snapshot.source, status: snapshot.status, asOf: snapshot.asOf },
    actionable,
    scores: { riskOnRiskOff, marketSentiment, trend, volatility, bullseyeConfidence },
    reasoning: {
      overallConfidence: {
        score: bullseyeConfidence,
        dataQuality,
        compositeScore: Math.round(composite * 100) / 100,
        dispersion: Math.round(dispersion * 100) / 100,
        directionalStrength: Math.round(strength * 100) / 100,
        inputs: evidenceFactors.map(({ factor, score }) => weightedDriver(factor, score, score, 0.25)),
      },
      riskDrivers,
      sentimentDrivers,
      trendDrivers,
      volatilityDrivers,
      treasuryImpact: treasury,
      dollarImpact: quoteImpact(snapshot, "DXY", 100 - directionScore(dxy)),
      vixImpact: quoteImpact(snapshot, "VIX", vixScore(snapshot)),
      missingDataWarnings: missingDataWarnings(snapshot),
    },
    dominantScenario,
    scenarios,
  };
}
