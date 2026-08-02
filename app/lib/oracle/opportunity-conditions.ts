import type { MarketSnapshot } from "../market-data.ts";
import type { MarketIntelligence } from "../market-intelligence-engine.ts";
import type { TradingDecision } from "../trading-decision-engine.ts";
import type { TradePlan } from "../structured-trade-planner.ts";
import type { DecisionDeskModel } from "../../dashboard/lib/decision-desk.ts";
import { upcomingVerifiedEvents } from "../../terminal/lib/event-display.ts";
import { candleSessionStats } from "../../dashboard/lib/candle-analysis.ts";
import type { OhlcvPoint } from "../../terminal/lib/visual-terminal.ts";

export type OpportunityStatus = "watching" | "developing" | "inactive" | "unavailable";

export type OpportunityConditionCard = {
  id: string;
  category: string;
  status: OpportunityStatus;
  supporting: string[];
  missing: string[];
  invalidation: string;
  levels: string[];
  eventRisk: string | null;
  freshness: string;
  disclosure: string;
};

export type OpportunityRadarEducational = {
  cards: OpportunityConditionCard[];
  activeCount: number;
  disclosure: string;
};

const DISCLOSURE =
  "Educational condition watches from verified delayed inputs. Conditions currently resemble a setup family — not buy/sell commands, personalised entries or guaranteed outcomes.";

export function buildEducationalOpportunityRadar(input: {
  snapshot: MarketSnapshot;
  intelligence: MarketIntelligence;
  decision: TradingDecision;
  plan: TradePlan;
  desk: DecisionDeskModel;
  candles?: OhlcvPoint[] | null;
  verified: boolean;
  freshness: string;
  now?: number;
}): OpportunityRadarEducational {
  const now = input.now ?? Date.now();
  const next = upcomingVerifiedEvents(input.snapshot.events, now, 1)[0] ?? null;
  const stats = input.candles?.length ? candleSessionStats(input.candles) : null;
  const eventRisk = next ? `Upcoming verified catalyst: ${next.name}` : null;

  if (!input.verified) {
    return {
      activeCount: 0,
      disclosure: DISCLOSURE,
      cards: [
        {
          id: "insufficient",
          category: "No-trade / insufficient confirmation",
          status: "unavailable",
          supporting: [],
          missing: ["Decision-ready verified inputs"],
          invalidation: "Not applicable while confirmation is incomplete",
          levels: [],
          eventRisk,
          freshness: input.freshness,
          disclosure: DISCLOSURE,
        },
      ],
    };
  }

  const cards: OpportunityConditionCard[] = [];
  const lean = input.decision.marketBias;
  const rangePos = stats?.rangePosition ?? null;
  const permissionBlocked = /no_trade|stand_aside|blocked/i.test(input.decision.tradePermission);

  if (permissionBlocked || !input.desk.opportunity.available) {
    cards.push({
      id: "no-trade",
      category: "No-trade / insufficient confirmation",
      status: "watching",
      supporting: ["Participation remains restricted on verified inputs"],
      missing: ["Clearer confirmation across volatility, dollar and structure"],
      invalidation: "A verified high-quality setup becoming available with completed confirmations",
      levels: [],
      eventRisk,
      freshness: input.freshness,
      disclosure: DISCLOSURE,
    });
  }

  if (next) {
    cards.push({
      id: "event-hold",
      category: "Event-risk hold",
      status: "watching",
      supporting: [`Verified release listed: ${next.name}`],
      missing: ["Post-release confirmation of acceptance or rejection"],
      invalidation: "Catalyst window passes without unresolved risk",
      levels: [],
      eventRisk,
      freshness: input.freshness,
      disclosure: DISCLOSURE,
    });
  }

  if (lean === "bullish" && rangePos != null && rangePos >= 65) {
    cards.push({
      id: "breakout-watch",
      category: "Breakout continuation watch",
      status: "developing",
      supporting: [
        "Observed market lean is bullish",
        `Price sits in the upper portion of the verified 24-hour range (${Math.round(rangePos)}%)`,
      ],
      missing: ["Acceptance beyond the verified 24-hour high with confirming volatility behaviour"],
      invalidation: "Failure back into the mid-range with rising volatility",
      levels: stats ? [`24h high ${stats.high.toFixed(2)}`, `24h low ${stats.low.toFixed(2)}`] : [],
      eventRisk,
      freshness: input.freshness,
      disclosure: DISCLOSURE,
    });
  }

  if (lean === "bearish" && rangePos != null && rangePos <= 35) {
    cards.push({
      id: "failed-breakout",
      category: "Failed breakout watch",
      status: "developing",
      supporting: [
        "Observed market lean is bearish",
        `Price sits in the lower portion of the verified 24-hour range (${Math.round(rangePos)}%)`,
      ],
      missing: ["Confirmed rejection of the verified upside area"],
      invalidation: "Reclaim of the mid-range with easing volatility",
      levels: stats ? [`24h high ${stats.high.toFixed(2)}`, `24h low ${stats.low.toFixed(2)}`] : [],
      eventRisk,
      freshness: input.freshness,
      disclosure: DISCLOSURE,
    });
  }

  if (lean === "bullish" || lean === "bearish") {
    cards.push({
      id: "pullback-watch",
      category: "Trend pullback watch",
      status: "watching",
      supporting: [`Observed lean: ${lean}`],
      missing: ["Pullback into a verified reference with renewed directional confirmation"],
      invalidation: "Lean flips or confirmation stays incomplete",
      levels: stats ? [`Latest ${stats.latest.toFixed(2)}`] : [],
      eventRisk,
      freshness: input.freshness,
      disclosure: DISCLOSURE,
    });
  }

  if (rangePos != null && rangePos > 40 && rangePos < 60 && lean === "neutral") {
    cards.push({
      id: "mean-reversion",
      category: "Mean-reversion watch",
      status: "watching",
      supporting: ["Price is mid-range on verified candles with a neutral lean"],
      missing: ["Clear rejection from a verified extreme"],
      invalidation: "Directional break with confirming cross-asset pressure",
      levels: stats ? [`24h mid ~${((stats.high + stats.low) / 2).toFixed(2)}`] : [],
      eventRisk,
      freshness: input.freshness,
      disclosure: DISCLOSURE,
    });
  }

  if (!cards.length) {
    cards.push({
      id: "inactive",
      category: "No-trade / insufficient confirmation",
      status: "inactive",
      supporting: ["No active educational setup family currently matches verified conditions"],
      missing: ["Clearer lean, range location or catalyst context"],
      invalidation: "Not applicable",
      levels: [],
      eventRisk,
      freshness: input.freshness,
      disclosure: DISCLOSURE,
    });
  }

  const activeCount = cards.filter((card) => card.status === "watching" || card.status === "developing").length;
  return { cards: cards.slice(0, 4), activeCount, disclosure: DISCLOSURE };
}
