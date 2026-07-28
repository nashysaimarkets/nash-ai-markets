import type { MarketIntelligence } from "../../lib/market-intelligence-engine.ts";
import type { TradePlan } from "../../lib/structured-trade-planner.ts";
import type { TradingDecision } from "../../lib/trading-decision-engine.ts";
import type { SessionClockReading } from "../../terminal/lib/session-clock.ts";
import { formatCustomerParticipationWarnings } from "../../terminal/lib/customer-warnings.ts";
import { candleSessionStats, exponentialMovingAverage, volumeWeightedAveragePrice } from "./candle-analysis.ts";
import type { OhlcvPoint } from "../../terminal/lib/visual-terminal.ts";

export type ConfidenceBand = "Low" | "Moderate" | "High" | "Strong";

export type DecisionDeskModel = {
  verified: boolean;
  marketBias: { label: "Bullish" | "Neutral" | "Bearish"; tone: "bull" | "neutral" | "bear" };
  confidence: {
    band: ConfidenceBand | "Awaiting inputs";
    score: number | null;
    why: string;
    factors: Array<{ label: string; detail: string }>;
  };
  trend: { label: "Strong" | "Weak" | "Mixed"; detail: string };
  volatility: { label: "Low" | "Normal" | "Elevated"; detail: string };
  marketStructure: { label: string; detail: string };
  sessionStatus: { label: string; detail: string };
  expectedMove: { label: string; detail: string };
  tradeThesis: string;
  opportunity: {
    available: boolean;
    headline: string;
    preferredDirection: string;
    entryZone: string;
    invalidation: string;
    targetArea: string;
    riskLevel: string;
  };
};

const NO_SETUP = "No verified high-probability setup currently available.";

function pretty(value: string): string {
  return value.replaceAll("_", " ").replaceAll("-", " ");
}

function humanizeFragments(text: string): string {
  return text
    .replaceAll("CRITICAL_INPUT_MISSING", "required market inputs are incomplete")
    .replaceAll("UNAVAILABLE_DATA", "verified market data is currently incomplete")
    .replaceAll("NULL", "missing")
    .replaceAll("Undefined", "missing")
    .replaceAll("undefined", "missing")
    .replace(/\bUnavailable\b/g, "not yet confirmed from verified feeds");
}

export function confidenceBandFromScore(score: number | null | undefined, verified: boolean): ConfidenceBand | "Awaiting inputs" {
  if (!verified || score == null || !Number.isFinite(score)) return "Awaiting inputs";
  if (score >= 80) return "Strong";
  if (score >= 65) return "High";
  if (score >= 40) return "Moderate";
  return "Low";
}

export function formatConfidenceBandLabel(score: number | null | undefined, verified: boolean): string {
  const band = confidenceBandFromScore(score, verified);
  return band === "Awaiting inputs" ? "Confidence awaiting verified inputs" : `${band} Confidence`;
}

function trendReading(score: number, verified: boolean): DecisionDeskModel["trend"] {
  if (!verified) {
    return {
      label: "Mixed",
      detail: "Trend quality is withheld until verified decision inputs clear.",
    };
  }
  if (score >= 65) {
    return { label: "Strong", detail: `Trend score ${score}/100 shows directional agreement across verified inputs.` };
  }
  if (score <= 40) {
    return { label: "Weak", detail: `Trend score ${score}/100 shows limited directional follow-through.` };
  }
  return { label: "Mixed", detail: `Trend score ${score}/100 sits in a mixed / selective zone.` };
}

function volatilityReading(
  regime: TradingDecision["volatilityRegime"],
  score: number,
  verified: boolean,
): DecisionDeskModel["volatility"] {
  if (!verified) {
    return {
      label: "Normal",
      detail: "Volatility regime is not confirmed until verified inputs are complete.",
    };
  }
  if (regime === "compressed" || score <= 30) {
    return { label: "Low", detail: "Volatility is compressed — ranges may stay orderly until expansion arrives." };
  }
  if (regime === "elevated" || regime === "extreme" || score >= 65) {
    return { label: "Elevated", detail: "Volatility is elevated — favour smaller size and clearer invalidation." };
  }
  return { label: "Normal", detail: "Volatility is in a normal operating band for selective participation." };
}

