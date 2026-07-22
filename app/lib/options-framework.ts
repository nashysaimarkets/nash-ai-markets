import type { MarketSnapshot } from "./market-data.ts";
import type { TradingDecision } from "./trading-decision-engine.ts";
import type { TradePlan } from "./structured-trade-planner.ts";

export type OptionsIdeaStatus = "Watching" | "Confirmed" | "Invalidated" | "Unavailable";

export type OptionsIdea = {
  id: string;
  status: OptionsIdeaStatus;
  direction: "bullish" | "bearish" | "neutral";
  strategyType: string;
  trigger: string;
  invalidation: string;
  expiryWindow: string;
  strikeSelectionLogic: string;
  maxDefinedRisk: string;
  volatilityContext: string;
  eventContext: string;
  reasonsToAvoid: string[];
  evidenceQuality: "framework-only" | "chain-verified";
  timestamp: string;
};

/** Underlying-based options framework — never invents strikes, premiums or Greeks. */
export function buildOptionsFramework(input: {
  snapshot: MarketSnapshot;
  decision: TradingDecision;
  plan: TradePlan;
  decisionReady: boolean;
}): {
  providerState: "unavailable";
  label: "Underlying-based framework";
  underlying: string | null;
  vix: string | null;
  eventRisk: string;
  expectedMove: "unavailable";
  ideas: OptionsIdea[];
  watchlist: OptionsIdea[];
  disclosure: string;
} {
  const es = input.snapshot.quotes.find((q) => q.symbol === "ES");
  const vix = input.snapshot.quotes.find((q) => q.symbol === "VIX");
  const asOf = input.snapshot.asOf || new Date().toISOString();
  const eventRisk = input.snapshot.events.length
    ? `${input.snapshot.events.length} verified catalyst(s) in window`
    : "No verified catalyst schedule";
  const baseUnavailable = !input.decisionReady || !es;

  const mk = (
    id: string,
    direction: OptionsIdea["direction"],
    strategyType: string,
    trigger: string,
    invalidation: string,
  ): OptionsIdea => ({
    id,
    status: baseUnavailable ? "Unavailable" : "Watching",
    direction,
    strategyType,
    trigger,
    invalidation,
    expiryWindow: "Prefer defined-risk expiries after the next verified catalyst window",
    strikeSelectionLogic: "Select strikes only from a verified options chain (not available in this build). Until then, use distance-from-spot logic relative to confirmed ES levels.",
    maxDefinedRisk: "Require a defined maximum loss before entry; size from account risk rules, not from unverified premiums.",
    volatilityContext: input.decisionReady
      ? `VIX regime ${input.decision.volatilityRegime}${vix ? ` · VIX ${vix.value}` : ""}`
      : "Volatility context withheld until decision-ready data",
    eventContext: eventRisk,
    reasonsToAvoid: [
      ...(input.decision.tradePermission === "no-trade" ? ["Trade permission is no-trade"] : []),
      ...(!vix ? ["VIX reading unavailable"] : []),
      "No verified options chain — exact strikes and premiums withheld",
    ],
    evidenceQuality: "framework-only",
    timestamp: asOf,
  });

  const ideas = [
    mk(
      "bullish-debit",
      "bullish",
      "Bullish debit vertical (call) — framework only",
      input.plan.directionalPosture.includes("bull") || input.decision.marketBias === "bullish"
        ? "Watch for verified upside confirmation on ES before considering a debit call vertical"
        : "Bullish framework remains Watching until posture supports upside participation",
      "Invalidate if ES loses the verified invalidation reference or data becomes stale",
    ),
    mk(
      "bearish-debit",
      "bearish",
      "Bearish debit vertical (put) — framework only",
      input.decision.marketBias === "bearish"
        ? "Watch for verified downside confirmation on ES before considering a debit put vertical"
        : "Bearish framework remains Watching until posture supports downside participation",
      "Invalidate if ES reclaims the verified invalidation reference or data becomes stale",
    ),
    mk(
      "neutral-iron",
      "neutral",
      "Defined-risk neutral structure — framework only",
      input.decision.marketBias === "neutral" || input.decision.tradePermission === "no-trade"
        ? "Neutral framework is relevant while directional permission is closed or mixed"
        : "Neutral framework stays Watching while a directional posture is active",
      "Invalidate if a verified directional break occurs with fresh data",
    ),
  ];

  return {
    providerState: "unavailable",
    label: "Underlying-based framework",
    underlying: es?.value ?? null,
    vix: vix?.value ?? null,
    eventRisk,
    expectedMove: "unavailable",
    ideas,
    watchlist: ideas,
    disclosure: "Educational options framework only. No strikes, premiums, Greeks or expected-move figures are shown without a verified options-chain provider. Futures and options involve substantial risk of loss.",
  };
}
