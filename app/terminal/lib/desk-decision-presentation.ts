/**
 * Customer-facing presentation helpers for Trading Desk.
 * Does not alter engine outputs — only display labels and explanations.
 */

import type { MarketDeskSignals } from "../../lib/market-desk-signals.ts";
import type { TradingDecision } from "../../lib/trading-decision-engine.ts";
import type { TradePlan } from "../../lib/structured-trade-planner.ts";

export type DeskDecisionPresentation = {
  leanLabel: string;
  leanTone: "bull" | "bear" | "neutral" | "mixed";
  permissionLabel: string;
  permissionTone: "open" | "caution" | "blocked";
  confidenceLabel: string;
  confidenceScore: number | null;
  riskLabel: string;
  why: string;
  supporting: string[];
  opposing: string[];
  primaryRisk: string | null;
};

const humanize = (value: string) =>
  value.replaceAll("_", " ").replaceAll("-", " ").toLowerCase();

export function leanLabelFromSignals(
  signals: MarketDeskSignals | null,
  decision: TradingDecision | null,
): { label: string; tone: DeskDecisionPresentation["leanTone"] } {
  const lean = signals?.overallLean;
  if (lean === "buying") return { label: "Mildly bullish", tone: "bull" };
  if (lean === "selling") return { label: "Mildly bearish", tone: "bear" };
  if (lean === "mixed") return { label: "Mixed", tone: "mixed" };
  if (lean === "neutral") return { label: "Neutral", tone: "neutral" };
  if (decision?.marketBias === "bullish") return { label: "Bullish lean", tone: "bull" };
  if (decision?.marketBias === "bearish") return { label: "Bearish lean", tone: "bear" };
  if (decision?.marketBias === "neutral") return { label: "Neutral", tone: "neutral" };
  return { label: "Unavailable", tone: "neutral" };
}

export function permissionPresentation(
  decision: TradingDecision | null,
): { label: string; tone: DeskDecisionPresentation["permissionTone"] } {
  if (!decision) return { label: "Blocked", tone: "blocked" };
  if (decision.tradePermission === "actionable") return { label: "Permitted with caution", tone: "open" };
  if (decision.tradePermission === "caution") return { label: "Caution", tone: "caution" };
  return { label: "Blocked", tone: "blocked" };
}

/** Build presentation-only decision summary from existing engine outputs. */
export function buildDeskDecisionPresentation(input: {
  decision: TradingDecision | null;
  plan: TradePlan | null;
  signals: MarketDeskSignals | null;
  warnings: string[];
}): DeskDecisionPresentation {
  const { decision, plan, signals, warnings } = input;
  const lean = leanLabelFromSignals(signals, decision);
  const permission = permissionPresentation(decision);
  const score = decision && Number.isFinite(decision.confidenceScore)
    ? Math.round(decision.confidenceScore)
    : null;
  const riskLabel = decision
    ? humanize(decision.riskRating).replace(/^\w/, (c) => c.toUpperCase())
    : "Unrated";

  const supporting = (signals?.buying.drivers.length
    ? signals.buying.drivers
    : decision?.topSupportingDrivers.map((d) => humanize(d.factor)) ?? []
  ).slice(0, 3);

  const opposing = (signals?.selling.drivers.length
    ? signals.selling.drivers
    : decision?.conflictingDrivers.map((d) => humanize(d.factor)) ?? []
  ).slice(0, 3);

  const primaryRisk = warnings[0]
    ?? (plan?.reasonsToRemainSidelined[0] ? humanize(plan.reasonsToRemainSidelined[0]) : null)
    ?? (decision?.noTradeReasons[0] ? humanize(decision.noTradeReasons[0]) : null);

  let why: string;
  if (!decision) {
    why = "Required market evidence is missing, so participation remains blocked.";
  } else if (permission.tone === "blocked" && lean.tone !== "neutral") {
    why = `Directional inputs lean ${lean.label.toLowerCase()}, but critical evidence is incomplete or risk conditions are active, so participation remains blocked.`;
  } else if (permission.tone === "caution") {
    why = `Directional lean is ${lean.label.toLowerCase()}, with caution required before participation.`;
  } else if (permission.tone === "open") {
    why = `Directional lean is ${lean.label.toLowerCase()}. Participation checks allow selective engagement subject to your own rules.`;
  } else {
    why = "Directional lean is unavailable until verified inputs recover.";
  }

  return {
    leanLabel: lean.label,
    leanTone: lean.tone,
    permissionLabel: permission.label,
    permissionTone: permission.tone,
    confidenceLabel: score == null ? "Not rated" : `${score} / 100`,
    confidenceScore: score,
    riskLabel,
    why,
    supporting,
    opposing,
    primaryRisk,
  };
}

/** Soften common technical phrases for customer UI only. */
export function customerFacingCopy(text: string): string {
  return text
    .replaceAll("provider path", "data connection")
    .replaceAll("Provider path", "Data connection")
    .replaceAll("configured market gateway", "market-data feed")
    .replaceAll("taxonomy only", "market listed; live coverage not yet available")
    .replaceAll("reserved provider symbol", "symbol ready; data connection pending")
    .replaceAll("Awaiting coverage", "Coming soon")
    .replaceAll("awaiting coverage", "coverage coming soon")
    .replaceAll("no verified provider path is wired", "no verified data connection is currently available")
    .replaceAll("No verified provider path is wired", "No verified data connection is currently available")
    .replaceAll("Fail-closed", "Analysis paused until required data is available")
    .replaceAll("fail-closed", "analysis paused until required data is available")
    .replaceAll("deterministic engine brief", "rules-based market summary")
    .replaceAll("decision permission valid", "participation checks passed")
    .replaceAll("CRITICAL_INPUT_MISSING", "required market evidence is missing")
    .replaceAll("critical input missing", "required market evidence is missing")
    .replaceAll("Educational Edge Brief", "Market summary")
    .replaceAll("Desk builder", "Layout");
}