function structureFromCandles(candles: OhlcvPoint[] | null | undefined): DecisionDeskModel["marketStructure"] {
  if (!candles?.length) {
    return {
      label: "Structure awaiting candles",
      detail: "Verified ES candle history is required before higher-high / range / lower-low structure can be described.",
    };
  }
  const stats = candleSessionStats(candles);
  if (!stats) {
    return {
      label: "Structure incomplete",
      detail: "Not enough verified candle range to classify market structure yet.",
    };
  }
  const ema = exponentialMovingAverage(candles, 20);
  const emaLatest = ema.at(-1)?.value;
  const vwap = volumeWeightedAveragePrice(candles);
  const vwapLatest = vwap.at(-1)?.value;
  const aboveEma = emaLatest != null && stats.latest > emaLatest;
  const aboveVwap = vwapLatest != null && stats.latest > vwapLatest;

  if (stats.rangePosition >= 68 && aboveEma) {
    return {
      label: "Higher highs / upper range",
      detail: `Price sits in the upper ${Math.round(stats.rangePosition)}% of the verified 24h range${aboveVwap ? ", above VWAP" : ""}${aboveEma ? " and above EMA20" : ""}.`,
    };
  }
  if (stats.rangePosition <= 32 && !aboveEma) {
    return {
      label: "Lower lows / lower range",
      detail: `Price sits in the lower ${Math.round(100 - stats.rangePosition)}% of the verified 24h range${aboveVwap ? "" : ", below VWAP"}${aboveEma ? "" : " and below EMA20"}.`,
    };
  }
  return {
    label: "Range / balanced",
    detail: `Price is mid-range (${Math.round(stats.rangePosition)}% of verified 24h high–low)${aboveEma ? ", still above EMA20" : ", still below EMA20"}${aboveVwap ? " and above VWAP" : " and below VWAP"}.`,
  };
}

function buildThesis(input: {
  verified: boolean;
  decision: TradingDecision;
  plan: TradePlan;
  intelligence: MarketIntelligence;
  structure: DecisionDeskModel["marketStructure"];
  missing: string[];
}): string {
  if (!input.verified) {
    const gap = input.missing[0]
      ?? "Verified quotes, levels, or evidence needed for a decision-ready desk brief.";
    return `Trade thesis is held until the decision window clears. Currently missing: ${humanizeFragments(gap)}.`;
  }

  const bias = input.decision.marketBias;
  const posture = pretty(input.plan.preferredSetupType);
  const structure = input.structure.label.toLowerCase();
  const breadth = input.intelligence.scores.marketSentiment;
  const breadthCopy = breadth >= 58
    ? "breadth lean is constructive"
    : breadth <= 42
      ? "breadth lean is cautious"
      : "breadth remains mixed";

  if (input.decision.tradePermission === "no-trade") {
    const reason = input.missing[0] ?? "participation filters remain closed";
    return `Stand aside while ${humanizeFragments(reason).toLowerCase()}. Structure reads as ${structure}; revisit when confirmations improve.`;
  }

  if (bias === "bullish") {
    return `The market bias is bullish with ${structure}. ${breadthCopy.slice(0, 1).toUpperCase()}${breadthCopy.slice(1)}. Pullbacks remain higher probability than aggressive shorts until structure changes — preferred approach: ${posture}.`;
  }
  if (bias === "bearish") {
    return `The market bias is bearish with ${structure}. ${breadthCopy.slice(0, 1).toUpperCase()}${breadthCopy.slice(1)}. Rallies may offer fades or short continuation — preferred approach: ${posture}.`;
  }
  return `The market bias is neutral with ${structure}. ${breadthCopy.slice(0, 1).toUpperCase()}${breadthCopy.slice(1)}. Prefer selective ${posture} only while confirmation stays incomplete.`;
}

