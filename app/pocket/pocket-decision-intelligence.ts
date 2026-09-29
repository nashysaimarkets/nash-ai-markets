export type DecisionIntelligenceAnalysis = {
  direction: "BULLISH" | "BEARISH" | "NEUTRAL";
  confidence: "LOW" | "MEDIUM" | "HIGH";
  timeframe: string;
  currentPrice?: string;
  evidenceQuality: { chartReadability: "CLEAR" | "PARTIAL" | "POOR"; scaleReadable: boolean; candlesReadable: boolean };
  observableFacts: string[];
  contradictions: string[];
  higherTimeframe: {
    provided: boolean;
    timeframe: string;
    direction: "BULLISH" | "BEARISH" | "NEUTRAL" | "UNKNOWN";
    alignment: "ALIGNED" | "CONFLICTING" | "MIXED" | "NOT_PROVIDED";
    summary: string;
  };
  patterns: Array<{ name: string; status: "FORMING" | "CONFIRMED" | "FAILED" | "AMBIGUOUS" | "EXTENDED"; confidence?: "LOW" | "MEDIUM" | "HIGH"; evidence: string; confirmation?: string; invalidation: string }>;
  nextSequence: { now: string; confirmation: string; failure: string; patience: string; reassess: string };
  setupScore: { overall: number; structure: number; momentum: number; location: number; confirmation: number; riskClarity: number; eventSafety: number };
  traderTrap: string;
  bullishCase: string;
  bearishCase: string;
  marketStructure: string;
  momentum: string;
  noTradeCondition: string;
  riskFlags: string[];
  indicators: string[];
  levels: Array<{ kind: "support" | "resistance" | "trend" | "pivot" | "zone" | "gap"; label: string; price: string }>;
};

export type MapId = "liquidity" | "structure" | "timeframes" | "momentum" | "volatility" | "sessions" | "auction" | "patterns" | "confluence" | "conditions";
type MapStatus = "EVIDENCE READY" | "CONDITIONAL" | "MORE INPUT NEEDED";
type MapReading = { label: string; value: string; tone?: "bull" | "bear" | "wait" | "neutral" };
export type AnalysisMap = { id: MapId; icon: string; label: string; status: MapStatus; headline: string; summary: string; readings: MapReading[] };

const concise = (value: string, fallback: string, limit = 170) => {
  const clean = value.trim() || fallback;
  return clean.length > limit ? `${clean.slice(0, limit - 1).trim()}…` : clean;
};

