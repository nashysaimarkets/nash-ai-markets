/**
 * Deterministic AI Market Insight + Bull/Bear presentation.
 * Uses verified quotes, intelligence scenarios and decision outputs only.
 * Scenario weights are educational — never calibrated win probabilities.
 */

import type { MarketSnapshot } from "./market-data.ts";
import type { MarketIntelligence } from "./market-intelligence-engine.ts";
import type { TradePlan } from "./structured-trade-planner.ts";
import type { TradingDecision } from "./trading-decision-engine.ts";
import { interpretCrossMarket } from "../dashboard/lib/cross-market-interpretation.ts";
import {
  confidenceBandFromScore,
  type ConfidenceBand,
} from "../dashboard/lib/decision-desk.ts";
import { upcomingVerifiedEvents } from "../terminal/lib/event-display.ts";
import {
  buildDeskDecisionPresentation,
  buildTodaysPosture,
} from "../terminal/lib/desk-decision-presentation.ts";

function soften(value: string): string {
  return value
    .replace(/\bno-trade\b/gi, "restricted participation")
    .replace(/\bstand aside\b/gi, "stay patient")
    .replace(/\s+/g, " ")
    .trim();
}

export type CompanionConfidenceBand = "Low" | "Medium" | "High" | "Very High" | "Awaiting inputs";

export type BullBearSide = {
  label: "Bullish" | "Neutral" | "Bearish";
  probability: number;
  factors: string[];
};

export type BullBearMeterModel = {
  available: boolean;
  disclosure: string;
  bullish: BullBearSide;
  neutral: BullBearSide;
  bearish: BullBearSide;
  dominant: "Bullish" | "Neutral" | "Bearish" | "Unavailable";
};

export type PremiumConfidenceModel = {
  available: boolean;
  score: number | null;
  band: CompanionConfidenceBand;
  label: string;
  detail: string;
};

export type MarketInternalCard = {
  id: "breadth" | "put-call" | "trin";
  label: string;
  available: false;
  status: "Unavailable";
  detail: string;
};

export type AiMarketInsightModel = {
  available: boolean;
  title: "AI Market Insight";
  narrative: string;
  wordCount: number;
  watch: string | null;
  opportunity: string | null;
  danger: string | null;
  disclosure: string;
  bullBear: BullBearMeterModel;
  confidence: PremiumConfidenceModel;
  internals: MarketInternalCard[];
};

function mapConfidenceBand(band: ConfidenceBand | "Awaiting inputs"): CompanionConfidenceBand {
  if (band === "Awaiting inputs") return "Awaiting inputs";
  if (band === "Strong") return "Very High";
  if (band === "Moderate") return "Medium";
  return band;
}

function clipNarrative(text: string, minWords = 80, maxWords = 150): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  const words = cleaned.split(" ").filter(Boolean);
  if (words.length <= maxWords) {
    if (words.length >= minWords) return cleaned;
    return cleaned;
  }
  return `${words.slice(0, maxWords).join(" ").replace(/[,:;.\-–—]*$/, "")}.`;
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function scenarioFactors(
  scenario: MarketIntelligence["scenarios"][number],
  verified: boolean,
): string[] {
  if (!verified) return ["Scenario weight withheld until verified inputs recover."];
  const supporting = scenario.evidence
    .filter((item) => item.relation === "SUPPORTS")
    .slice(0, 3)
    .map((item) => `${item.factor.replaceAll("_", " ")} supports this case (${item.score}/100).`);
  if (supporting.length) return supporting;
  return [
    scenario.trigger.level
      ? `Trigger framing: ${scenario.trigger.kind.replaceAll("_", " ").toLowerCase()} near ${scenario.trigger.level}.`
      : `Trigger framing: ${scenario.trigger.kind.replaceAll("_", " ").toLowerCase()}.`,
  ];
}

export function buildBullBearMeter(
  intelligence: MarketIntelligence,
  verified: boolean,
): BullBearMeterModel {
  const bull = intelligence.scenarios.find((item) => item.type === "BULLISH");
  const neutral = intelligence.scenarios.find((item) => item.type === "NEUTRAL");
  const bear = intelligence.scenarios.find((item) => item.type === "BEARISH");
  const disclosure =
    "Bars show educational scenario weights from verified inputs — not calibrated win probabilities or trade advice.";

  if (!verified || !bull || !neutral || !bear) {
    return {
      available: false,
      disclosure,
      bullish: { label: "Bullish", probability: 0, factors: ["Unavailable until verified decision inputs clear."] },
      neutral: { label: "Neutral", probability: 0, factors: ["Unavailable until verified decision inputs clear."] },
      bearish: { label: "Bearish", probability: 0, factors: ["Unavailable until verified decision inputs clear."] },
      dominant: "Unavailable",
    };
  }

  const sides: BullBearSide[] = [
    { label: "Bullish", probability: Math.round(bull.probability), factors: scenarioFactors(bull, verified) },
    { label: "Neutral", probability: Math.round(neutral.probability), factors: scenarioFactors(neutral, verified) },
    { label: "Bearish", probability: Math.round(bear.probability), factors: scenarioFactors(bear, verified) },
  ];
  const dominantSide = [...sides].sort((a, b) => b.probability - a.probability)[0]!;

  return {
    available: true,
    disclosure,
    bullish: sides[0]!,
    neutral: sides[1]!,
    bearish: sides[2]!,
    dominant: dominantSide.label,
  };
}

