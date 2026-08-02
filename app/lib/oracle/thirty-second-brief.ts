import type { MarketSnapshot } from "../market-data.ts";
import type { TradingDecision } from "../trading-decision-engine.ts";
import type { TradePlan } from "../structured-trade-planner.ts";
import { interpretCrossMarket } from "../../dashboard/lib/cross-market-interpretation.ts";
import { upcomingVerifiedEvents, formatVerifiedEventWhen, eventTimestampMs } from "../../terminal/lib/event-display.ts";
import {
  buildDeskDecisionPresentation,
  buildTodaysPosture,
} from "../../terminal/lib/desk-decision-presentation.ts";

export type ThirtySecondBriefModel = {
  available: boolean;
  title: "Today in 30 seconds";
  posture: string;
  lean: string;
  supportingFactor: string;
  biggestRisk: string;
  nextCatalyst: string;
  avoid: string;
  freshness: string;
  disclosure: string;
};

export function buildThirtySecondBrief(input: {
  snapshot: MarketSnapshot;
  decision: TradingDecision;
  plan: TradePlan;
  verified: boolean;
  warnings?: string[];
  freshnessLabel: string;
  now?: number;
}): ThirtySecondBriefModel {
  const disclosure =
    "Educational orientation from verified delayed inputs. Not personalised advice and not a forecast.";
  const presentation = buildDeskDecisionPresentation({
    decision: input.decision,
    plan: input.plan,
    signals: null,
    warnings: input.warnings ?? [],
  });
  const posture = buildTodaysPosture(presentation);
  const now = input.now ?? Date.now();
  const next = upcomingVerifiedEvents(input.snapshot.events, now, 1)[0] ?? null;
  const nextStamp = next ? eventTimestampMs(next) : null;

  if (!input.verified) {
    return {
      available: false,
      title: "Today in 30 seconds",
      posture: "Stay patient",
      lean: "Not established",
      supportingFactor: "Verified decision inputs are incomplete",
      biggestRisk: "Acting before confirmation recovers",
      nextCatalyst: next
        ? `${next.name} — ${nextStamp != null ? formatVerifiedEventWhen(nextStamp) : next.time}`
        : "No upcoming verified catalyst listed",
      avoid: "Treating an incomplete decision window as a trade setup",
      freshness: input.freshnessLabel,
      disclosure,
    };
  }

  const cross = interpretCrossMarket(input.snapshot);
  const supporting = cross.split(".")[0]?.trim() || "Verified cross-market prints are mixed";
  const risk = presentation.primaryRisk
    ?? (next ? "Unresolved event risk is approaching" : "Confirmation remains incomplete");
  const avoid = next
    ? "Chasing price immediately before unresolved event risk"
    : "Treating an observed lean as a completed setup";

  return {
    available: true,
    title: "Today in 30 seconds",
    posture: posture.headline,
    lean: presentation.leanLabel,
    supportingFactor: supporting,
    biggestRisk: risk,
    nextCatalyst: next
      ? `${next.name} — ${nextStamp != null ? formatVerifiedEventWhen(nextStamp) : next.time}`
      : "No upcoming verified catalyst listed",
    avoid,
    freshness: input.freshnessLabel,
    disclosure,
  };
}
