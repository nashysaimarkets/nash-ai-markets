export type PreflightStatus = "IDLE" | "CHECKING" | "AWAITING_CONFIRMATION" | "LOCKED" | "READY" | "LIMITED" | "RETAKE" | "UNAVAILABLE" | "SERVICE_UNAVAILABLE";

export type ChartPreflight = {
  status: Exclude<PreflightStatus, "IDLE" | "CHECKING" | "UNAVAILABLE" | "SERVICE_UNAVAILABLE">;
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
  issues: string[];
  guidance: string;
};

export type ChartConfirmation = {
  instrument: string;
  timeframe: string;
  currentPrice: string;
  contextMatch: "MATCHED" | "NOT_PROVIDED";
};

export function preflightAllowsAnalysis(status: PreflightStatus) {
  return status === "LOCKED" || status === "UNAVAILABLE";
}
