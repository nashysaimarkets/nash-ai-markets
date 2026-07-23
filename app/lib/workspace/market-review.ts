/**
 * Plain-English market review from verified desk inputs only.
 * Fail-closed when incomplete — no invented claims.
 */

import type { MarketSnapshot } from "../market-data.ts";
import type { MarketIntelligence } from "../market-intelligence-engine.ts";
import type { TradingDecision } from "../trading-decision-engine.ts";
import type { TradePlan } from "../structured-trade-planner.ts";
import type { MarketDeskSignals } from "../market-desk-signals.ts";
import type { MarketStructureLevels } from "../market-structure-levels.ts";
import { getWorkspaceInstrument, type WorkspaceInstrumentId } from "./instruments.ts";

export type MarketReviewBlock = {
  title: string;
  body: string;
  tone: "neutral" | "caution" | "constructive";
};

export type MarketReviewResult = {
  instrumentId: WorkspaceInstrumentId;
  instrumentName: string;
  available: boolean;
  unavailableReason: string | null;
  blocks: MarketReviewBlock[];
  uncertainty: string;
};

type ReviewInput = {
  instrumentId: WorkspaceInstrumentId;
  snapshot: MarketSnapshot;
  intelligence: MarketIntelligence | null;
  decision: TradingDecision | null;
  plan: TradePlan | null;
  deskSignals: MarketDeskSignals | null;
  structure: MarketStructureLevels | null;
  decisionReady: boolean;
  coverage: "quotes_and_candles" | "quotes_only" | "awaiting_provider";
};

export function buildMarketReview(input: ReviewInput): MarketReviewResult {
  const instrument = getWorkspaceInstrument(input.instrumentId);
  const instrumentName = instrument?.name ?? input.instrumentId;

  if (input.coverage === "awaiting_provider") {
    return {
      instrumentId: input.instrumentId,
      instrumentName,
      available: false,
      unavailableReason: "Awaiting verified provider coverage for this market.",
      blocks: [],
      uncertainty: "No review is offered until verified quotes and structure are available.",
    };
  }

  if (!input.decisionReady || input.snapshot.status === "UNAVAILABLE" || input.snapshot.status === "PREVIEW") {
    return {
      instrumentId: input.instrumentId,
      instrumentName,
      available: false,
      unavailableReason: "Verified decision-ready market data is not available right now.",
      blocks: [],
      uncertainty: "Stand aside until the delayed feed is decision-ready. No directional guidance is inferred.",
    };
  }

  const blocks: MarketReviewBlock[] = [];
  const bias = input.intelligence?.dominantScenario ?? input.snapshot.bias;
  if (bias) {
    blocks.push({
      title: "Trend context",
      body: `Current verified bias reads as ${bias}. This is educational context from the delayed snapshot, not a trade instruction.`,
      tone: "neutral",
    });
  }

  if (input.deskSignals) {
    const lean = input.deskSignals.overallLean;
    const activeSide = lean === "buying"
      ? input.deskSignals.buying
      : lean === "selling"
        ? input.deskSignals.selling
        : null;
    blocks.push({
      title: "Desk lean",
      body: activeSide
        ? `${activeSide.headline} ${activeSide.summary}`
        : `Overall desk lean is ${lean}. ${input.deskSignals.contextNotes[0] ?? ""}`.trim(),
      tone: "constructive",
    });
  }

  if (input.decision?.volatilityRegime) {
    const regime = input.decision.volatilityRegime;
    blocks.push({
      title: "Volatility",
      body: `Volatility regime from verified inputs: ${regime}. Treat this as a risk backdrop, not a timing signal.`,
      tone: regime === "elevated" || regime === "extreme" ? "caution" : "neutral",
    });
  }

  const board = instrument?.boardSymbol;
  const levels = input.structure?.instruments?.find((item) => (board ? item.symbol === board : false))
    ?? input.structure?.instruments?.[0];
  if (levels?.status === "ready") {
    const parts = [
      levels.support ? `Nearby support: ${levels.support.display}.` : null,
      levels.resistance ? `Nearby resistance: ${levels.resistance.display}.` : null,
    ].filter(Boolean);
    if (parts.length) {
      blocks.push({
        title: "Structure",
        body: `${parts.join(" ")} Levels come from verified candle/structure references only.`,
        tone: "neutral",
      });
    }
  }

  const bullish = input.intelligence?.scenarios?.find((scenario) => scenario.type === "BULLISH");
  const bearish = input.intelligence?.scenarios?.find((scenario) => scenario.type === "BEARISH");
  if (bullish?.trigger?.level || bearish?.trigger?.level) {
    blocks.push({
      title: "Scenarios",
      body: [
        bullish?.trigger?.level ? `Bullish confirmation context above ${bullish.trigger.level}.` : null,
        bearish?.trigger?.level ? `Bearish confirmation context below ${bearish.trigger.level}.` : null,
        bullish?.invalidation?.level ? `Bullish invalidation near ${bullish.invalidation.level}.` : null,
        bearish?.invalidation?.level ? `Bearish invalidation near ${bearish.invalidation.level}.` : null,
      ].filter(Boolean).join(" "),
      tone: "constructive",
    });
  }

  if (input.plan?.directionalPosture) {
    blocks.push({
      title: "Participation posture",
      body: `Plan posture from verified constraints: ${input.plan.directionalPosture}. Educational only — not personalised advice.`,
      tone: "caution",
    });
  }

  if (input.snapshot.events?.length) {
    const next = input.snapshot.events[0]!;
    blocks.push({
      title: "Next verified event",
      body: `${next.name} around ${next.time} (${next.risk} impact). Event times are provider-verified when shown.`,
      tone: "caution",
    });
  }

  if (input.snapshot.risk) {
    blocks.push({
      title: "Risk rating",
      body: `Snapshot risk backdrop: ${input.snapshot.risk}. This reflects verified macro/cross-asset conditions, not your personal risk capacity.`,
      tone: input.snapshot.risk === "HIGH" || input.snapshot.risk === "ELEVATED" ? "caution" : "neutral",
    });
  }

  if (!blocks.length) {
    return {
      instrumentId: input.instrumentId,
      instrumentName,
      available: false,
      unavailableReason: "Not enough verified inputs to build a useful market review.",
      blocks: [],
      uncertainty: "Incomplete evidence — no narrative is invented.",
    };
  }

  return {
    instrumentId: input.instrumentId,
    instrumentName,
    available: true,
    unavailableReason: null,
    blocks,
    uncertainty: "Uncertainty remains: delayed data can age out, catalysts can reprice levels, and scenarios can fail. Stand aside when evidence conflicts.",
  };
}
