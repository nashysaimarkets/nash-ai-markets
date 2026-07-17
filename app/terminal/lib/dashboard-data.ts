import type { BullseyeResult } from "../../lib/bullseye-engine";
import type { MarketLevel, MarketSnapshot } from "../../lib/market-data";
import { createDataProvenance, type DataProvenance } from "../lib/provenance.ts";

export type DashboardMetric = {
  label: string;
  value: string;
  delta?: string;
  tone: "positive" | "negative" | "neutral";
};

export type DashboardViewModel = {
  heroMetrics: DashboardMetric[];
  provenance: DataProvenance;
  analysisProvenance: DataProvenance;
  verdict: {
    overallBias: string;
    confidenceScore: number;
    tradeRating: string;
    riskLevel: string;
    suggestedDirection: string;
    entryZone: string;
    stopZone: string;
    profitTarget1: string;
    profitTarget2: string;
    noTradeWarning?: string;
  };
  futures: {
    value: string;
    change: string;
    bias: string;
    status: string;
    note: string;
    levels: MarketLevel[];
  };
  briefing: {
    summary: string;
    confidence: number;
    score: number;
    risk: string;
    bullets: Array<{ title: string; body: string }>;
  };
  preMarketBrief: { title: string; body: string };
  afterHoursBrief: { title: string; body: string };
  economicEvents: MarketSnapshot["events"];
  movers: Array<{ name: string; value: string; change: string }>;
  headlines: Array<{ title: string; detail: string }>;
  sentiment: { score: number; label: string; detail: string };
  riskRating: number;
  probabilities: { bullish: number; neutral: number; bearish: number };
  expectedMove: string;
  futuresBias: string;
  optionsBias: string;
  supportResistance: MarketLevel[];
  vix: { value: string; change: string; note: string };
  treasuries: Array<{ label: string; value: string; delta: string }>;
  dollar: { value: string; change: string; note: string };
  calendar: MarketSnapshot["events"];
  fearGreed: { score: number; label: string; detail: string };
  options: { putCall: string; iv: string; skew: string; detail: string };
  eliteTradeSetup: {
    title: string;
    direction: "Long" | "Short" | "None";
    conviction: number;
    entryZone: string;
    stopLoss: string;
    target1: string;
    target2: string;
    riskReward: string;
    timeframe: string;
    status: "Waiting" | "Active" | "Closed" | "Unavailable";
    explanation: string;
  };
};

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function getQuote(snapshot: MarketSnapshot, symbol: string) {
  return snapshot.quotes.find((quote) => quote.symbol === symbol);
}

