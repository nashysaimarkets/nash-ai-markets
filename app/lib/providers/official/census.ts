import type { MacroMetric, MacroObservation } from "../../macro-data.ts";
import type { ScalarObservationProvider } from "./contracts.ts";

export const CENSUS_PROVIDER_NAME = "U.S. Census Bureau";
export const CENSUS_ATTRIBUTION = "U.S. Census Bureau";
export const CENSUS_EITS_BASE = "https://api.census.gov/data/timeseries/eits/";

type CensusMetric = Extract<MacroMetric, "RETAIL_SALES" | "HOUSING" | "DURABLE_GOODS" | "TRADE">;
type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export type CensusSeriesQuery = {
  metric: CensusMetric;
  dataset: "marts" | "resconst" | "advm3" | "ftd";
  datasetName: string;
  unit: string;
  predicates: Readonly<Record<string, string>>;
};

export type CensusProviderOptions = {
  apiKey: string;
  queries: readonly CensusSeriesQuery[];
  fetchImpl?: FetchLike;
  now?: () => number;
};

export const DEFAULT_CENSUS_QUERIES = [
  { metric: "RETAIL_SALES", dataset: "marts", datasetName: "Advance Monthly Retail Trade Survey", unit: "millions of dollars", predicates: { category_code: "441", data_type_code: "SM", seasonally_adj: "yes" } },
  { metric: "HOUSING", dataset: "resconst", datasetName: "New Residential Construction", unit: "thousands of units", predicates: { category_code: "STARTS", data_type_code: "TOTAL", seasonally_adj: "yes" } },
  { metric: "DURABLE_GOODS", dataset: "advm3", datasetName: "Advance Report on Durable Goods", unit: "millions of dollars", predicates: { category_code: "DG", data_type_code: "NO", seasonally_adj: "yes" } },
  { metric: "TRADE", dataset: "ftd", datasetName: "U.S. International Trade in Goods and Services", unit: "millions of dollars", predicates: { category_code: "BOP", data_type_code: "BAL", seasonally_adj: "yes" } },
] as const satisfies readonly CensusSeriesQuery[];

function finiteNumber(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const parsed = Number(String(value).replaceAll(",", "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function observationAt(value: string): string | null {
  const match = value.match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  return `${match[1]}-${match[2]}-01T00:00:00.000Z`;
}

export function normalizeCensusSingleSeries(
  payload: unknown,
  query: CensusSeriesQuery,
  retrievedAt: string,
): MacroObservation[] {
  if (!Array.isArray(payload) || payload.length !== 2) return [];
  const header = payload[0];
  const row = payload[1];
  if (!Array.isArray(header) || !Array.isArray(row) || header.length !== row.length) return [];

  const record = Object.fromEntries(header.map((name, index) => [String(name), row[index]]));
  const value = finiteNumber(record.cell_value);
  const at = observationAt(String(record.time ?? record.time_slot_date ?? ""));
  if (value === null || !at) return [];

  for (const [key, expected] of Object.entries(query.predicates)) {
    if (String(record[key] ?? "") !== expected) return [];
  }

  return [{
    id: `census-${query.metric.toLowerCase()}-${at.slice(0, 7)}`,
    metric: query.metric,
    value,
    unit: query.unit,
    observationAt: at,
    retrievedAt,
    freshness: "DAILY",
    source: {
      agency: CENSUS_PROVIDER_NAME,
      dataset: query.datasetName,
      attribution: `${CENSUS_ATTRIBUTION} / ${query.datasetName}`,
    },
  }];
}

function queryUrl(apiKey: string, query: CensusSeriesQuery, year: number): URL {
  const url = new URL(query.dataset, CENSUS_EITS_BASE);
  const fields = ["cell_value", "time_slot_date", ...Object.keys(query.predicates)];
  url.searchParams.set("get", [...new Set(fields)].join(","));
  url.searchParams.set("time", String(year));
  for (const [key, value] of Object.entries(query.predicates)) url.searchParams.set(key, value);
  url.searchParams.set("key", apiKey);
  return url;
}

/**
 * Census EITS uses dataset-specific category/data-type codes. To prevent silent
 * substitution, callers must supply the exact official predicates for each
 * selected series; this provider refuses multi-row/ambiguous responses.
 */
export function createCensusObservationProvider(options: CensusProviderOptions): ScalarObservationProvider {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? Date.now;

  return {
    name: CENSUS_PROVIDER_NAME,
    async fetchObservations() {
      if (!options.apiKey.trim()) return [];
      const retrievedMs = now();
      const retrievedAt = new Date(retrievedMs).toISOString();
      const year = new Date(retrievedMs).getUTCFullYear();

      const settled = await Promise.allSettled(options.queries.map(async (query) => {
        const response = await fetchImpl(queryUrl(options.apiKey, query, year), {
          headers: { Accept: "application/json" },
          cache: "no-store",
        });
        if (!response.ok) return [];
        const payload: unknown = await response.json().catch(() => null);
        return normalizeCensusSingleSeries(payload, query, retrievedAt);
      }));

      return settled.flatMap((result) => result.status === "fulfilled" ? result.value : []);
    },
  };
}