function buildOpportunity(input: {
  verified: boolean;
  decision: TradingDecision;
  plan: TradePlan;
  support: string | null;
  resistance: string | null;
  missing: string[];
}): DecisionDeskModel["opportunity"] {
  const closed =
    !input.verified
    || input.decision.tradePermission === "no-trade"
    || input.plan.preferredSetupType === "none"
    || input.plan.executionReadiness === "not-ready"
    || input.plan.directionalPosture === "stand-aside";

  if (closed) {
    return {
      available: false,
      headline: NO_SETUP,
      preferredDirection: "Stand aside",
      entryZone: input.missing[0]
        ? `Waiting on: ${humanizeFragments(input.missing[0])}`
        : "No verified entry zone until a high-probability setup clears.",
      invalidation: "Not applicable while no setup is active.",
      targetArea: "Not applicable while no setup is active.",
      riskLevel: input.verified ? pretty(input.decision.riskRating) : "Unrated until verified inputs clear",
    };
  }

  const direction = input.plan.directionalPosture === "long-bias"
    ? "Long bias"
    : input.plan.directionalPosture === "short-bias"
      ? "Short bias"
      : "Neutral / selective";

  const entry = input.plan.preferredSetupType === "pullback" && input.support
    ? `Pullback zone near verified support ${input.support}`
    : input.plan.preferredSetupType === "breakout" && input.resistance
      ? `Breakout acceptance above verified resistance ${input.resistance}`
      : input.support && input.resistance
        ? `Work the verified range ${input.support}–${input.resistance}`
        : `Follow ${pretty(input.plan.preferredSetupType)} only with fresh confirmation`;

  const invalidation = input.decision.invalidationConditions[0];
  let invalidationCopy = "Reassess if confidence collapses or data quality fails.";
  if (invalidation?.kind === "BELOW_SUPPORT" && invalidation.level) {
    invalidationCopy = `Invalid below verified support near ${invalidation.level}`;
  } else if (invalidation?.kind === "ABOVE_RESISTANCE" && invalidation.level) {
    invalidationCopy = `Invalid above verified resistance near ${invalidation.level}`;
  } else if (invalidation?.kind === "OUTSIDE_RANGE") {
    invalidationCopy = "Invalid if price leaves the verified decision range";
  } else if (invalidation?.kind === "CONFIDENCE_BELOW" && invalidation.threshold != null) {
    invalidationCopy = `Invalid if desk confidence falls below ${invalidation.threshold}`;
  }

  const target = input.plan.directionalPosture === "long-bias" && input.resistance
    ? `First reference toward verified resistance ${input.resistance}`
    : input.plan.directionalPosture === "short-bias" && input.support
      ? `First reference toward verified support ${input.support}`
      : "Hold for the next verified structure reference — no invented targets";

  return {
    available: true,
    headline: `Highest probability setup: ${pretty(input.plan.preferredSetupType)}`,
    preferredDirection: direction,
    entryZone: entry,
    invalidation: invalidationCopy,
    targetArea: target,
    riskLevel: pretty(input.decision.riskRating),
  };
}

