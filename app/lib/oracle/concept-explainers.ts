export type ConceptExplainerId =
  | "vix"
  | "dxy"
  | "us10y"
  | "ema20"
  | "range-high"
  | "range-low"
  | "session-open"
  | "bull-bear"
  | "confidence"
  | "breadth"
  | "put-call"
  | "trin"
  | "tick"
  | "gamma"
  | "dealer"
  | "event-risk"
  | "delayed-data";

export type ConceptExplainer = {
  id: ConceptExplainerId;
  title: string;
  summary: string;
  whyItMatters: string;
};

export const CONCEPT_EXPLAINERS: Record<ConceptExplainerId, ConceptExplainer> = {
  vix: {
    id: "vix",
    title: "VIX",
    summary: "A measure of expected near-term US equity volatility from options pricing.",
    whyItMatters: "Rising VIX often coincides with tighter risk conditions; falling VIX can ease them. It is not a buy or sell signal by itself.",
  },
  dxy: {
    id: "dxy",
    title: "DXY",
    summary: "The US Dollar Index summarises the dollar versus a basket of major currencies.",
    whyItMatters: "A firmer dollar can pressure risk assets; a softer dollar can support them. Context matters more than any single print.",
  },
  us10y: {
    id: "us10y",
    title: "US 10-year yield",
    summary: "The market interest rate on 10-year US Treasury notes.",
    whyItMatters: "Yield moves change discount-rate pressure on equities and can confirm or conflict with an index lean.",
  },
  ema20: {
    id: "ema20",
    title: "EMA 20",
    summary: "A 20-period exponential moving average of verified closes.",
    whyItMatters: "It summarises recent average price. Sitting above or below it is context, not a guaranteed continuation.",
  },
  "range-high": {
    id: "range-high",
    title: "24-hour high",
    summary: "The highest verified candle high in the rolling 24-hour window.",
    whyItMatters: "An upside reference for behaviour near recent extremes — educational, not confirmed resistance.",
  },
  "range-low": {
    id: "range-low",
    title: "24-hour low",
    summary: "The lowest verified candle low in the rolling 24-hour window.",
    whyItMatters: "A downside reference for behaviour near recent extremes — educational, not confirmed support.",
  },
  "session-open": {
    id: "session-open",
    title: "Session-opening reference",
    summary: "A verified opening reference from available session candles when present.",
    whyItMatters: "Helps judge whether price is accepting or rejecting the opening area during the cash session.",
  },
  "bull-bear": {
    id: "bull-bear",
    title: "Bull vs Bear weights",
    summary: "Educational scenario weights from the documented engine using verified inputs.",
    whyItMatters: "They show relative case strength, not calibrated win probabilities or trade instructions.",
  },
  confidence: {
    id: "confidence",
    title: "Confidence gauge",
    summary: "A banded reading of how complete and aligned verified inputs currently are.",
    whyItMatters: "Low confidence means wait; higher confidence still does not guarantee an outcome.",
  },
  breadth: {
    id: "breadth",
    title: "Breadth",
    summary: "How widely advances or declines participate across the market.",
    whyItMatters: "Strong index moves with weak breadth can be less durable — unavailable here until a verified feed exists.",
  },
  "put-call": {
    id: "put-call",
    title: "Put / Call",
    summary: "The ratio of put option volume to call option volume.",
    whyItMatters: "Extreme readings can reflect hedging or speculative skew — unavailable until a verified feed exists.",
  },
  trin: {
    id: "trin",
    title: "TRIN",
    summary: "The Arms Index compares advancing/declining issues against advancing/declining volume.",
    whyItMatters: "It is a short-term internals gauge — unavailable until a verified feed exists.",
  },
  tick: {
    id: "tick",
    title: "TICK",
    summary: "Net stocks trading on an uptick versus a downtick on the NYSE.",
    whyItMatters: "Short-term participation pressure — unavailable until a verified feed exists.",
  },
  gamma: {
    id: "gamma",
    title: "Gamma exposure",
    summary: "An options-market estimate of dealer hedging sensitivity to price changes.",
    whyItMatters: "Useful context when verified, but easy to misuse — unavailable until a verified feed exists.",
  },
  dealer: {
    id: "dealer",
    title: "Dealer positioning",
    summary: "An estimate of how options dealers may need to hedge as price moves.",
    whyItMatters: "Educational only when verified — unavailable until a verified feed exists.",
  },
  "event-risk": {
    id: "event-risk",
    title: "Event risk",
    summary: "Scheduled economic releases that can change liquidity and invalidate short-term structure.",
    whyItMatters: "Knowing the next verified catalyst helps avoid chasing price into an unresolved window.",
  },
  "delayed-data": {
    id: "delayed-data",
    title: "Delayed market data",
    summary: "Member charts and quotes are verified delayed prints, never labelled as live.",
    whyItMatters: "Delay is part of the product contract — decisions must respect freshness and fail-closed gaps.",
  },
};
