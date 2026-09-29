import type { EconomicRelease, MacroObservation } from "../../macro-data.ts";
import type { EconomicReleaseProvider, ScalarObservationProvider } from "./contracts.ts";

export const BEA_PROVIDER_NAME = "U.S. Bureau of Economic Analysis";
export const BEA_ATTRIBUTION = "U.S. Bureau of Economic Analysis";
export const BEA_API_ENDPOINT = "https://apps.bea.gov/api/data";
export const BEA_RELEASE_DATES_ENDPOINT = "https://apps.bea.gov/API/signup/release_dates.json";

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export type BeaProviderOptions = {
  apiKey: string;
  fetchImpl?: FetchLike;
  now?: () => number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function finiteNumber(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const parsed = Number(String(value).replaceAll(",", "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function nipaRows(payload: unknown): Record<string, unknown>[] {
  if (!isRecord(payload) || !isRecord(payload.BEAAPI) || !isRecord(payload.BEAAPI.Results)) return [];
  const rows = payload.BEAAPI.Results.Data;
  return Array.isArray(rows) ? rows.filter(isRecord) : [];
}

function periodToIso(value: unknown): string | null {
  const text = String(value ?? "").trim();
  const month = text.match(/^(\d{4})M(0[1-9]|1[0-2])$/);
  if (month) return `${month[1]}-${month[2]}-01T00:00:00.000Z`;
  const quarter = text.match(/^(\d{4})Q([1-4])$/);
  if (quarter) {
    const monthNumber = (Number(quarter[2]) - 1) * 3 + 1;
    return `${quarter[1]}-${String(monthNumber).padStart(2, "0")}-01T00:00:00.000Z`;
  }
  return null;
}

function latestMatchingRow(
  rows: Record<string, unknown>[],
  matcher: (description: string) => boolean,
): { at: string; value: number; unit: string } | null {
  const matches = rows.flatMap((row) => {
    const description = String(row.LineDescription ?? "").trim();
    if (!matcher(description)) return [];
    const at = periodToIso(row.TimePeriod);
    const value = finiteNumber(row.DataValue);
    if (!at || value === null) return [];
    const unit = String(row.CL_UNIT ?? row.Unit ?? "").trim() || "BEA published units";
    return [{ at, value, unit }];
  }).sort((left, right) => Date.parse(right.at) - Date.parse(left.at));
  return matches[0] ?? null;
}

export function normalizeBeaNipaPayloads(
  gdpPayload: unknown,
  incomePayload: unknown,
  retrievedAt: string,
): MacroObservation[] {
  const observations: MacroObservation[] = [];

  const gdp = latestMatchingRow(nipaRows(gdpPayload), (description) =>
    /^Gross domestic product$/i.test(description)
  );
  const incomeRows = nipaRows(incomePayload);
  const pce = latestMatchingRow(incomeRows, (description) =>
    /^Personal consumption expenditures$/i.test(description)
  );
  const personalIncome = latestMatchingRow(incomeRows, (description) =>
    /^Personal income$/i.test(description)
  );

  const push = (
    metric: "GDP" | "PCE" | "PERSONAL_INCOME",
    result: { at: string; value: number; unit: string } | null,
    dataset: string,
  ) => {
    if (!result) return;
    observations.push({
      id: `bea-${metric.toLowerCase()}-${result.at.slice(0, 7)}`,
      metric,
      value: result.value,
      unit: result.unit,
      observationAt: result.at,
      retrievedAt,
      freshness: "DAILY",
      source: { agency: BEA_PROVIDER_NAME, dataset, attribution: BEA_ATTRIBUTION },
    });
  };

  push("GDP", gdp, "National Income and Product Accounts Table 1.1.1");
  push("PCE", pce, "National Income and Product Accounts Table 2.6");
  push("PERSONAL_INCOME", personalIncome, "National Income and Product Accounts Table 2.6");

  return observations;
}

function nipaUrl(apiKey: string, tableName: string, frequency: "Q" | "M", year: number): URL {
  const url = new URL(BEA_API_ENDPOINT);
  url.searchParams.set("UserID", apiKey);
  url.searchParams.set("method", "GetData");
  url.searchParams.set("datasetname", "NIPA");
  url.searchParams.set("TableName", tableName);
  url.searchParams.set("Frequency", frequency);
  url.searchParams.set("Year", String(year));
  url.searchParams.set("ResultFormat", "JSON");
  return url;
}

export function createBeaObservationProvider(options: BeaProviderOptions): ScalarObservationProvider {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? Date.now;
  return {
    name: BEA_PROVIDER_NAME,
    async fetchObservations(signal?: AbortSignal) {
      if (!options.apiKey.trim()) return [];
      const retrievedMs = now();
      const retrievedAt = new Date(retrievedMs).toISOString();
      const year = new Date(retrievedMs).getUTCFullYear();

      const load = async (url: URL): Promise<unknown> => {
        const response = await fetchImpl(url, { headers: { Accept: "application/json" }, cache: "no-store", signal });
        if (!response.ok) return null;
        return response.json().catch(() => null);
      };

      const [gdp, income] = await Promise.allSettled([
        load(nipaUrl(options.apiKey, "T10101", "Q", year)),
        load(nipaUrl(options.apiKey, "T20600", "M", year)),
      ]);

      return normalizeBeaNipaPayloads(
        gdp.status === "fulfilled" ? gdp.value : null,
        income.status === "fulfilled" ? income.value : null,
        retrievedAt,
      );
    },
  };
}

export function normalizeBeaReleaseDates(
  payload: unknown,
  from: Date,
  to: Date,
): EconomicRelease[] {
  if (!isRecord(payload)) return [];
  const fromMs = from.getTime();
  const toMs = to.getTime();
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || fromMs > toMs) return [];

  const selected = [
    ["Gross Domestic Product", "Gross Domestic Product", "HIGH"],
    ["Personal Income and Outlays", "Personal Income and Outlays", "HIGH"],
    ["U.S. International Trade in Goods and Services", "U.S. International Trade in Goods and Services", "MED"],
  ] as const;
  const releases: EconomicRelease[] = [];

  for (const [key, name, risk] of selected) {
    const section = payload[key];
    if (!isRecord(section) || !Array.isArray(section.release_dates)) continue;
    for (const rawDate of section.release_dates) {
      if (typeof rawDate !== "string") continue;
      const timestamp = Date.parse(rawDate);
      if (!Number.isFinite(timestamp) || timestamp < fromMs || timestamp > toMs) continue;
      const scheduledAt = new Date(timestamp).toISOString();
      releases.push({
        id: `bea-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${scheduledAt}`,
        name,
        agency: "BEA",
        scheduledAt,
        risk,
        sourceUrl: BEA_RELEASE_DATES_ENDPOINT,
      });
    }
  }

  return releases.sort((a, b) => Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt));
}

export function createBeaReleaseCalendarProvider(
  options: Pick<BeaProviderOptions, "fetchImpl"> = {},
): EconomicReleaseProvider {
  const fetchImpl = options.fetchImpl ?? fetch;
  return {
    name: BEA_PROVIDER_NAME,
    async fetchUpcomingReleases(from, to, signal?: AbortSignal) {
      const response = await fetchImpl(BEA_RELEASE_DATES_ENDPOINT, {
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal,
      });
      if (!response.ok) throw new Error(`BEA release schedule unavailable (${response.status}).`);
      return normalizeBeaReleaseDates(await response.json().catch(() => null), from, to);
    },
  };
}
