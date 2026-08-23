/**
 * Today’s Game Plan — presentation only from verified decision, plan and levels.
 * Never invents trade-of-the-day fills, guarantees or unsupported accuracy claims.
 */

import type { DeskDecisionPresentation } from "../../terminal/lib/desk-decision-presentation.ts";
import type { TradePlan } from "../../lib/structured-trade-planner.ts";
import type { DashboardLevelItem } from "./dashboard-command-summary.ts";
import type { CustomerCandleSeries } from "../../lib/providers/financial-modeling-prep-candles.ts";
import { candleSessionStats } from "./candle-analysis.ts";

export type TodaysGamePlanModel = {
  title: string;
  bias: string;
  confidence: string;
  confidenceDetail: string | null;
  confirmationLevel: string | null;
  invalidationLevel: string | null;
  maximumRisk: string;
  bestWindow: string;
  avoidIf: string[];
  tradeOfTheDay: string | null;
  tradeOfTheDayNote: string;
  mindset: string;
  expectedMove: string | null;
  expectedMoveDetail: string | null;
  permissionLabel: string;
  permissionTone: DeskDecisionPresentation["permissionTone"];
  disclosure: string;
};

function humanize(value: string): string {
  return value.replaceAll("_", " ").replaceAll("-", " ");
}

function expectedMoveFromCandles(series: CustomerCandleSeries | null): {
  label: string | null;
  detail: string | null;
} {
  if (!series?.candles?.length) {
    return {
      label: null,
      detail: "Expected move awaits a verified 24-hour candle range.",
    };
  }
  const stats = candleSessionStats(series.candles);
  if (!stats || !(stats.high > stats.low)) {
    return {
      label: null,
      detail: "Expected move is withheld until a verified range is available.",
    };
  }
  const pts = stats.high - stats.low;
  return {
    label: `${pts.toFixed(2)} pts (24h range)`,
    detail: "Observed width of the verified delayed 24-hour candle window — not a forecast.",
  };
}

function pickLevel(levels: DashboardLevelItem[], matcher: RegExp): string | null {
  return levels.find((item) => matcher.test(item.label))?.value ?? null;
}

/** Compose the Game Plan centrepiece from existing verified outputs only. */
export function buildTodaysGamePlan(input: {
  decision: DeskDecisionPresentation;
  plan: TradePlan | null;
  levels: DashboardLevelItem[];
  candleSeries: CustomerCandleSeries | null;
  sessionLabel: string;
}): TodaysGamePlanModel {
  const { decision, plan, levels } = input;
  const move = expectedMoveFromCandles(input.candleSeries);
  const upside = pickLevel(levels, /high|upside|resistance/i);
  const downside = pickLevel(levels, /low|downside|support/i);

  const confirmationLevel =
    decision.leanTone === "bear"
      ? downside
      : decision.leanTone === "bull"
        ? upside
        : upside && downside
          ? `${downside} – ${upside}`
          : upside ?? downside;

  const invalidation =
    plan?.invalidationConditions?.[0]?.kind
      ? humanize(plan.invalidationConditions[0].kind)
      : decision.primaryRisk
        ? decision.primaryRisk
        : "Invalidation awaits clearer verified structure.";

  const avoidIf = [
    ...(plan?.reasonsToRemainSidelined ?? []).slice(0, 3).map(humanize),
    ...(decision.permissionTone === "blocked"
      ? ["Confirmation evidence remains incomplete."]
      : []),
  ].filter(Boolean);
  if (!avoidIf.length) {
    avoidIf.push("Do not increase size solely because price has already moved.");
  }

  const bestWindow =
    /PRE-MARKET|PRE MARKET/i.test(input.sessionLabel)
      ? "After the cash open settles and your confirmations are met."
      : /POST-MARKET|CLOSED/i.test(input.sessionLabel)
        ? "Use the post-market window for review — not for chasing delayed prints."
        : plan?.preferredSetupType && plan.preferredSetupType !== "none"
          ? `When ${humanize(plan.preferredSetupType)} conditions align with your checklist.`
          : "Only inside your prepared window after checklist confirmations.";

  const mindset =
    decision.permissionTone === "blocked"
      ? "Patience protects capital. Incomplete confirmation is not a signal to force activity."
      : decision.permissionTone === "caution"
        ? "Proceed only with defined risk. Supportive context is not a guarantee."
        : "Stay process-first. Even permitted conditions can reverse without notice.";

  const maxRisk =
    plan?.participationLevel === "none"
      ? "Stand aside — no participation sizing while confirmation is incomplete."
      : plan?.participationLevel
        ? `Keep size ${humanize(plan.participationLevel)} until confirmations hold.`
        : "Risk size stays undefined until participation is permitted.";

  return {
    title: "Today’s Game Plan",
    bias: decision.leanLabel,
    confidence: decision.confidenceLabel,
    confidenceDetail: decision.confidenceDetail,
    confirmationLevel,
    invalidationLevel: invalidation,
    maximumRisk: maxRisk,
    bestWindow,
    avoidIf: avoidIf.slice(0, 4),
    tradeOfTheDay: null,
    tradeOfTheDayNote:
      "No guaranteed ‘trade of the day’ is published. Use Ideas and the Desk only after your own confirmation checklist.",
    mindset,
    expectedMove: move.label,
    expectedMoveDetail: move.detail,
    permissionLabel: decision.permissionLabel,
    permissionTone: decision.permissionTone,
    disclosure:
      "Educational plan from verified delayed inputs and deterministic engine outputs. Not personalised financial advice.",
  };
}
