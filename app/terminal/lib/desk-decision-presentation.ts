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
  /** Primary customer confidence state (e.g. Not established). */
  confidenceLabel: string;
  /** Secondary engine score line when the primary label is not the raw score. */
  confidenceDetail: string | null;
  confidenceScore: number | null;
  riskLabel: string;
  why: string;
  supporting: string[];
  opposing: string[];
  primaryRisk: string | null;
  /** True when verified market observations remain usable even if participation is restricted. */
  analysisAvailable: boolean;
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
  if (!decision) return { label: "Restricted", tone: "blocked" };
  if (decision.tradePermission === "actionable") return { label: "Permitted with caution", tone: "open" };
  if (decision.tradePermission === "caution") return { label: "Caution", tone: "caution" };
  return { label: "Restricted", tone: "blocked" };
}

function softenRiskPhrase(value: string | null): string | null {
  if (!value) return null;
  return customerFacingCopy(value)
    .replace(/^./, (c) => c.toUpperCase());
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

  const rawPrimary = warnings[0]
    ?? (plan?.reasonsToRemainSidelined[0] ? humanize(plan.reasonsToRemainSidelined[0]) : null)
    ?? (decision?.noTradeReasons[0] ? humanize(decision.noTradeReasons[0]) : null);
  const primaryRisk = softenRiskPhrase(rawPrimary);

  const analysisAvailable = Boolean(decision) || supporting.length > 0 || opposing.length > 0 || lean.label !== "Unavailable";

  let why: string;
  if (!decision) {
    why = "Verified market observations may still appear below. Trade participation remains restricted because confirmation data is incomplete.";
  } else if (permission.tone === "blocked" && lean.tone !== "neutral") {
    why = `${lean.label} is an observed lean from verified inputs — not a validated trade setup. Trade participation remains restricted because confirmation data is incomplete.`;
  } else if (permission.tone === "blocked") {
    why = "This is a limited-confidence environment. Trade participation remains restricted because confirmation data is incomplete.";
  } else if (permission.tone === "caution") {
    why = `Directional lean is ${lean.label.toLowerCase()}, with caution required before participation.`;
  } else if (permission.tone === "open") {
    why = `Directional lean is ${lean.label.toLowerCase()}. Participation checks allow selective engagement subject to your own rules.`;
  } else {
    why = "Directional lean is unavailable until verified inputs recover.";
  }

  let confidenceLabel: string;
  let confidenceDetail: string | null = null;
  if (score == null) {
    confidenceLabel = "Not rated";
  } else if (score === 0) {
    confidenceLabel = "Not established";
    confidenceDetail = `Engine confidence score: ${score} / 100`;
  } else if (permission.tone === "blocked") {
    confidenceLabel = "Limited";
    confidenceDetail = `Engine confidence score: ${score} / 100`;
  } else {
    confidenceLabel = `${score} / 100`;
  }

  return {
    leanLabel: lean.label,
    leanTone: lean.tone,
    permissionLabel: permission.label,
    permissionTone: permission.tone,
    confidenceLabel,
    confidenceDetail,
    confidenceScore: score,
    riskLabel,
    why,
    supporting,
    opposing,
    primaryRisk,
    analysisAvailable,
  };
}

export type TodaysPosture = {
  eyebrow: "TODAY'S POSTURE";
  headline: string;
  summary: string;
};

/**
 * Concise shared posture line for Dashboard, Morning Brief and Trading Desk.
 * Presentation only — derived from existing decision presentation fields.
 */
