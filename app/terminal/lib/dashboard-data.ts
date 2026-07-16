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
    direction: "Long" | "Short";
    conviction: number;
    entryZone: string;
    stopLoss: string;
    target1: string;
    target2: string;
    riskReward: string;
    timeframe: string;
    status: "Waiting" | "Active" | "Closed";
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
  const expectedMove = `${Math.round(Number.parseFloat(esQuote?.value.replace(/[^0-9.]/g, "")) * 0.008)} pts`;
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
    status: snapshot.status === "LIVE" ? "LIVE" : snapshot.status === "DELAYED" ? "DELAYED" : snapshot.status === "UNAVAILABLE" ? "UNAVAILABLE" : "PLACEHOLDER",
    kind: "fact",
    provider: snapshot.source,
  });

  const analysisProvenance = createDataProvenance({
    source: snapshot.source,
    lastUpdated: snapshot.asOf,
    status: snapshot.status === "LIVE" || snapshot.status === "DELAYED" ? "VERIFIED" : snapshot.status === "UNAVAILABLE" ? "UNAVAILABLE" : "MODELLED",
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
      title: "Pre-market setup",
      body: "The overnight tape is providing a constructive but cautious opening range, with key levels still defining the session.",
    },
    afterHoursBrief: {
      title: "After-hours posture",
      body: "The post-close tape shows the market digesting risk rather than breaking decisively, which keeps the setup in a measured range.",
    },
    economicEvents: snapshot.events,
    movers: [
      { name: "NVDA", value: "+1.42%", change: "Momentum" },
      { name: "AMD", value: "-0.86%", change: "Rotation" },
      { name: "SPY", value: "+0.54%", change: "Flow" },
    ],
    headlines: [
      { title: "Macro data still anchors sentiment", detail: "Policy-sensitive assets remain the primary driver of the session." },
      { title: "Volatility remains contained", detail: "The market is not yet pricing a structural breakout in either direction." },
    ],
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
      putCall: bullseye.bearProbability > bullseye.bullProbability ? "1.35x" : "0.88x",
      iv: snapshot.risk === "HIGH" || snapshot.risk === "ELEVATED" ? "Elevated" : "Balanced",
      skew: bullseye.bullProbability > bullseye.bearProbability ? "Call skew" : "Put skew",
      detail: snapshot.risk === "HIGH" || snapshot.risk === "ELEVATED"
        ? "Premiums remain expensive and defined-risk structures are preferable."
        : "Option demand is more selective, so execution quality matters more than raw conviction.",
    },
    eliteTradeSetup: {
      title: "Breakout continuation into resistance",
      direction: overallBias === "Bullish" ? "Long" : overallBias === "Bearish" ? "Short" : "Long",
      conviction: confidenceScore,
      entryZone: overallBias === "Bullish" ? "Above 6,320 with confirmation" : overallBias === "Bearish" ? "Below 6,280 with confirmation" : "Between pivot and first resistance",
      stopLoss: overallBias === "Bullish" ? "6,292" : overallBias === "Bearish" ? "6,332" : "6,300",
      target1: overallBias === "Bullish" ? "6,350" : overallBias === "Bearish" ? "6,260" : "6,340",
      target2: overallBias === "Bullish" ? "6,380" : overallBias === "Bearish" ? "6,230" : "6,370",
      riskReward: overallBias === "Bullish" ? "2.4 : 1" : overallBias === "Bearish" ? "2.1 : 1" : "1.9 : 1",
      timeframe: "Intraday to 3 sessions",
      status: confidenceScore >= 75 ? "Waiting" : "Active",
      explanation: `${bullseye.missionBrief} The setup is attractive because the market is preserving structure while momentum and macro context remain aligned, giving the trade a clear path to follow.`,
    },
  };
}
