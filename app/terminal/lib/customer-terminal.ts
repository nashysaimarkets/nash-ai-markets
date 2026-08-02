import type { MarketIntelligence } from "../../lib/market-intelligence-engine.ts";
import type { MarketQuote, MarketSnapshot } from "../../lib/market-data.ts";

export type CustomerSignal = {
  label: string;
  score: number;
  stance: "supportive" | "balanced" | "restrictive" | "unavailable";
  explanation: string;
};

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

export function scoreStance(score: number, available = true): CustomerSignal["stance"] {
  if (!available) return "unavailable";
  if (score >= 60) return "supportive";
  if (score <= 40) return "restrictive";
  return "balanced";
}

export function instrumentInterpretation(quote: MarketQuote | undefined): string {
  if (!quote) return "Awaiting a verified provider observation.";
  if (quote.direction === "flat") return "Little directional pressure in the latest observation.";
  const isConstraint = quote.symbol === "VIX" || quote.symbol === "DXY" || quote.symbol === "US2Y" || quote.symbol === "US10Y";
  const supportive = isConstraint ? quote.direction === "down" : quote.direction === "up";
  if (quote.symbol === "OIL") {
    return quote.direction === "up"
      ? "Oil proxy is higher on the latest verified print — energy tape firm, equity implication mixed."
      : "Oil proxy is lower on the latest verified print — energy tape softer, equity implication mixed.";
  }
  return supportive
    ? "Latest move is supportive for equity risk appetite."
    : "Latest move adds a constraint to equity risk appetite.";
}

export function createCustomerSignals(snapshot: MarketSnapshot, intelligence: MarketIntelligence): CustomerSignal[] {
  const verified = snapshot.status === "LIVE" || snapshot.status === "DELAYED";
  const signals = [
    { label: "Equity trend", score: intelligence.scores.trend, available: verified && snapshot.quotes.some((quote) => quote.symbol === "ES"), explanation: "Direction and trend evidence from the verified S&P 500 futures observation." },
    { label: "Volatility pressure", score: 100 - intelligence.scores.volatility, available: verified && intelligence.reasoning.vixImpact.availability !== "MISSING", explanation: "Higher support indicates volatility is exerting less pressure on risk appetite." },
    { label: "Treasury pressure", score: intelligence.reasoning.treasuryImpact.normalizedScore, available: verified && intelligence.reasoning.treasuryImpact.availability !== "MISSING", explanation: "Combines the latest verified 2-year and 10-year yield direction." },
    { label: "Dollar pressure", score: intelligence.reasoning.dollarImpact.normalizedScore, available: verified && intelligence.reasoning.dollarImpact.availability !== "MISSING", explanation: "Shows whether the latest verified dollar move supports or constrains risk appetite." },
  ];
  return signals.map(({ label, score, available, explanation }) => ({
    label,
    score: available ? clamp(score) : 0,
    stance: scoreStance(score, available),
    explanation,
  }));
}

