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
  return status === "LOCKED";
}

export function canLockChartFacts(facts: {
  instrument: string;
  timeframe: string;
  currentPrice: string;
  hasContext: boolean;
  sameInstrument: boolean | null;
  contextAcknowledged: boolean;
  priceScaleConfirmed: boolean;
  retake?: boolean;
  candlesReadable?: boolean;
}) {
  const price = facts.currentPrice.trim();
  const validPrice = /^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(price)
    && Number.isFinite(Number(price.replaceAll(",", ""))) && Number(price.replaceAll(",", "")) > 0;
  return facts.instrument.trim().length > 1 && facts.timeframe.trim().length > 0
    && validPrice && facts.priceScaleConfirmed && !facts.retake && facts.candlesReadable !== false
    && (!facts.hasContext || facts.sameInstrument === true
      || (facts.sameInstrument === null && facts.contextAcknowledged));
}
