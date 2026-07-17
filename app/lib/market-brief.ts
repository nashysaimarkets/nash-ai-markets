import type { MarketSnapshot } from "./market-data.ts";
import type { MarketIntelligence } from "./market-intelligence-engine.ts";
import type { TradePlan } from "./structured-trade-planner.ts";
import type { TradingDecision } from "./trading-decision-engine.ts";

export type BriefMode = "ai-assisted" | "deterministic" | "unavailable";

export type MarketBriefSelection = {
  emphasis: "aligned" | "mixed" | "defensive";
  focusDrivers: string[];
  primaryRisk: string;
};

export type MarketBrief = {
  schemaVersion: "1.0";
  mode: BriefMode;
  asOf: string | null;
  headline: string;
  summary: string;
  confidence: number | null;
  marketBias: TradingDecision["marketBias"];
  tradePermission: TradingDecision["tradePermission"];
  focusDrivers: string[];
  riskFlags: string[];
  nextActions: string[];
  dataWarnings: string[];
  sourceLabel: string;
};

const humanize = (value: string) =>
  value.replaceAll("_", " ").replaceAll("-", " ").toLowerCase();

function unique(values: readonly string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

export function availableBriefDrivers(
  intelligence: MarketIntelligence,
  decision: TradingDecision,
): string[] {
  return unique([
    ...decision.topSupportingDrivers.map((driver) => driver.factor),
    ...decision.conflictingDrivers.map((driver) => driver.factor),
    ...intelligence.reasoning.riskDrivers.map((driver) => driver.factor),
    ...intelligence.reasoning.trendDrivers.map((driver) => driver.factor),
    ...intelligence.reasoning.volatilityDrivers.map((driver) => driver.factor),
  ]);
}

export function availableBriefRisks(
  decision: TradingDecision,
  plan: TradePlan,
): string[] {
  return unique([
    ...decision.noTradeReasons,
    ...decision.dataQualityWarnings.map((warning) => warning.code),
    ...plan.eventRiskWarnings.map((warning) => warning.code),
    ...plan.reasonsToRemainSidelined,
  ]);
}

function validSelection(
  selection: MarketBriefSelection | null,
  drivers: readonly string[],
  risks: readonly string[],
): MarketBriefSelection | null {
  if (!selection) return null;
  const focusDrivers = unique(selection.focusDrivers)
    .filter((driver) => drivers.includes(driver))
    .slice(0, 3);
  const primaryRisk = selection.primaryRisk === "NONE" || risks.includes(selection.primaryRisk)
    ? selection.primaryRisk
    : "NONE";
  if (focusDrivers.length === 0) return null;
  return { ...selection, focusDrivers, primaryRisk };
}

export function buildMarketBrief(
  snapshot: MarketSnapshot,
  intelligence: MarketIntelligence,
  decision: TradingDecision,
  plan: TradePlan,
  selection: MarketBriefSelection | null = null,
): MarketBrief {
  const verified = snapshot.status === "LIVE" || snapshot.status === "DELAYED";
  const dataWarnings = unique([
    ...decision.dataQualityWarnings.map((warning) => warning.code),
    ...intelligence.reasoning.missingDataWarnings.map((warning) => `${warning.code}:${warning.field}`),
  ]).map(humanize);

  if (!verified || !intelligence.actionable) {
    return {
      schemaVersion: "1.0",
      mode: "unavailable",
      asOf: null,
      headline: "Verified current market data is unavailable",
      summary: "Bullseye has paused the market brief rather than infer a directional view from preview, stale, fallback, or incomplete inputs.",
      confidence: null,
      marketBias: "neutral",
      tradePermission: "no-trade",
      focusDrivers: [],
      riskFlags: ["Current provider data is not verified for trading guidance."],
      nextActions: ["Wait for a verified provider update and refresh the brief."],
      dataWarnings,
      sourceLabel: "Unavailable · fail-closed",
    };
  }

  const drivers = availableBriefDrivers(intelligence, decision);
  const risks = availableBriefRisks(decision, plan);
  const accepted = validSelection(selection, drivers, risks);
  const selectedDrivers = accepted?.focusDrivers ?? drivers.slice(0, 3);
  const primaryRisk = accepted?.primaryRisk && accepted.primaryRisk !== "NONE"
    ? accepted.primaryRisk
    : risks[0];
  const defensive = decision.tradePermission === "no-trade" || decision.riskRating === "extreme";
  const mixed = decision.conflictingDrivers.length > 0 || decision.tradePermission === "caution";
  const emphasis = accepted?.emphasis ?? (defensive ? "defensive" : mixed ? "mixed" : "aligned");
  const headline = emphasis === "defensive"
    ? "Capital protection takes priority"
    : emphasis === "mixed"
      ? "Signals require confirmation"
      : `${humanize(decision.marketBias)} conditions are aligned`;
  const summary = decision.tradePermission === "actionable"
    ? `Verified inputs support a ${humanize(decision.recommendedPosture)} posture, subject to the listed confirmations and invalidations.`
    : decision.tradePermission === "caution"
      ? "Verified inputs are usable, but conflicts or risk conditions reduce conviction and participation."
      : "Bullseye is maintaining a no-trade posture until the listed risk or data conditions clear.";

  return {
    schemaVersion: "1.0",
    mode: accepted ? "ai-assisted" : "deterministic",
    asOf: snapshot.asOf,
    headline,
    summary,
    confidence: Math.min(decision.confidenceScore, intelligence.scores.bullseyeConfidence),
    marketBias: decision.marketBias,
    tradePermission: decision.tradePermission,
    focusDrivers: selectedDrivers.map(humanize),
    riskFlags: unique([primaryRisk, ...risks]).slice(0, 4).map(humanize),
    nextActions: unique([
      ...plan.requiredConfirmations,
      ...plan.priorityChecklist,
      ...plan.reviewTrigger.conditions,
    ]).slice(0, 4).map(humanize),
    dataWarnings,
    sourceLabel: accepted
      ? `AI-assisted prioritisation · ${snapshot.status.toLowerCase()} provider data`
      : `Deterministic engine brief · ${snapshot.status.toLowerCase()} provider data`,
  };
}