export function createDashboardViewModel(snapshot: MarketSnapshot, bullseye: BullseyeResult): DashboardViewModel {
  const esQuote = getQuote(snapshot, "ES");
  const vixQuote = getQuote(snapshot, "VIX");
  const twoYearQuote = getQuote(snapshot, "US2Y");
  const tenYearQuote = getQuote(snapshot, "US10Y");
  const thirtyYearQuote = getQuote(snapshot, "US30Y");
  const dollarQuote = getQuote(snapshot, "DXY");

  const heroMetrics: DashboardMetric[] = [
    {
      label: "SESSION BIAS",
      value: bullseye.bias,
      delta: snapshot.bias,
      tone: bullseye.bullProbability >= bullseye.bearProbability ? "positive" : "negative",
    },
    {
      label: "CONFIDENCE",
      value: `${bullseye.confidence}%`,
      delta: bullseye.weather,
      tone: bullseye.confidence >= 70 ? "positive" : bullseye.confidence >= 50 ? "neutral" : "negative",
    },
    {
      label: "RISK",
      value: snapshot.risk,
      delta: `${bullseye.noTradeProbability}% NO-TRADE`,
      tone: snapshot.risk === "HIGH" || snapshot.risk === "ELEVATED" ? "negative" : "neutral",
    },
    {
      label: "DATA STATE",
      value: snapshot.status,
      delta: snapshot.source,
      tone: snapshot.status === "LIVE" ? "positive" : snapshot.status === "DELAYED" ? "neutral" : "negative",
    },
  ];

  const fearGreedScore = clamp(50 + (snapshot.risk === "HIGH" ? 12 : snapshot.risk === "ELEVATED" ? 8 : snapshot.risk === "MODERATE" ? 4 : 1) + (bullseye.score >= 70 ? 6 : bullseye.score >= 55 ? 3 : 0));
  const fearGreedLabel = fearGreedScore >= 75 ? "EXTREME GREED" : fearGreedScore >= 60 ? "GREED" : fearGreedScore >= 40 ? "NEUTRAL" : fearGreedScore >= 25 ? "FEAR" : "EXTREME FEAR";
  const bullishProbability = clamp(bullseye.bullProbability + (snapshot.risk === "LOW" ? 4 : 0));
  const neutralProbability = clamp(100 - bullishProbability - bullseye.bearProbability);
  const bearishProbability = clamp(bullseye.bearProbability + (snapshot.risk === "HIGH" ? 4 : 0));
  const expectedMove = "Unavailable";
  const futuresBias = bullishProbability >= bearishProbability ? "Bullish bias" : "Bearish bias";
  const optionsBias = bullishProbability > bearishProbability ? "Call structure" : "Put structure";
  const confidenceScore = clamp(Math.round((bullseye.confidence + (bullishProbability - bearishProbability) / 2 + (fearGreedScore / 2)) / 1.5));
  const tradeRating = confidenceScore >= 80 ? "A+" : confidenceScore >= 70 ? "A" : confidenceScore >= 60 ? "B" : "C";
  const overallBias = confidenceScore >= 75 && bullishProbability >= bearishProbability ? "Bullish" : confidenceScore >= 75 && bearishProbability > bullishProbability ? "Bearish" : "Neutral";
  const suggestedDirection = overallBias === "Bullish" ? "Long bias" : overallBias === "Bearish" ? "Short bias" : "Range / fade bias";
  const entryZone = overallBias === "Bullish" ? "Above the pivot with confirmation" : overallBias === "Bearish" ? "Below the pivot with confirmation" : "Between support and resistance";
  const stopZone = overallBias === "Bullish" ? "Below support" : overallBias === "Bearish" ? "Above resistance" : "Outside the current range";
  const profitTarget1 = overallBias === "Bullish" ? "First resistance" : overallBias === "Bearish" ? "First support" : "Near the pivot";
  const profitTarget2 = overallBias === "Bullish" ? "Second resistance" : overallBias === "Bearish" ? "Second support" : "Edge of the range";
  const noTradeWarning = confidenceScore < 55 ? "Confidence is too low for fresh risk. Stand aside until the setup improves." : undefined;

  const provenance = createDataProvenance({
    source: snapshot.source,
    lastUpdated: snapshot.asOf,
    status: snapshot.status === "LIVE" ? "LIVE" : snapshot.status === "DELAYED" ? "DELAYED" : "UNAVAILABLE",
    kind: "fact",
    provider: snapshot.source,
  });

  const analysisProvenance = createDataProvenance({
    source: snapshot.source,
    lastUpdated: snapshot.asOf,
    status: snapshot.status === "LIVE" || snapshot.status === "DELAYED" ? "VERIFIED" : "UNAVAILABLE",
    kind: "analysis",
    provider: "NASH AI Analysis",
  });

  return {
    heroMetrics,
    provenance,
    analysisProvenance,
    verdict: {
      overallBias,
      confidenceScore,
      tradeRating,
      riskLevel: snapshot.risk,
      suggestedDirection,
      entryZone,
      stopZone,
      profitTarget1,
      profitTarget2,
      noTradeWarning,
    },
    futures: {
      value: esQuote?.value ?? "—",
      change: esQuote?.change ?? "—",
      bias: bullseye.bias,
      status: snapshot.status,
      note: snapshot.summary,
      levels: snapshot.levels,
    },
    briefing: {
      summary: bullseye.missionBrief,
      confidence: bullseye.confidence,
      score: bullseye.score,
      risk: bullseye.risk,
      bullets: [
        { title: "Primary trigger", body: bullseye.bullTrigger },
        { title: "Primary invalidation", body: bullseye.bullInvalidation },
        { title: "Risk window", body: bullseye.riskWindowPrep },
      ],
    },
    supportResistance: snapshot.levels.filter((level) => level.type === "resistance" || level.type === "support" || level.type === "pivot"),
    vix: {
      value: vixQuote?.value ?? "—",
      change: vixQuote?.change ?? "—",
      note: snapshot.risk === "HIGH" ? "Volatility remains elevated and risk is still being repriced." : "Volatility is relatively contained, which helps the current trend hold.",
    },
    treasuries: [
      { label: "2Y", value: twoYearQuote?.value ?? "—", delta: twoYearQuote?.change ?? "flat" },
      { label: "10Y", value: tenYearQuote?.value ?? "—", delta: tenYearQuote?.change ?? "flat" },
      { label: "30Y", value: thirtyYearQuote?.value ?? "—", delta: thirtyYearQuote?.change ?? "flat" },
    ],
    dollar: {
      value: dollarQuote?.value ?? "—",
      change: dollarQuote?.change ?? "—",
      note: snapshot.risk === "LOW" ? "The dollar is stabilizing while growth expectations remain constructive." : "The dollar is acting as a risk barometer while capital rotates.",
    },
    preMarketBrief: {
      title: "Pre-market data unavailable",
      body: "No verified provider-backed pre-market briefing is available.",
    },
    afterHoursBrief: {
      title: "After-hours data unavailable",
      body: "No verified provider-backed after-hours briefing is available.",
    },
    economicEvents: snapshot.events,
    movers: [],
    headlines: [],
    sentiment: {
      score: fearGreedScore,
      label: fearGreedLabel,
      detail: fearGreedScore >= 60 ? "Sentiment is running hot, which can amplify trend continuation but also increase fragility." : "Risk appetite is constrained, and the market is still waiting for confirmation.",
    },
    riskRating: snapshot.risk === "HIGH" ? 8 : snapshot.risk === "ELEVATED" ? 6 : snapshot.risk === "MODERATE" ? 4 : 3,
    probabilities: {
      bullish: bullishProbability,
      neutral: neutralProbability,
      bearish: bearishProbability,
    },
    expectedMove,
    futuresBias,
    optionsBias,
    calendar: snapshot.events,
    fearGreed: {
      score: fearGreedScore,
      label: fearGreedLabel,
      detail: fearGreedScore >= 60 ? "Sentiment is running hot, which can amplify trend continuation but also increase fragility." : "Risk appetite is constrained, and the market is still waiting for confirmation.",
    },
    options: {
      putCall: "Unavailable",
      iv: "Unavailable",
      skew: "Unavailable",
      detail: "No verified provider-backed options data is available.",
    },
    eliteTradeSetup: {
      title: "No verified trade setup",
      direction: "None",
      conviction: 0,
      entryZone: "Unavailable",
      stopLoss: "Unavailable",
      target1: "Unavailable",
      target2: "Unavailable",
      riskReward: "Unavailable",
      timeframe: "Unavailable",
      status: "Unavailable",
      explanation: "No entry, stop, target, or position guidance is generated by this legacy view model.",
    },
  };
}