export function buildPremiumConfidence(
  decision: TradingDecision,
  intelligence: MarketIntelligence,
  verified: boolean,
): PremiumConfidenceModel {
  const score = verified ? Math.round(Math.min(decision.confidenceScore, intelligence.scores.bullseyeConfidence)) : null;
  const band = mapConfidenceBand(confidenceBandFromScore(score, verified));
  if (!verified || score == null) {
    return {
      available: false,
      score: null,
      band: "Awaiting inputs",
      label: "Confidence awaiting verified inputs",
      detail: "The gauge stays empty until provider coverage and freshness clear decision readiness.",
    };
  }
  return {
    available: true,
    score,
    band,
    label: `${band} confidence`,
    detail:
      band === "Low" || band === "Medium"
        ? "Confidence stays measured while confirmation remains incomplete."
        : "Confidence reflects agreement across verified delayed inputs — still not a forecast.",
  };
}

export function buildMarketInternals(): MarketInternalCard[] {
  return [
    {
      id: "breadth",
      label: "Breadth",
      available: false,
      status: "Unavailable",
      detail: "No verified advance/decline breadth feed is connected. Engine sentiment is never shown as breadth.",
    },
    {
      id: "put-call",
      label: "Put / Call",
      available: false,
      status: "Unavailable",
      detail: "No verified equity put/call ratio feed is connected for this workspace.",
    },
    {
      id: "trin",
      label: "TRIN",
      available: false,
      status: "Unavailable",
      detail: "No verified TRIN / Arms Index feed is connected for this workspace.",
    },
  ];
}

export function buildAiMarketInsight(input: {
  snapshot: MarketSnapshot;
  intelligence: MarketIntelligence;
  decision: TradingDecision;
  plan: TradePlan;
  verified: boolean;
  warnings?: string[];
  now?: number;
}): AiMarketInsightModel {
  const now = input.now ?? Date.now();
  const presentation = buildDeskDecisionPresentation({
    decision: input.decision,
    plan: input.plan,
    signals: null,
    warnings: input.warnings ?? [],
  });
  const posture = buildTodaysPosture(presentation);
  const bullBear = buildBullBearMeter(input.intelligence, input.verified);
  const confidence = buildPremiumConfidence(input.decision, input.intelligence, input.verified);
  const internals = buildMarketInternals();
  const disclosure =
    "Educational companion commentary from verified delayed inputs. Not personalised advice and not a prediction.";

  if (!input.verified) {
    const narrative = clipNarrative(
      `${interpretCrossMarket(input.snapshot)} Today's posture stays restricted until verification recovers. ` +
        `Watch for provider recovery before treating any lean as actionable. ` +
        `The biggest danger is acting on an incomplete decision window. ` +
        `Opportunity stays withheld while confirmation data is incomplete.`,
    );
    return {
      available: false,
      title: "AI Market Insight",
      narrative,
      wordCount: wordCount(narrative),
      watch: "Verified provider recovery before using directional cues",
      opportunity: null,
      danger: "Treating an incomplete decision window as a trade setup",
      disclosure,
      bullBear,
      confidence,
      internals,
    };
  }

  const changed = interpretCrossMarket(input.snapshot);
  const nextEvent = upcomingVerifiedEvents(input.snapshot.events, now, 1)[0] ?? null;
  const lean = presentation.leanLabel;
  const permission = presentation.permissionLabel;

  const whyItMatters = soften(
    `${posture.summary} Participation reads ${permission.toLowerCase()} with an observed ${lean.toLowerCase()}.`,
  );

  const watch = nextEvent
    ? `Price behaviour around ${nextEvent.name} (${nextEvent.time})`
    : "Whether dollar, yields and volatility continue to confirm the observed lean";

  const opportunity =
    /bull/i.test(lean) && !/blocked|restricted|stand.?aside/i.test(permission)
      ? "Biggest opportunity: disciplined observation of whether the upward lean can hold without chasing the edge of the verified range."
      : /bear/i.test(lean) && !/blocked|restricted|stand.?aside/i.test(permission)
        ? "Biggest opportunity: disciplined observation of whether downside pressure continues without treating the lean as a completed setup."
        : "Biggest opportunity: patience — wait for clearer confirmation rather than forcing participation in a mixed tape.";

  const danger = presentation.primaryRisk
    ? `Biggest danger: ${soften(presentation.primaryRisk)}.`
    : nextEvent
      ? "Biggest danger: increasing exposure immediately before unresolved event risk."
      : "Biggest danger: treating an observed lean as a completed setup.";

  const narrative = clipNarrative(
    `${changed} ${whyItMatters} Traders should watch ${watch.toLowerCase()}. ${opportunity} ${danger} ` +
      `These remain conditional observations from delayed verified prints, not certainty.`,
  );

  return {
    available: true,
    title: "AI Market Insight",
    narrative,
    wordCount: wordCount(narrative),
    watch,
    opportunity,
    danger,
    disclosure,
    bullBear,
    confidence,
    internals,
  };
}
