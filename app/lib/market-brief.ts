import type { MarketSnapshot } from "./market-data.ts";
import { isDecisionReadySnapshot } from "./market-data.ts";
import type { MarketIntelligence } from "./market-intelligence-engine.ts";
import type { TradePlan } from "./structured-trade-planner.ts";
import type { TradingDecision } from "./trading-decision-engine.ts";
import { interpretCrossMarket } from "../dashboard/lib/cross-market-interpretation.ts";
import { selectNextEconomicEvent } from "../dashboard/lib/daily-dashboard.ts";
import { formatVerifiedEventWhen } from "../terminal/lib/event-display.ts";

export type BriefMode = "ai-assisted" | "deterministic" | "unavailable";

export type MarketBriefSelection = {
  emphasis: "aligned" | "mixed" | "defensive";
  focusDrivers: string[];
  primaryRisk: string;
};

export type MarketBrief = {
  schemaVersion: "1.1";
  mode: BriefMode;
  asOf: string | null;
  headline: string;
  summary: string;
  whatHappened: string;
  whatMatters: string;
  supporting: string;
  constraining: string;
  levelsMatter: string;
  bullishImprove: string;
  bearishImprove: string;
  avoidWhen: string;
  nextEvent: string;
  informationAge: string;
  confidence: number | null;
  marketBias: TradingDecision["marketBias"];
  tradePermission: TradingDecision["tradePermission"];
  riskRating: TradingDecision["riskRating"] | null;
  volatilityRegime: TradingDecision["volatilityRegime"] | null;
  executionReadiness: TradePlan["executionReadiness"] | null;
  focusDrivers: string[];
  riskFlags: string[];
  nextActions: string[];
  dataWarnings: string[];
  crossAssetNotes: string[];
  scenarios: string[];
  sourceLabel: string;
};

const humanize = (value: string) =>
  value.replaceAll("_", " ").replaceAll("-", " ").toLowerCase();

const driverLabel = (value: string) => {
  const map: Record<string, string> = {
    RISK_ON_RISK_OFF: "Risk appetite balance",
    MARKET_SENTIMENT: "Market sentiment",
    TREND: "Trend evidence",
    INVERSE_VOLATILITY: "Volatility pressure",
    TREND_EVIDENCE: "Trend evidence",
    MOMENTUM_EVIDENCE: "Momentum evidence",
    ES_DIRECTION: "ES direction",
  };
  return map[value] ?? humanize(value);
};

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

function crossAssetNotes(snapshot: MarketSnapshot): string[] {
  const labels: Record<string, string> = {
    ES: "ES futures",
    VIX: "VIX",
    US2Y: "2-year Treasury yield",
    US10Y: "10-year Treasury yield",
    DXY: "US dollar index",
  };
  return snapshot.quotes.flatMap((quote) => {
    const label = labels[quote.symbol];
    if (!label) return [];
    return [`${label}: ${quote.value} (${quote.change})`];
  });
}

/** Scenario notes without unsupported probability percentages. */
function scenarioNotes(intelligence: MarketIntelligence, decisionReady: boolean): string[] {
  if (!decisionReady) return [];
  return intelligence.scenarios
    .filter((scenario) => scenario.type !== "NEUTRAL")
    .map((scenario) => {
      const confirm = humanize(scenario.trigger.kind) + (scenario.trigger.level ? ` near ${scenario.trigger.level}` : " when structure confirms");
      const invalidate = humanize(scenario.invalidation.kind) + (scenario.invalidation.level ? ` near ${scenario.invalidation.level}` : " if structure fails");
      return `${humanize(scenario.type)} path · confirm ${confirm} · invalidate ${invalidate}`;
    });
}

function ageLabel(asOf: string | null): string {
  if (!asOf || !Number.isFinite(Date.parse(asOf))) return "Information age unavailable";
  const ageMs = Date.now() - Date.parse(asOf);
  if (ageMs < 60_000) return "Under 1 minute old";
  if (ageMs < 3_600_000) return `${Math.floor(ageMs / 60_000)} minutes old`;
  if (ageMs < 86_400_000) return `${Math.floor(ageMs / 3_600_000)} hours old`;
  return `${Math.floor(ageMs / 86_400_000)} days old`;
}

