export type PreflightStatus = "IDLE" | "CHECKING" | "AWAITING_CONFIRMATION" | "LOCKED" | "READY" | "LIMITED" | "RETAKE" | "UNAVAILABLE";

export type ChartPreflight = {
  status: Exclude<PreflightStatus, "IDLE" | "CHECKING" | "UNAVAILABLE">;
  instrument: string;
  instrumentConfidence: "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";
  timeframe: string;
  timeframeConfidence: "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";
  currentPrice: string;
  currentPriceConfidence: "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";
  priceScaleVisible: boolean;
  candlesReadable: boolean;
  enoughHistory: boolean;
  sameInstrument: boolean | null;
  captureAlignment?: "ALIGNED" | "MIXED" | "UNKNOWN";
  timeframeChecks: Array<{
    slot: "PRIMARY" | "HIGHER_TIMEFRAME" | "PRICE_DETAIL" | "FOUR_HOUR" | "INDICATOR_VOLUME";
    detected: string;
    confidence: "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";
    matchesExpected: boolean | null;
  }>;
  issues: string[];
  guidance: string;
};

export type ChartConfirmation = {
  instrument: string;
  timeframe: string;
  currentPrice: string;
  contextMatch: "MATCHED" | "NOT_PROVIDED";
  source?: "PREFLIGHT" | "USER_CONFIRMED";
};

/** Older clients also auto-filled this object. Missing provenance is a hint,
 * never evidence that a trader explicitly confirmed an OCR reading. */
export function confirmedChartFacts(facts: ChartConfirmation | null): ChartConfirmation | null {
  return facts?.source === "USER_CONFIRMED" ? facts : null;
}

export function preflightAllowsAnalysis(status: PreflightStatus) {
  return !["IDLE", "CHECKING", "RETAKE"].includes(status);
}

/** Advice follows observable quality flags, never the screenshot orientation. */
export function chartCaptureGuidance(result: Pick<ChartPreflight, "priceScaleVisible" | "candlesReadable" | "enoughHistory" | "instrumentConfidence" | "timeframeConfidence">) {
  const advice: string[] = [];
  if (!result.candlesReadable) advice.push("Zoom in until candle bodies and wicks are distinct. Use the original screenshot rather than a camera photo.");
  if (!result.enoughHistory) advice.push("Include more candles to show the preceding swing and repeated reactions. Try landscape if it gives you more history while keeping candles clear.");
  if (!result.priceScaleVisible) advice.push("Keep the full price scale visible with several readable labels.");
  if (result.instrumentConfidence !== "HIGH" || result.timeframeConfidence !== "HIGH") advice.push("Keep the instrument name and selected timeframe visible.");
  return advice;
}