export function buildDecisionDesk(input: {
  verified: boolean;
  decision: TradingDecision;
  plan: TradePlan;
  intelligence: MarketIntelligence;
  session: SessionClockReading;
  candles: OhlcvPoint[] | null | undefined;
  expectedMoveLabel: string;
  support: string | null;
  resistance: string | null;
}): DecisionDeskModel {
  const missing = formatCustomerParticipationWarnings(
    input.decision.noTradeReasons,
    input.decision.dataQualityWarnings,
    input.plan.eventRiskWarnings.map((warning) => warning.code),
  ).map(humanizeFragments);

  const score = input.verified
    ? Math.round(input.decision.confidenceScore || input.intelligence.scores.bullseyeConfidence || 0)
    : null;
  const band = confidenceBandFromScore(score, input.verified);
  const structure = structureFromCandles(input.candles);
  const trend = trendReading(input.intelligence.scores.trend, input.verified);
  const volatility = volatilityReading(
    input.decision.volatilityRegime,
    input.intelligence.scores.volatility,
    input.verified,
  );

  const breadthScore = input.intelligence.scores.marketSentiment;
  const factors = [
    {
      label: "Trend quality",
      detail: input.verified
        ? trend.detail
        : "Trend quality not scored until verified inputs arrive.",
    },
    {
      label: "Volatility",
      detail: input.verified
        ? volatility.detail
        : "Volatility regime not confirmed yet.",
    },
    {
      label: "Breadth",
      detail: input.verified
        ? `Sentiment score ${breadthScore}/100 — ${
          breadthScore >= 58 ? "constructive lean" : breadthScore <= 42 ? "cautious lean" : "mixed lean"
        }.`
        : "Breadth / sentiment withheld while feeds are incomplete.",
    },
    {
      label: "Confirmation",
      detail: input.verified
        ? input.plan.requiredConfirmations[0]
          ? `Still watching: ${pretty(input.plan.requiredConfirmations[0]).toLowerCase()}.`
          : `Execution readiness: ${pretty(input.plan.executionReadiness)}.`
        : "Confirmations stay closed until the decision window is complete.",
    },
    {
      label: "Missing inputs",
      detail: missing[0]
        ?? (input.verified
          ? "No critical inputs flagged for this update."
          : "Verified quotes, levels, or evidence still needed."),
    },
  ];

  const why = !input.verified
    ? "Confidence stays qualitative until verified decision inputs clear — a missing score is not a bearish signal."
    : band === "Strong" || band === "High"
      ? "Drivers agree across trend, breadth, and data quality, so confidence is elevated."
      : band === "Moderate"
        ? "Some agreement exists, but mixed drivers or incomplete confirmation keep confidence moderate."
        : "Dispersion or weak confirmation keeps confidence low — favour defence over aggression.";

  const expectedFriendly = humanizeFragments(input.expectedMoveLabel);
  const expectedMove = /not yet confirmed|without verified|incomplete/i.test(expectedFriendly)
    ? {
      label: "Expected move awaiting range",
      detail: "A verified candle range is required before an educational expected-move width can be shown.",
    }
    : {
      label: expectedFriendly,
      detail: "Educational range width from verified delayed candles — not a forecast guarantee.",
    };

  return {
    verified: input.verified,
    marketBias: {
      label: input.verified
        ? (input.decision.marketBias === "bullish"
          ? "Bullish"
          : input.decision.marketBias === "bearish"
            ? "Bearish"
            : "Neutral")
        : "Neutral",
      tone: input.verified
        ? (input.decision.marketBias === "bullish"
          ? "bull"
          : input.decision.marketBias === "bearish"
            ? "bear"
            : "neutral")
        : "neutral",
    },
    confidence: {
      band,
      score,
      why,
      factors,
    },
    trend,
    volatility,
    marketStructure: structure,
    sessionStatus: {
      label: input.session.label,
      detail: input.session.countdownLabel
        ? `${input.session.countdownLabel} · ${input.session.detail}`
        : input.session.detail,
    },
    expectedMove,
    tradeThesis: buildThesis({
      verified: input.verified,
      decision: input.decision,
      plan: input.plan,
      intelligence: input.intelligence,
      structure,
      missing,
    }),
    opportunity: buildOpportunity({
      verified: input.verified,
      decision: input.decision,
      plan: input.plan,
      support: input.support,
      resistance: input.resistance,
      missing,
    }),
  };
}
