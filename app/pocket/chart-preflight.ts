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
  timeframeChecks: Array<{
    slot: "5M" | "30M" | "1H" | "4H";
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
