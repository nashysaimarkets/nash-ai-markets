import type { MacroObservation } from "../../macro-data.ts";
import type { ScalarObservationProvider } from "./contracts.ts";

export const TREASURY_PROVIDER_NAME = "U.S. Department of the Treasury";
export const TREASURY_DATASET_NAME = "Daily Treasury Par Yield Curve Rates";
export const TREASURY_ATTRIBUTION =
  "U.S. Department of the Treasury / Daily Treasury Par Yield Curve Rates";
export const TREASURY_XML_ENDPOINT =
  "https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml";

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export type TreasuryYieldProviderOptions = {
  fetchImpl?: FetchLike;
  now?: () => number;
};

type TreasuryRow = {
  date: string;
  year2: number;
  year10: number;
  year30: number;
};

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function xmlTagValue(block: string, tag: string): string | null {
  const escaped = escapeRegex(tag);
  const match = block.match(
    new RegExp(`<(?:[A-Za-z0-9_-]+:)?${escaped}\\b[^>]*>([\\s\\S]*?)<\\/(?:[A-Za-z0-9_-]+:)?${escaped}>`, "i"),
  );
  return match?.[1]?.trim() || null;
}

function finiteNumber(value: string | null): number | null {
  if (value === null || !value.trim()) return null;
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizedObservationDate(value: string | null): string | null {
  if (!value) return null;
  const match = value.trim().match(/^(\d{4}-\d{2}-\d{2})/);
  if (!match) return null;
  const timestamp = Date.parse(`${match[1]}T00:00:00.000Z`);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

export function parseTreasuryYieldCurveXml(xml: string): TreasuryRow[] {
  if (!xml.trim()) return [];

  const rows: TreasuryRow[] = [];
  const entries = xml.match(/<entry\b[\s\S]*?<\/entry>/gi) ?? [];

  for (const entry of entries) {
    const properties =
      entry.match(/<(?:[A-Za-z0-9_-]+:)?properties\b[^>]*>[\s\S]*?<\/(?:[A-Za-z0-9_-]+:)?properties>/i)?.[0]
      ?? entry;

    const date = normalizedObservationDate(xmlTagValue(properties, "NEW_DATE"));
    const year2 = finiteNumber(xmlTagValue(properties, "BC_2YEAR"));
    const year10 = finiteNumber(xmlTagValue(properties, "BC_10YEAR"));
    const year30 = finiteNumber(xmlTagValue(properties, "BC_30YEAR"));

    if (date === null || year2 === null || year10 === null || year30 === null) continue;

    rows.push({ date, year2, year10, year30 });
  }

  return rows.sort((left, right) => Date.parse(right.date) - Date.parse(left.date));
}

function observation(
  metric: "US2Y" | "US10Y" | "US30Y",
  value: number,
  observationAt: string,
  retrievedAt: string,
): MacroObservation {
  return {
    id: `treasury-${metric.toLowerCase()}-${observationAt.slice(0, 10)}`,
    metric,
    value,
    unit: "%",
    observationAt,
    retrievedAt,
    freshness: "DAILY",
    source: {
      agency: TREASURY_PROVIDER_NAME,
      dataset: TREASURY_DATASET_NAME,
      attribution: TREASURY_ATTRIBUTION,
    },
  };
}

export function createTreasuryYieldProvider(
  options: TreasuryYieldProviderOptions = {},
): ScalarObservationProvider {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? Date.now;

  return {
    name: TREASURY_PROVIDER_NAME,

    async fetchObservations(signal?: AbortSignal): Promise<MacroObservation[]> {
      const retrievedAtMs = now();
      const retrievedAt = new Date(retrievedAtMs).toISOString();
      const year = new Date(retrievedAtMs).getUTCFullYear();

      const url = new URL(TREASURY_XML_ENDPOINT);
      url.searchParams.set("data", "daily_treasury_yield_curve");
      url.searchParams.set("field_tdr_date_value", String(year));

      try {
        const response = await fetchImpl(url, {
          headers: { Accept: "application/xml, text/xml;q=0.9" },
          cache: "no-store",
          signal,
        });
        if (!response.ok) return [];

        const xml = await response.text();
        const latest = parseTreasuryYieldCurveXml(xml)[0];
        if (!latest) return [];

        return [
          observation("US2Y", latest.year2, latest.date, retrievedAt),
          observation("US10Y", latest.year10, latest.date, retrievedAt),
          observation("US30Y", latest.year30, latest.date, retrievedAt),
        ];
      } catch {
        return [];
      }
    },
  };
}
