import type { MarketSnapshot } from "../../lib/market-data.ts";
import { isDecisionReadySnapshot } from "../../lib/market-data.ts";
import type { MarketIntelligence } from "../../lib/market-intelligence-engine.ts";
import type { TradePlan } from "../../lib/structured-trade-planner.ts";
import type { TradingDecision } from "../../lib/trading-decision-engine.ts";
import { groupVerifiedEvents } from "../../terminal/lib/event-display.ts";

export type DailyMission = {
  available: boolean;
  marketCondition: string;
  confidence: number | null;
  directionalBias: string;
  keyWarning: string;
  nextAction: string;
};

export type NextEconomicEvent = {
  name: string;
  risk: "HIGH" | "MED";
  startsAt: string;
  countdown: string;
  includes: string[];
};

const pretty = (value: string) => value.replaceAll("_", " ").replaceAll("-", " ").toLowerCase();

export function currentServerTimestamp(): number {
  return Date.now();
}

export function buildDailyMission(
  snapshot: MarketSnapshot,
  intelligence: MarketIntelligence,
  decision: TradingDecision,
  plan: TradePlan,
): DailyMission {
  const verified = isDecisionReadySnapshot(snapshot) && intelligence.actionable;
  if (!verified) {
    return {
      available: false,
      marketCondition: "Verified market condition unavailable",
      confidence: null,
      directionalBias: "Neutral / stand aside",
      keyWarning: "Current provider data is outside the decision window. No directional output is active.",
      nextAction: "Wait for a verified provider update, then refresh the dashboard.",
    };
  }
  const warning = decision.noTradeReasons[0]
    ?? plan.reasonsToRemainSidelined[0]
    ?? decision.dataQualityWarnings[0]?.code
    ?? (decision.tradePermission === "actionable" ? "No critical engine warning" : "Proceed with caution");
  const nextCondition = plan.reviewTrigger.conditions[0] ?? "PROVIDER_UPDATE";
  return {
    available: true,
    marketCondition: `${pretty(intelligence.dominantScenario)} scenario · ${snapshot.risk.toLowerCase()} risk`,
    confidence: intelligence.scores.bullseyeConfidence,
    directionalBias: pretty(decision.marketBias),
    keyWarning: pretty(warning),
    nextAction: decision.tradePermission === "no-trade"
      ? "Remain sidelined until the no-trade conditions clear."
      : `Recalculate when ${pretty(nextCondition)} occurs.`,
  };
}

export function formatEventCountdown(startsAt: string, now = Date.now()): string | null {
  const timestamp = Date.parse(startsAt);
  if (!Number.isFinite(timestamp) || timestamp <= now) return null;
  const totalMinutes = Math.max(1, Math.ceil((timestamp - now) / 60_000));
  const days = Math.floor(totalMinutes / 1_440);
  const hours = Math.floor((totalMinutes % 1_440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function selectNextEconomicEvent(events: MarketSnapshot["events"], now = Date.now()): NextEconomicEvent | null {
  const next = groupVerifiedEvents(events, now, 1)[0];
  if (!next?.at) return null;
  const countdown = formatEventCountdown(next.at, now);
  if (!countdown) return null;
  return {
    name: next.name,
    risk: next.risk,
    startsAt: next.at,
    countdown,
    includes: next.includes.map((item) => item.name),
  };
}

export function memberDisplayName(email: string, metadata: Record<string, unknown> | undefined): string {
  const preferred = metadata?.preferred_name ?? metadata?.first_name ?? metadata?.given_name;
  if (typeof preferred === "string" && preferred.trim().length >= 2) {
    return preferred.trim().slice(0, 60);
  }
  const candidate = metadata?.full_name ?? metadata?.name;
  if (typeof candidate === "string" && candidate.trim()) return candidate.trim().slice(0, 60);
  const localPart = email.split("@")[0]?.replace(/[._-]+/g, " ").trim();
  return localPart ? localPart.replace(/\b\w/g, (letter) => letter.toUpperCase()).slice(0, 60) : "Member";
}
