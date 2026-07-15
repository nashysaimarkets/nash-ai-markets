import type { MarketSnapshot } from "./market-data";

export type BullseyeResult = {
  score: number; confidence: number; weather: "CLEAR" | "MIXED" | "STORMY";
  bias: string; risk: MarketSnapshot["risk"]; bullProbability: number;
  bearProbability: number; noTradeProbability: number; dna: string[];
};

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, Math.round(value)));

export function runBullseyeEngine(snapshot: MarketSnapshot): BullseyeResult {
  const values = Object.values(snapshot.evidence).filter(Number.isFinite);
  const score = clamp(values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 50);
  const dataPenalty = snapshot.status === "LIVE" ? 0 : snapshot.status === "DELAYED" ? 8 : snapshot.status === "PREVIEW" ? 25 : 35;
  const confidence = clamp(55 + Math.abs(score - 50) - dataPenalty, 20, 88);
  const riskPenalty = snapshot.risk === "HIGH" ? 14 : snapshot.risk === "ELEVATED" ? 9 : snapshot.risk === "MODERATE" ? 5 : 2;
  const noTradeProbability = clamp(30 + riskPenalty - Math.abs(score - 50) * 0.8, 18, 48);
  const remaining = 100 - noTradeProbability;
  const bullProbability = Math.round(remaining * (clamp(score, 20, 80) / 100));
  return {
    score, confidence,
    weather: snapshot.risk === "HIGH" ? "STORMY" : snapshot.risk === "LOW" ? "CLEAR" : "MIXED",
    bias: snapshot.bias, risk: snapshot.risk, bullProbability,
    bearProbability: remaining - bullProbability, noTradeProbability,
    dna: [snapshot.bias, `${snapshot.risk} RISK`, `${snapshot.status} DATA`],
  };
}
