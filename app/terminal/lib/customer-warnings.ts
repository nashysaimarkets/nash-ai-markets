import type { MissingDataWarning } from "../../lib/market-intelligence-engine";

/** Internal schema/field keys that must never appear in customer-facing copy. */
const INTERNAL_FIELDS = new Set(["dataAgeMs", "dataStatus", "providerStatus"]);

const CODE_COPY: Record<string, string> = {
  CRITICAL_INPUT_MISSING: "Required market inputs are incomplete",
  LOW_CONFIDENCE: "Confidence is too low for a directional plan",
  PREVIEW_DATA: "Preview data cannot drive a live plan",
  UNAVAILABLE_DATA: "Verified market data is currently unavailable",
  UNKNOWN_DATA_AGE: "Data age could not be confirmed",
  STALE_DATA: "Market data is older than the current decision window",
  AGED_DATA: "Market data is delayed beyond the live window",
  FALLBACK_ACTIVE: "The feed is using a safety fallback",
  PROVIDER_OFFLINE: "The market data connection is offline",
  PROVIDER_DEGRADED: "The market data connection is degraded",
  DELAYED_DATA: "Market data is delayed",
  LIVE_DATA: "Live market data",
  UNAVAILABLE_DATA_STATUS: "Market data status is unavailable",
  MISSING_EVIDENCE: "Missing evidence",
  MISSING_LEVEL: "Missing level",
  MISSING_QUOTE: "Missing quote",
  EVENT_NEAR: "A high-impact event is nearby",
};

function humanizeCode(code: string): string {
  return CODE_COPY[code] ?? code.replaceAll("_", " ").replaceAll("-", " ").trim().toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

/**
 * Formats participation / no-trade warnings for the customer terminal.
 * Codes become plain English; camelCase schema field names are omitted.
 */
export function formatCustomerParticipationWarnings(
  noTradeReasons: string[],
  dataQualityWarnings: MissingDataWarning[],
  eventRiskWarningCodes: string[],
): string[] {
  const items: string[] = [
    ...noTradeReasons.map(humanizeCode),
    ...dataQualityWarnings.map((warning) => {
      const code = humanizeCode(warning.code);
      if (!warning.field || INTERNAL_FIELDS.has(warning.field)) return code;
      const field = warning.field.replaceAll("_", " ");
      if (warning.code.startsWith("MISSING_")) return `${code}: ${field}`;
      return code;
    }),
    ...eventRiskWarningCodes.map(humanizeCode),
  ];
  return [...new Set(items.filter(Boolean))];
}
