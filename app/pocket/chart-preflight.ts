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

/** Untrusted provider/browser transport must never manufacture lockable chart facts. */
export function validateChartPreflight(value: unknown): ChartPreflight {
  const fail = () => { throw new Error("Preflight HOLD: incomplete or malformed chart facts."); };
  if (!value || typeof value !== "object" || Array.isArray(value)) return fail();
  const v = value as Record<string, unknown>;
  const oneOf = (x: unknown, allowed: readonly string[]) => typeof x === "string" && allowed.includes(x);
  const text = (x: unknown, max: number) => typeof x === "string" && x.length <= max;
  if (!oneOf(v.status, ["READY", "LIMITED", "RETAKE"]) ||
      !text(v.instrument, 40) || !text(v.timeframe, 30) || !text(v.currentPrice, 30) || !text(v.guidance, 180) ||
      !["instrumentConfidence", "timeframeConfidence", "currentPriceConfidence"].every(k => oneOf(v[k], ["HIGH", "MEDIUM", "LOW", "UNKNOWN"])) ||
      !["priceScaleVisible", "candlesReadable", "enoughHistory"].every(k => typeof v[k] === "boolean") ||
      !(v.sameInstrument === null || typeof v.sameInstrument === "boolean") ||
      !Array.isArray(v.issues) || v.issues.length > 4 || !v.issues.every(x => text(x, 100))) return fail();
  return value as ChartPreflight;
}

export function completedChartPreflight(response: {status?: unknown; output_text?: unknown}): ChartPreflight {
  if (response.status !== "completed" || typeof response.output_text !== "string" || !response.output_text.trim()) {
    throw new Error("Preflight HOLD: provider response did not complete.");
  }
  return validateChartPreflight(JSON.parse(response.output_text));
}

/** Auto-admission uses detected evidence only. Corrections are limited to uncertain
 * printed labels; they cannot override unreadable geometry or a context mismatch. */
export function automaticChartConfirmation(
  value: unknown, hasContext: boolean,
  corrections?: Partial<Pick<ChartConfirmation, "instrument" | "timeframe" | "currentPrice">>,
): ChartConfirmation | null {
  let facts: ChartPreflight;
  try { facts = validateChartPreflight(value); } catch { return null; }
  if (facts.status === "RETAKE" || !facts.priceScaleVisible || !facts.candlesReadable || !facts.enoughHistory
      || (hasContext && facts.sameInstrument !== true)) return null;
  const read = (field: "instrument" | "timeframe" | "currentPrice", max: number) => {
    const detected = facts[`${field}Confidence`] === "HIGH";
    const text = (detected ? facts[field] : corrections?.[field])?.trim();
    return text && text.length <= max && !/^(unknown|n\/a|unreadable)$/i.test(text) ? text : "";
  };
  const instrument = read("instrument", 40), timeframe = read("timeframe", 30), currentPrice = read("currentPrice", 30);
  if (!canLockChartFacts({instrument, timeframe, currentPrice, hasContext, sameInstrument: facts.sameInstrument,
    contextAcknowledged: false, priceScaleConfirmed: facts.priceScaleVisible, candlesReadable: facts.candlesReadable})) return null;
  return {instrument, timeframe, currentPrice, contextMatch: hasContext ? "MATCHED" : "NOT_PROVIDED"};
}
