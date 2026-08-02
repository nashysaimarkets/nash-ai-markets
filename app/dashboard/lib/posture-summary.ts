import type { MarketSnapshot } from "../../lib/market-data.ts";
import type { DailyMission } from "./daily-dashboard.ts";
import type { TradingDecision } from "../../lib/trading-decision-engine.ts";
import type { TradePlan } from "../../lib/structured-trade-planner.ts";

type CandleStats = { high: number; low: number; latest: number } | null;

function pretty(value: string) {
  return value.replaceAll("_", " ").replaceAll("-", " ");
}

/** One concise posture explanation — claims only what verified inputs support. */
export function buildPostureExplanation(input: {
  decisionReady: boolean;
  decision: TradingDecision;
  plan: TradePlan;
  mission: DailyMission;
  snapshot: MarketSnapshot;
  candleStats: CandleStats;
  interpretation: string;
}): { posture: string; explanation: string; reviewTrigger: string } {
  const { decisionReady, decision, plan, mission, candleStats, interpretation } = input;
  if (!decisionReady) {
    return {
      posture: "Stand aside",
      explanation: `${interpretation} Directional planning stays closed until verified inputs are inside the current decision window.`,
      reviewTrigger: mission.nextAction,
    };
  }

  const range = candleStats
    ? `ES sits near ${candleStats.latest.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} within the verified rolling range ${candleStats.low.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}–${candleStats.high.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`
    : "Verified rolling range statistics are not yet available from candles.";

  const posture = decision.tradePermission === "no-trade"
    ? "Stand aside"
    : decision.tradePermission === "caution"
      ? "Caution"
      : pretty(plan.directionalPosture);

  const explanation = `${range} ${interpretation} Preferred approach: ${pretty(plan.preferredSetupType)}.`;
  const reviewTrigger = plan.reviewTrigger.conditions[0]
    ? `Reassess when ${pretty(plan.reviewTrigger.conditions[0]).toLowerCase()}.`
    : mission.nextAction;

  return { posture, explanation, reviewTrigger };
}