export function buildTodaysPosture(decision: DeskDecisionPresentation): TodaysPosture {
  const lean = decision.leanLabel.toLowerCase();
  const condition = decision.primaryRisk
    ? decision.primaryRisk.replace(/\.$/, "")
    : "confirmation remains incomplete";

  if (decision.permissionTone === "blocked") {
    if (decision.leanTone === "bull" || decision.leanTone === "bear") {
      return {
        eyebrow: "TODAY'S POSTURE",
        headline: "Stay patient",
        summary: `The observed lean is ${lean}, but confirmation remains incomplete and participation is restricted.`,
      };
    }
    if (decision.leanTone === "mixed") {
      return {
        eyebrow: "TODAY'S POSTURE",
        headline: "Stay patient",
        summary: "Evidence is mixed. Participation stays restricted until confirmation is complete.",
      };
    }
    return {
      eyebrow: "TODAY'S POSTURE",
      headline: "Stay patient",
      summary: `Participation is restricted. Primary condition: ${condition}.`,
    };
  }

  if (decision.permissionTone === "caution") {
    return {
      eyebrow: "TODAY'S POSTURE",
      headline: "Proceed with caution",
      summary: `Observed lean is ${lean}. Treat this as an observation, not a validated setup.`,
    };
  }

  return {
    eyebrow: "TODAY'S POSTURE",
    headline: "Selective engagement only",
    summary: `Observed lean is ${lean}. Participation checks allow selective engagement subject to your own rules — not personalised advice.`,
  };
}

/** Soften common technical phrases for customer UI only. */
export function customerFacingCopy(text: string): string {
  return text
    .replaceAll("provider path", "data connection")
    .replaceAll("Provider path", "Data connection")
    .replaceAll("configured market gateway", "market-data feed")
    .replaceAll("configured market-data provider", "verified market-data feed")
    .replaceAll("reference series from the configured market-data provider", "delayed chart from the verified market-data feed")
    .replaceAll("S&P 500 futures reference series", "S&P 500 futures chart")
    .replaceAll("ESUSD reference series", "S&P 500 futures chart")
    .replaceAll("verified candles only", "verified delayed chart")
    .replaceAll("Verified candles only", "Verified delayed chart")
    .replaceAll("rolling 24-hour verified close", "current price within the 24-hour range")
    .replaceAll("Latest verified close", "Current price")
    .replaceAll("Rolling 24h position", "Current price within the 24-hour range")
    .replaceAll("window’s first close", "session opening reference")
    .replaceAll("window's first close", "session opening reference")
    .replaceAll("First available close", "Session opening reference")
    .replaceAll("taxonomy only", "market listed; live coverage not yet available")
    .replaceAll("reserved provider symbol", "symbol ready; data connection pending")
    .replaceAll("Awaiting coverage", "Coming soon")
    .replaceAll("awaiting coverage", "coverage coming soon")
    .replaceAll("no verified provider path is wired", "no verified data connection is currently available")
    .replaceAll("No verified provider path is wired", "No verified data connection is currently available")
    .replaceAll("Fail-closed", "Trade participation stays restricted until confirmations complete")
    .replaceAll("fail-closed", "trade participation stays restricted until confirmations complete")
    .replaceAll("Analysis paused until required data is available", "Trade participation stays restricted until confirmations complete")
    .replaceAll("analysis pauses until required data is available", "trade participation stays restricted until confirmations complete")
    .replaceAll("deterministic engine brief", "rules-based market summary")
    .replaceAll("decision permission valid", "participation checks passed")
    .replaceAll("CRITICAL_INPUT_MISSING", "confirmation data is incomplete")
    .replaceAll("critical input missing", "confirmation data is incomplete")
    .replaceAll("Required market evidence is missing", "Confirmation data is incomplete")
    .replaceAll("required market evidence is missing", "confirmation data is incomplete")
    .replaceAll("Educational Edge Brief", "Market summary")
    .replaceAll("Desk builder", "Layout");
}

/** Customer-facing chart title: keep provider symbol in Data Details only. */
export function customerFacingChartTitle(instrument: string, instrumentName: string, symbol: string): string {
  if (instrument === "ES" || symbol === "ESUSD") {
    return "S&P 500 futures chart · ES";
  }
  const name = customerFacingCopy(instrumentName);
  const short = instrument || symbol;
  return `${name} · ${short}`;
}
