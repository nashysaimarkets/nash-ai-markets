import type { MacroObservation } from "../../macro-data.ts";
import type { ScalarObservationProvider } from "./contracts.ts";

export const NEW_YORK_FED_PROVIDER_NAME = "Federal Reserve Bank of New York";
export const NEW_YORK_FED_ATTRIBUTION = "Federal Reserve Bank of New York / Markets Data API";
export const NEW_YORK_FED_RATES_ENDPOINT = "https://markets.newyorkfed.org/api/rates/all/latest.json";

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function normalizeNewYorkFedRates(payload: unknown, retrievedAt: string): MacroObservation[] {
  if (!isRecord(payload) || !Array.isArray(payload.refRates)) return [];
  const wanted = new Map([["EFFR", "EFFR"], ["SOFR", "SOFR"]] as const);
  const observations: MacroObservation[] = [];

  for (const candidate of payload.refRates) {
    if (!isRecord(candidate)) continue;
    const type = String(candidate.type ?? "").trim();
    const metric = wanted.get(type as "EFFR" | "SOFR");
    const value = Number(candidate.percentRate);
    const date = String(candidate.effectiveDate ?? "").trim();
    const at = /^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}T00:00:00.000Z` : "";
    if (!metric || !Number.isFinite(value) || !at) continue;

    observations.push({
      id: `new-york-fed-${type.toLowerCase()}-${date}`,
      metric,
      value,
      unit: "%",
      observationAt: at,
      retrievedAt,
      freshness: "DAILY",
      source: {
        agency: NEW_YORK_FED_PROVIDER_NAME,
        dataset: type === "EFFR" ? "Effective Federal Funds Rate" : "Secured Overnight Financing Rate",
        attribution: NEW_YORK_FED_ATTRIBUTION,
      },
    });
  }

  return observations.sort((left, right) => left.metric.localeCompare(right.metric));
}

export function createNewYorkFedRatesProvider(options: { fetchImpl?: FetchLike; now?: () => number } = {}): ScalarObservationProvider {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? Date.now;
  return {
    name: NEW_YORK_FED_PROVIDER_NAME,
    async fetchObservations() {
      try {
        const response = await fetchImpl(NEW_YORK_FED_RATES_ENDPOINT, {
          headers: { Accept: "application/json" },
          cache: "no-store",
        });
        if (!response.ok) return [];
        return normalizeNewYorkFedRates(await response.json().catch(() => null), new Date(now()).toISOString());
      } catch {
        return [];
      }
    },
  };
}
