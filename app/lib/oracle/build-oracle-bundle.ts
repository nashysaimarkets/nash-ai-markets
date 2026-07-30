import { buildAiMarketInsight } from "../ai-market-insight.ts";
import { buildDecisionDesk } from "../../dashboard/lib/decision-desk.ts";
import { buildDeskDecisionPresentation, buildTodaysPosture } from "../../terminal/lib/desk-decision-presentation.ts";
import { buildThirtySecondBrief } from "./thirty-second-brief.ts";
import { buildSessionTimeline } from "./session-timeline.ts";
import { buildConvictionExplainer } from "./conviction-explainer.ts";
import { buildEducationalOpportunityRadar } from "./opportunity-conditions.ts";
import { buildSessionReplay } from "./session-replay.ts";
import { upcomingVerifiedEvents } from "../../terminal/lib/event-display.ts";
import type { MarketSnapshot } from "../market-data.ts";
import type { MarketIntelligence } from "../market-intelligence-engine.ts";
import type { TradingDecision } from "../trading-decision-engine.ts";
import type { TradePlan } from "../structured-trade-planner.ts";
import type { SessionClockReading } from "../../terminal/lib/session-clock.ts";
import type { OhlcvPoint } from "../../terminal/lib/visual-terminal.ts";
import type { OracleBundle } from "../../components/oracle/OracleCompanionStack.tsx";

export function buildOracleBundle(input: {
  snapshot: MarketSnapshot;
  intelligence: MarketIntelligence;
  decision: TradingDecision;
  plan: TradePlan;
  session: SessionClockReading;
  verified: boolean;
  freshnessLabel: string;
  warnings?: string[];
  candles?: OhlcvPoint[] | null;
  support?: string | null;
  resistance?: string | null;
  expectedMoveLabel?: string;
  now?: number;
}): OracleBundle {
  const now = input.now ?? Date.now();
  const presentation = buildDeskDecisionPresentation({
    decision: input.decision,
    plan: input.plan,
    signals: null,
    warnings: input.warnings ?? [],
  });
  const posture = buildTodaysPosture(presentation);
  const desk = buildDecisionDesk({
    verified: input.verified,
    decision: input.decision,
    plan: input.plan,
    intelligence: input.intelligence,
    session: input.session,
    candles: input.candles ?? undefined,
    expectedMoveLabel: input.expectedMoveLabel ?? "Range context awaits verified candles",
    support: input.support ?? null,
    resistance: input.resistance ?? null,
  });
  const insight = buildAiMarketInsight({
    snapshot: input.snapshot,
    intelligence: input.intelligence,
    decision: input.decision,
    plan: input.plan,
    verified: input.verified,
    warnings: input.warnings,
    now,
  });
  const conviction = buildConvictionExplainer({
    snapshot: input.snapshot,
    intelligence: input.intelligence,
    decision: input.decision,
    verified: input.verified,
    now,
  });
  const hasUpcomingEvent = upcomingVerifiedEvents(input.snapshot.events, now, 1).length > 0;

  return {
    thirtySecond: buildThirtySecondBrief({
      snapshot: input.snapshot,
      decision: input.decision,
      plan: input.plan,
      verified: input.verified,
      warnings: input.warnings,
      freshnessLabel: input.freshnessLabel,
      now,
    }),
    timeline: buildSessionTimeline(new Date(now)),
    conviction,
    opportunity: buildEducationalOpportunityRadar({
      snapshot: input.snapshot,
      intelligence: input.intelligence,
      decision: input.decision,
      plan: input.plan,
      desk,
      candles: input.candles,
      verified: input.verified,
      freshness: input.freshnessLabel,
      now,
    }),
    replay: buildSessionReplay({
      snapshot: input.snapshot,
      decision: input.decision,
      presentation,
      candles: input.candles,
      verified: input.verified,
      now,
    }),
    confidenceSnapshot: {
      score: insight.confidence.score,
      band: insight.confidence.band,
      posture: posture.headline,
      lean: presentation.leanLabel,
      factorIds: conviction.factors
        .filter((factor) => factor.relation === "supports" || factor.relation === "caution")
        .map((factor) => factor.id),
      freshness: input.freshnessLabel,
    },
    checklist: {
      postureHeadline: posture.headline,
      permissionTone: presentation.permissionTone,
      hasUpcomingEvent,
    },
  };
}