export function buildMarketBrief(
  snapshot: MarketSnapshot,
  intelligence: MarketIntelligence,
  decision: TradingDecision,
  plan: TradePlan,
  selection: MarketBriefSelection | null = null,
): MarketBrief {
  const verified = snapshot.status === "LIVE" || snapshot.status === "DELAYED";
  const decisionReady = isDecisionReadySnapshot(snapshot) && intelligence.actionable;
  const dataWarnings = unique([
    ...decision.dataQualityWarnings.map((warning) => warning.code),
    ...intelligence.reasoning.missingDataWarnings.map((warning) => `${warning.code}:${warning.field}`),
  ]).map(humanize);
  const interpretation = interpretCrossMarket(snapshot);
  const nextGrouped = selectNextEconomicEvent(snapshot.events);
  const nextEvent = nextGrouped
    ? `${nextGrouped.name} (${nextGrouped.risk} impact, ${
        (() => {
          const ms = Date.parse(nextGrouped.startsAt);
          return Number.isFinite(ms) ? formatVerifiedEventWhen(ms) : nextGrouped.startsAt;
        })()
      })`
    : "No upcoming verified economic event is listed by the provider.";

  if (!verified || !intelligence.actionable || !decisionReady) {
    return {
      schemaVersion: "1.1",
      mode: "unavailable",
      asOf: snapshot.asOf,
      headline: "Verified current market data is unavailable for a directional brief",
      summary: "Bullseye has paused directional briefing rather than inferring a view from preview, stale, fallback or incomplete inputs.",
      whatHappened: interpretation,
      whatMatters: "Data quality and freshness matter more than direction until verified inputs recover.",
      supporting: "Supporting risk-appetite claims are withheld.",
      constraining: "Constraining claims are withheld.",
      levelsMatter: "Verified rolling range or structure levels appear once candle and quote evidence is current.",
      bullishImprove: "Fresh verified upside confirmation after data recovery.",
      bearishImprove: "Fresh verified downside confirmation after data recovery.",
      avoidWhen: "Avoid directional participation while the decision window is closed.",
      nextEvent,
      informationAge: ageLabel(snapshot.asOf),
      confidence: null,
      marketBias: "neutral",
      tradePermission: "no-trade",
      riskRating: null,
      volatilityRegime: null,
      executionReadiness: null,
      focusDrivers: [],
      riskFlags: ["Current provider data is not verified for trading guidance."],
      nextActions: ["Wait for a verified provider update and refresh the brief."],
      dataWarnings,
      crossAssetNotes: crossAssetNotes(snapshot),
      scenarios: [],
      sourceLabel: "Unavailable · fail-closed · deterministic",
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
  const supporting = decision.topSupportingDrivers.length
    ? decision.topSupportingDrivers.slice(0, 3).map((driver) => driverLabel(driver.factor)).join(", ")
    : "No dominant supportive factor is published.";
  const constraining = decision.conflictingDrivers.length
    ? decision.conflictingDrivers.slice(0, 3).map((driver) => driverLabel(driver.factor)).join(", ")
    : "No dominant constraining conflict is published.";

  return {
    schemaVersion: "1.1",
    mode: accepted ? "ai-assisted" : "deterministic",
    asOf: snapshot.asOf,
    headline,
    summary,
    whatHappened: interpretation,
    whatMatters: summary,
    supporting: `Supporting risk appetite: ${supporting}.`,
    constraining: `Constraining risk appetite: ${constraining}.`,
    levelsMatter: "Treat verified rolling range highs and lows as reference observations unless a deterministic structure rule is present.",
    bullishImprove: "Bullish case improves if price accepts above the verified rolling range high after fresh data arrives.",
    bearishImprove: "Bearish case improves if price loses the verified rolling range low after fresh data arrives.",
    avoidWhen: decision.tradePermission === "no-trade"
      ? `Avoid trading while: ${unique([primaryRisk, ...risks]).slice(0, 3).map(humanize).join("; ") || "no-trade conditions remain"}.`
      : "Reduce size when conflicts, elevated volatility or nearby high-impact events appear.",
    nextEvent,
    informationAge: ageLabel(snapshot.asOf),
    confidence: Math.min(decision.confidenceScore, intelligence.scores.bullseyeConfidence),
    marketBias: decision.marketBias,
    tradePermission: decision.tradePermission,
    riskRating: decision.riskRating,
    volatilityRegime: decision.volatilityRegime,
    executionReadiness: plan.executionReadiness,
    focusDrivers: selectedDrivers.map(driverLabel),
    riskFlags: unique([primaryRisk, ...risks]).slice(0, 4).map(humanize),
    nextActions: unique([
      ...plan.requiredConfirmations,
      ...plan.priorityChecklist,
      ...plan.reviewTrigger.conditions,
    ]).slice(0, 4).map(humanize),
    dataWarnings,
    crossAssetNotes: crossAssetNotes(snapshot),
    scenarios: scenarioNotes(intelligence, decisionReady),
    sourceLabel: accepted
      ? `AI-assisted prioritisation · ${snapshot.status.toLowerCase()} provider data · deterministic wording`
      : `Deterministic engine brief · ${snapshot.status.toLowerCase()} provider data`,
  };
}
