import type { EvidenceInputs, MarketSnapshot } from "./market-data";

type RiskRating = "LOW" | "MODERATE" | "ELEVATED" | "HIGH";
type Weather = "CLEAR" | "CONSTRUCTIVE" | "MIXED" | "STORMY";
type Bias = "BULLISH" | "NEUTRAL → BULLISH" | "NEUTRAL" | "NEUTRAL → BEARISH" | "BEARISH";

export type BullseyeOutput = {
  score: number;
  confidence: number;
  bullProbability: number;
  bearProbability: number;
  noTradeProbability: number;
  risk: RiskRating;
  weather: Weather;
  bias: Bias;
  dna: string[];
};

const weights: Record<keyof EvidenceInputs, number> = {
  trend: 0.24,
  momentum: 0.2,
  liquidity: 0.14,
  breadth: 0.16,
  volatility: 0.14,
  macro: 0.12,
};

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function weightedScore(evidence: EvidenceInputs): number {
  return Math.round(
    Object.entries(weights).reduce((total, [key, weight]) => {
      return total + clamp(evidence[key as keyof EvidenceInputs]) * weight;
    }, 0),
  );
}

export function runBullseyeEngine(snapshot: MarketSnapshot): BullseyeOutput {
  const score = weightedScore(snapshot.evidence);
  const dispersion =
    Math.max(...Object.values(snapshot.evidence)) -
    Math.min(...Object.values(snapshot.evidence));

  const confidence = clamp(Math.round(score - dispersion * 0.25));
  const eventPenalty = snapshot.events.some((event) => event.risk === "HIGH") ? 8 : 0;
  const volatilityPenalty = Math.max(0, 70 - snapshot.evidence.volatility) * 0.25;

  const directionalEdge =
    snapshot.evidence.trend * 0.35 +
    snapshot.evidence.momentum * 0.3 +
    snapshot.evidence.breadth * 0.2 +
    snapshot.evidence.liquidity * 0.15;

  const bullProbability = clamp(
    Math.round(35 + (directionalEdge - 50) * 0.8 - eventPenalty * 0.3),
    12,
    78,
  );

  const noTradeProbability = clamp(
    Math.round(12 + dispersion * 0.18 + eventPenalty + volatilityPenalty),
    8,
    42,
  );

  const bearProbability = clamp(100 - bullProbability - noTradeProbability, 8, 70);
  const total = bullProbability + bearProbability + noTradeProbability;

  const normalisedBull = Math.round((bullProbability / total) * 100);
  const normalisedBear = Math.round((bearProbability / total) * 100);
  const normalisedWait = 100 - normalisedBull - normalisedBear;

  const risk: RiskRating =
    eventPenalty >= 8 && snapshot.evidence.volatility < 55
      ? "HIGH"
      : eventPenalty >= 8 || snapshot.evidence.volatility < 65
        ? "ELEVATED"
        : score >= 78
          ? "MODERATE"
          : "LOW";

  const weather: Weather =
    risk === "HIGH"
      ? "STORMY"
      : score >= 80 && risk !== "ELEVATED"
        ? "CLEAR"
        : score >= 70
          ? "CONSTRUCTIVE"
          : "MIXED";

  const bias: Bias =
    normalisedBull >= 62
      ? "BULLISH"
      : normalisedBull >= 52
        ? "NEUTRAL → BULLISH"
        : normalisedBear >= 62
          ? "BEARISH"
          : normalisedBear >= 52
            ? "NEUTRAL → BEARISH"
            : "NEUTRAL";

  const dna = [
    score >= 78 ? "STRONG EVIDENCE ALIGNMENT" : "MIXED EVIDENCE",
    snapshot.evidence.liquidity >= 70 ? "LIQUID" : "THIN LIQUIDITY",
    eventPenalty ? "EVENT-SENSITIVE" : "LOW EVENT PRESSURE",
    snapshot.evidence.volatility >= 65 ? "VOLATILITY CONTAINED" : "VOLATILITY RISK",
  ];

  return {
    score,
    confidence,
    bullProbability: normalisedBull,
    bearProbability: normalisedBear,
    noTradeProbability: normalisedWait,
    risk,
    weather,
    bias,
    dna,
  };
}