// These cards summarise observations; a missing-input sentence or suggested
// indicator is not evidence that the indicator was visible. Ambiguous prose
// stays unverified until the report provides an affirmative observation.
function hasObservedMention(statements: string[], terms: string[]) {
  const excluded = /\b(?:no|not|never|without|missing|unavailable|unverified|unconfirmed|unclear|unreadable|absent|insufficient|cannot|can't|isn't|aren't|wasn't|weren't|could|should|would|will|may|might|expected|if|add|upload|need(?:s|ed)?|require(?:s|d)?|check|verify)\b/i;
  return statements.some((statement) => statement.replace(/[’‘]/g, "\'").split(/[.!?;\n]|\b(?:but|however|whereas)\b/i).some((clause) => {
    if (excluded.test(clause)) return false;
    return terms.some((term) => new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(clause));
  }));
}

export function deriveAnalysisMaps(analysis: DecisionIntelligenceAnalysis): AnalysisMap[] {
  const observations = [analysis.marketStructure, analysis.momentum, ...analysis.observableFacts, ...analysis.indicators];
  const observed = (terms: string[]) => hasObservedMention(observations, terms);
  const support = analysis.levels.filter((level) => level.kind === "support");
  const resistance = analysis.levels.filter((level) => level.kind === "resistance");
  const pivots = analysis.levels.filter((level) => level.kind === "pivot");
  const imbalances = analysis.levels.filter((level) => level.kind === "gap" || level.kind === "zone");
  const readablePrices = analysis.levels.filter((level) => /^-?\d[\d,.]*$/.test(level.price.trim()));
  const visibleMomentumIndicator = observed(["rsi", "macd", "stochastic", "stochastics", "momentum indicator"]);
  const visibleVolatility = observed(["atr", "bollinger", "volatility", "compression", "expansion", "squeeze"]);
  const visibleSession = observed(["london session", "new york session", "asia session", "opening range", "overnight range", "cash open", "rth"]);
  const visibleAuction = observed(["volume profile", "point of control", "poc", "value area", "vwap", "high-volume", "low-volume"]);
  const confirmedPatterns = analysis.patterns.filter((pattern) => pattern.status === "CONFIRMED");
  const patternLead = analysis.patterns[0];
  const structureSequence = observed(["higher high", "higher highs"]) && observed(["higher low", "higher lows"])
    ? "HIGHER-HIGH / HIGHER-LOW SEQUENCE"
    : observed(["lower high", "lower highs"]) && observed(["lower low", "lower lows"])
      ? "LOWER-HIGH / LOWER-LOW SEQUENCE"
      : "SWING SEQUENCE NOT LABELLED";
  const momentumTone = hasObservedMention([analysis.momentum], ["weak", "weakening", "fading", "divergence", "diverging", "exhaustion", "exhausted"])
    ? "EXHAUSTION WATCH"
    : hasObservedMention([analysis.momentum], ["strong", "strengthening", "accelerating", "acceleration", "expanding", "expansion"])
      ? "MOMENTUM BUILDING"
      : "MOMENTUM MIXED";

  return [
    {
      id: "liquidity", icon: "⌖", label: "LIQUIDITY", status: readablePrices.length >= 2 ? "CONDITIONAL" : "MORE INPUT NEEDED",
      headline: readablePrices.length >= 2 ? "TRAP EDGES MAPPED" : "EXACT TRAP PRICES WITHHELD",
      summary: concise(analysis.traderTrap, "No defensible liquidity trap was visible. Bullseye will not manufacture a stop cluster."),
      readings: [
        { label: "BELOW PRICE", value: support[0]?.price || "NO VERIFIED SUPPORT", tone: "bull" },
        { label: "ABOVE PRICE", value: resistance[0]?.price || "NO VERIFIED RESISTANCE", tone: "bear" },
        { label: "IMBALANCE", value: imbalances[0]?.label || "NOT VISIBLY VERIFIED", tone: "wait" },
      ],
    },
    {
      id: "structure", icon: "◇", label: "STRUCTURE", status: analysis.evidenceQuality.candlesReadable ? "EVIDENCE READY" : "MORE INPUT NEEDED",
      headline: structureSequence,
      summary: concise(analysis.marketStructure, "The candle sequence is not clear enough to classify safely."),
      readings: [
        { label: "PRIMARY READ", value: analysis.direction, tone: analysis.direction === "BULLISH" ? "bull" : analysis.direction === "BEARISH" ? "bear" : "wait" },
        { label: "VISIBLE PIVOTS", value: String(pivots.length), tone: "neutral" },
        { label: "CHART QUALITY", value: analysis.evidenceQuality.chartReadability, tone: "neutral" },
      ],
    },
    {
      id: "timeframes", icon: "≡", label: "TIMEFRAMES", status: analysis.higherTimeframe.provided ? "EVIDENCE READY" : "MORE INPUT NEEDED",
      headline: analysis.higherTimeframe.provided ? `${analysis.higherTimeframe.alignment.replaceAll("_", " ")} TIMEFRAME READ` : "ONE TIMEFRAME ONLY",
      summary: concise(analysis.higherTimeframe.summary, "Add a wider 1h, 4h or daily chart to expose alignment or conflict."),
      readings: [
        { label: analysis.timeframe || "PRIMARY", value: analysis.direction, tone: analysis.direction === "BULLISH" ? "bull" : analysis.direction === "BEARISH" ? "bear" : "wait" },
        { label: analysis.higherTimeframe.timeframe || "HIGHER VIEW", value: analysis.higherTimeframe.direction, tone: analysis.higherTimeframe.direction === "BULLISH" ? "bull" : analysis.higherTimeframe.direction === "BEARISH" ? "bear" : "wait" },
        { label: "RELATIONSHIP", value: analysis.higherTimeframe.alignment.replaceAll("_", " "), tone: analysis.higherTimeframe.alignment === "CONFLICTING" ? "bear" : "neutral" },
      ],
    },
    {
      id: "momentum", icon: "↗", label: "MOMENTUM", status: analysis.evidenceQuality.candlesReadable ? "CONDITIONAL" : "MORE INPUT NEEDED",
      headline: momentumTone,
      summary: concise(analysis.momentum, "Momentum cannot be judged safely from this image."),
      readings: [
        { label: "MOMENTUM SCORE", value: `${analysis.setupScore.momentum}/10`, tone: "neutral" },
        { label: "VISIBLE INDICATOR", value: visibleMomentumIndicator ? "PRESENT" : "NOT VERIFIED", tone: visibleMomentumIndicator ? "bull" : "wait" },
        { label: "CONTRADICTIONS", value: String(analysis.contradictions.length), tone: analysis.contradictions.length ? "bear" : "neutral" },
      ],
    },
    {
      id: "volatility", icon: "∿", label: "VOLATILITY", status: visibleVolatility ? "EVIDENCE READY" : "MORE INPUT NEEDED",
      headline: visibleVolatility ? "VISIBLE REGIME EVIDENCE FOUND" : "VOLATILITY PANEL NOT VERIFIED",
      summary: visibleVolatility ? concise(analysis.momentum, "Visible volatility evidence is present.") : "Add ATR, Bollinger Bands or enough clearly visible compression/expansion structure. Bullseye will not estimate hidden volatility.",
      readings: [
        { label: "COMPRESSION", value: observed(["compression", "squeeze"]) ? "VISIBLE" : "NOT VERIFIED", tone: "wait" },
        { label: "EXPANSION", value: observed(["expansion", "volatility expansion"]) ? "VISIBLE" : "NOT VERIFIED", tone: "neutral" },
        { label: "ATR / BANDS", value: observed(["atr", "bollinger"]) ? "SUPPLIED" : "NOT VERIFIED", tone: "neutral" },
      ],
    },
    {
      id: "sessions", icon: "◷", label: "SESSIONS", status: visibleSession ? "EVIDENCE READY" : "MORE INPUT NEEDED",
      headline: visibleSession ? "SESSION LANDMARKS DETECTED" : "TIME AXIS NOT VERIFIED",
      summary: visibleSession ? "Bullseye found a visible session or opening-range reference in the supplied chart." : "Show readable times and session boundaries to map Asia, London, New York, overnight and opening-range levels without guessing.",
      readings: [
        { label: "OPENING RANGE", value: observed(["opening range", "cash open"]) ? "VISIBLE" : "NOT VERIFIED", tone: "neutral" },
        { label: "OVERNIGHT", value: observed(["overnight range"]) ? "VISIBLE" : "NOT VERIFIED", tone: "neutral" },
        { label: "SESSION LABEL", value: visibleSession ? "READABLE" : "MISSING", tone: visibleSession ? "bull" : "wait" },
      ],
    },
    {
      id: "auction", icon: "▆", label: "AUCTION", status: visibleAuction ? "EVIDENCE READY" : "MORE INPUT NEEDED",
      headline: visibleAuction ? "VALUE / REJECTION EVIDENCE FOUND" : "VOLUME PROFILE NOT VERIFIED",
      summary: visibleAuction ? "Only the auction references visibly present in the screenshot are used." : "Add a chart showing volume profile, value area, point of control or VWAP. Screenshot-only Bullseye will not invent order flow.",
      readings: [
        { label: "VALUE AREA", value: observed(["value area", "high-volume", "low-volume"]) ? "VISIBLE" : "NOT VERIFIED", tone: "neutral" },
        { label: "POC", value: observed(["point of control", "poc"]) ? "VISIBLE" : "NOT VERIFIED", tone: "neutral" },
        { label: "VWAP", value: observed(["vwap"]) ? "VISIBLE" : "NOT VERIFIED", tone: "neutral" },
      ],
    },
    {
      id: "patterns", icon: "△", label: "LIFECYCLE", status: patternLead ? "CONDITIONAL" : "MORE INPUT NEEDED",
      headline: patternLead ? `${patternLead.name} · ${patternLead.status}` : "NO CLEAN PATTERN VERIFIED",
      summary: patternLead ? concise(patternLead.evidence, "Pattern geometry is visible but remains conditional.") : "No gallery pattern survived the visible-geometry standard.",
      readings: [
        { label: "CONFIRMED", value: String(confirmedPatterns.length), tone: confirmedPatterns.length ? "bull" : "neutral" },
        { label: "FORMING", value: String(analysis.patterns.filter((pattern) => pattern.status === "FORMING").length), tone: "wait" },
        { label: "FAILED", value: String(analysis.patterns.filter((pattern) => pattern.status === "FAILED").length), tone: "bear" },
      ],
    },
    {
      id: "confluence", icon: "◉", label: "CONFLUENCE", status: "EVIDENCE READY",
      headline: `${analysis.setupScore.overall}/100 EVIDENCE ALIGNMENT`,
      summary: "This is a comparison of the existing verified audit factors, not a probability of price moving in either direction.",
      readings: [
        { label: "STRUCTURE", value: `${analysis.setupScore.structure}/10`, tone: "neutral" },
        { label: "LOCATION", value: `${analysis.setupScore.location}/10`, tone: "neutral" },
        { label: "CONFIRMATION", value: `${analysis.setupScore.confirmation}/10`, tone: "neutral" },
        { label: "RISK CLARITY", value: `${analysis.setupScore.riskClarity}/10`, tone: "neutral" },
        { label: "MOMENTUM", value: `${analysis.setupScore.momentum}/10`, tone: "neutral" },
        { label: "EVENT SAFETY", value: `${analysis.setupScore.eventSafety}/10`, tone: "neutral" },
      ],
    },
    {
      id: "conditions", icon: "↳", label: "IF / THEN", status: "CONDITIONAL",
      headline: "PRICE MUST PROVE THE NEXT STEP",
      summary: concise(analysis.nextSequence.now, "The current condition is not clear enough to act on."),
      readings: [
        { label: "STRENGTHENS IF", value: analysis.nextSequence.confirmation, tone: "bull" },
        { label: "FAILS IF", value: analysis.nextSequence.failure, tone: "bear" },
        { label: "WAIT WHILE", value: analysis.nextSequence.patience || analysis.noTradeCondition, tone: "wait" },
      ],
    },
  ];
}
