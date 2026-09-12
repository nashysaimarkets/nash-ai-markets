import type { Analysis, Direction } from "./analysis-types";

export type TradeSide = "LONG" | "SHORT";
export type TradePlanInput = {
  side: TradeSide;
  entry: string;
  stop: string;
  target: string;
};

export type TradePlanEvaluation = {
  valid: boolean;
  quality: number | null;
  verdict: "READY TO REVIEW" | "NEEDS WORK" | "INVALID PLAN";
  rewardRisk: number | null;
  checks: Array<{ label: string; status: "PASS" | "WARN" | "FAIL"; detail: string }>;
  stopRisk: string;
};

function exactPositiveNumber(value: string) {
  const normalized = value.trim().replace(/[£$€¥\s,'’]/g, "");
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function numericLevels(analysis: Analysis, kind: "support" | "resistance") {
  return analysis.levels.flatMap((level) => {
    if (level.kind !== kind) return [];
    const price = exactPositiveNumber(level.price);
    return price === null ? [] : [price];
  });
}

function directionForSide(side: TradeSide): Direction {
  return side === "LONG" ? "BULLISH" : "BEARISH";
}

export function evaluateTradePlan(input: TradePlanInput, analysis: Analysis): TradePlanEvaluation {
  const entry = exactPositiveNumber(input.entry);
  const stop = exactPositiveNumber(input.stop);
  const target = exactPositiveNumber(input.target);
  if (entry === null || stop === null || target === null) {
    return {
      valid: false,
      quality: null,
      verdict: "INVALID PLAN",
      rewardRisk: null,
      checks: [{ label: "PRICE PLAN", status: "FAIL", detail: "Enter exact positive entry, stop and target prices." }],
      stopRisk: "Stop risk cannot be checked until all three prices are valid.",
    };
  }

  const geometryValid = input.side === "LONG"
    ? stop < entry && target > entry
    : stop > entry && target < entry;
  if (!geometryValid) {
    return {
      valid: false,
      quality: null,
      verdict: "INVALID PLAN",
      rewardRisk: null,
      checks: [{
        label: "PRICE PLAN",
        status: "FAIL",
        detail: input.side === "LONG" ? "A long plan needs stop below entry and target above it." : "A short plan needs stop above entry and target below it.",
      }],
      stopRisk: "Stop risk cannot be checked because the plan direction and prices conflict.",
    };
  }

  const risk = Math.abs(entry - stop);
  const reward = Math.abs(target - entry);
  const rewardRisk = reward / risk;
  const alignedDirection = directionForSide(input.side);
  const directionAligned = analysis.direction === alignedDirection;
  const directionNeutral = analysis.direction === "NEUTRAL";
  const timeframeConflict = analysis.higherTimeframe.alignment === "CONFLICTING";
  const evidenceLocked = analysis.trustGate?.status === "LOCKED"
    && analysis.evidenceQuality.chartReadability === "CLEAR"
    && analysis.evidenceQuality.scaleReadable
    && analysis.evidenceQuality.candlesReadable;

  const supports = numericLevels(analysis, "support").filter((price) => price < entry).sort((a, b) => b - a);
  const resistances = numericLevels(analysis, "resistance").filter((price) => price > entry).sort((a, b) => a - b);
  const nearestBoundary = input.side === "LONG" ? supports[0] : resistances[0];
  const stopInsideBoundary = nearestBoundary !== undefined && (input.side === "LONG" ? stop >= nearestBoundary : stop <= nearestBoundary);
  const stopRisk = nearestBoundary === undefined
    ? "No exact same-side structural boundary is verified, so Bullseye cannot judge stop placement safely."
    : stopInsideBoundary
      ? `The stop sits before the verified ${input.side === "LONG" ? "support" : "resistance"} at ${nearestBoundary}. A routine retest could reach it before structure fails.`
      : `The stop is beyond verified ${input.side === "LONG" ? "support" : "resistance"} at ${nearestBoundary}. Confirm the separate analysis invalidation on the source platform.`;

  const checks: TradePlanEvaluation["checks"] = [
    {
      label: "DIRECTION",
      status: directionAligned ? "PASS" : directionNeutral ? "WARN" : "FAIL",
      detail: directionAligned ? `The ${input.side.toLowerCase()} plan agrees with the measured ${analysis.direction.toLowerCase()} read.` : directionNeutral ? "The chart read is neutral, so direction is not confirmed." : `The plan conflicts with the measured ${analysis.direction.toLowerCase()} read.`,
    },
    {
      label: "REWARD / RISK",
      status: rewardRisk !== null && rewardRisk >= 2 ? "PASS" : rewardRisk !== null && rewardRisk >= 1.5 ? "WARN" : "FAIL",
      detail: rewardRisk === null ? "Reward-to-risk could not be calculated." : `${rewardRisk.toFixed(2)}R from the prices you entered.`,
    },
    {
      label: "STOP LOCATION",
      status: nearestBoundary === undefined ? "WARN" : stopInsideBoundary ? "FAIL" : "PASS",
      detail: stopRisk,
    },
    {
      label: "TIMEFRAMES",
      status: timeframeConflict ? "FAIL" : analysis.higherTimeframe.provided ? "PASS" : "WARN",
      detail: timeframeConflict ? "The supplied higher timeframe conflicts with the active chart." : analysis.higherTimeframe.provided ? "The supplied higher timeframe does not conflict with this read." : "Only one verified timeframe is available for this check.",
    },
    {
      label: "EVIDENCE",
      status: evidenceLocked ? "PASS" : analysis.evidenceQuality.chartReadability === "POOR" ? "FAIL" : "WARN",
      detail: evidenceLocked ? "Identity, candles, price scale and structural map passed the precision gate." : "Some chart evidence remains partial or unverified.",
    },
    {
      label: "EVENT RISK",
      status: analysis.setupScore.eventSafety >= 7 ? "PASS" : analysis.setupScore.eventSafety >= 5 ? "WARN" : "FAIL",
      detail: `Event-safety evidence is ${analysis.setupScore.eventSafety}/10. Confirm the live calendar before acting.`,
    },
  ];

  let quality = analysis.setupScore.overall;
  if (!directionAligned) quality -= directionNeutral ? 8 : 18;
  if (rewardRisk < 1.5) quality -= 18;
  else if (rewardRisk < 2) quality -= 7;
  else quality += 4;
  if (stopInsideBoundary) quality -= 16;
  else if (nearestBoundary === undefined) quality -= 7;
  if (timeframeConflict) quality -= 12;
  if (!evidenceLocked) quality -= analysis.evidenceQuality.chartReadability === "POOR" ? 20 : 8;
  if (analysis.setupScore.eventSafety < 5) quality -= 12;
  quality = Math.max(0, Math.min(100, Math.round(quality)));

  return {
    valid: true,
    quality,
    verdict: quality >= 70 && !checks.some((check) => check.status === "FAIL") ? "READY TO REVIEW" : "NEEDS WORK",
    rewardRisk,
    checks,
    stopRisk,
  };
}
