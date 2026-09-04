import type { EconomicRelease, MacroMetric, MacroObservation } from "../../macro-data.ts";
import type { EconomicReleaseProvider, ScalarObservationProvider } from "./contracts.ts";

export const BLS_PROVIDER_NAME = "U.S. Bureau of Labor Statistics";
export const BLS_ATTRIBUTION = "U.S. Bureau of Labor Statistics";
export const BLS_API_ENDPOINT = "https://api.bls.gov/publicAPI/v2/timeseries/data/";
export const BLS_CALENDAR_ENDPOINT = "https://www.bls.gov/schedule/news_release/bls.ics";

export const BLS_SERIES = {
  CPI: "CUSR0000SA0",
  CORE_CPI: "CUSR0000SA0L1E",
  PAYROLLS: "CES0000000001",
  UNEMPLOYMENT: "LNS14000000",
  PPI: "WPSFD4",
  JOLTS: "JTS000000000000000JOL",
} as const satisfies Record<
  Extract<MacroMetric, "CPI" | "CORE_CPI" | "PAYROLLS" | "UNEMPLOYMENT" | "PPI" | "JOLTS">,
  string
>;

type BlsMetric = keyof typeof BLS_SERIES;
type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

type BlsProviderOptions = {
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

function observationDate(year: unknown, period: unknown): string | null {
  const yearText = String(year ?? "");
  const periodText = String(period ?? "");
  if (!/^\d{4}$/.test(yearText) || !/^M(0[1-9]|1[0-2])$/.test(periodText)) return null;
  return `${yearText}-${periodText.slice(1)}-01T00:00:00.000Z`;
}

function unitFor(metric: BlsMetric): string {
  if (metric === "UNEMPLOYMENT") return "%";
  if (metric === "PAYROLLS" || metric === "JOLTS") return "thousands";
  return "index";
}

function datasetFor(metric: BlsMetric): string {
  if (metric === "CPI" || metric === "CORE_CPI") return "Consumer Price Index";
  if (metric === "PAYROLLS" || metric === "UNEMPLOYMENT") return "Employment Situation";
  if (metric === "PPI") return "Producer Price Index";
  return "Job Openings and Labor Turnover Survey";
}

function metricBySeriesId(seriesId: string): BlsMetric | null {
  const match = (Object.entries(BLS_SERIES) as Array<[BlsMetric, string]>)
    .find(([, id]) => id === seriesId);
  return match?.[0] ?? null;
}

export function normalizeBlsApiPayload(payload: unknown, retrievedAt: string): MacroObservation[] {
  if (!isRecord(payload) || payload.status !== "REQUEST_SUCCEEDED" || !isRecord(payload.Results)) return [];
  const rawSeries = payload.Results.series;
  if (!Array.isArray(rawSeries)) return [];

  const observations: MacroObservation[] = [];

  for (const candidate of rawSeries) {
    if (!isRecord(candidate) || typeof candidate.seriesID !== "string" || !Array.isArray(candidate.data)) continue;
    const metric = metricBySeriesId(candidate.seriesID);
    if (!metric) continue;

    const latest = candidate.data
      .map((datum): { at: string; value: number } | null => {
        if (!isRecord(datum)) return null;
        const at = observationDate(datum.year, datum.period);
        const value = finiteNumber(datum.value);
        return at && value !== null ? { at, value } : null;
      })
      .filter((datum): datum is { at: string; value: number } => datum !== null)
      .sort((left, right) => Date.parse(right.at) - Date.parse(left.at))[0];

    if (!latest) continue;

    observations.push({
      id: `bls-${metric.toLowerCase()}-${latest.at.slice(0, 7)}`,
      metric,
      value: latest.value,
      unit: unitFor(metric),
      observationAt: latest.at,
      retrievedAt,
      freshness: "DAILY",
      source: {
        agency: BLS_PROVIDER_NAME,
        dataset: datasetFor(metric),
        attribution: BLS_ATTRIBUTION,
      },
    });
  }

  const order: BlsMetric[] = ["CPI", "CORE_CPI", "PAYROLLS", "UNEMPLOYMENT", "PPI", "JOLTS"];
  return observations.sort((left, right) =>
    order.indexOf(left.metric as BlsMetric) - order.indexOf(right.metric as BlsMetric)
  );
}

export function createBlsObservationProvider(options: BlsProviderOptions = {}): ScalarObservationProvider {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? Date.now;

  return {
    name: BLS_PROVIDER_NAME,
    async fetchObservations(signal?: AbortSignal) {
      const retrievedAt = new Date(now()).toISOString();

      try {
        const response = await fetchImpl(BLS_API_ENDPOINT, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ seriesid: Object.values(BLS_SERIES) }),
          cache: "no-store",
          signal,
        });
        if (!response.ok) return [];
        const payload: unknown = await response.json().catch(() => null);
        return normalizeBlsApiPayload(payload, retrievedAt);
      } catch {
        return [];
      }
    },
  };
}

function unfoldIcs(ics: string): string[] {
  return ics.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "").split(/\r?\n/);
}

function parseIcsEvents(ics: string): Array<Record<string, string>> {
  const events: Array<Record<string, string>> = [];
  let current: Record<string, string> | null = null;

  for (const line of unfoldIcs(ics)) {
    if (line === "BEGIN:VEVENT") {
      current = {};
      continue;
    }
    if (line === "END:VEVENT") {
      if (current) events.push(current);
      current = null;
      continue;
    }
    if (!current) continue;
    const colon = line.indexOf(":");
    if (colon <= 0) continue;
    current[line.slice(0, colon)] = line.slice(colon + 1);
  }
  return events;
}

function icsField(event: Record<string, string>, name: string): string | null {
  const entry = Object.entries(event).find(([key]) => key === name || key.startsWith(`${name};`));
  return entry?.[1]?.replace(/\\([,;])/g, "$1").replace(/\\n/gi, " ").trim() || null;
}

function easternOffsetHours(year: number, month: number, day: number, hour: number, minute: number): number {
  const approximateUtc = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    timeZoneName: "shortOffset",
    hour: "2-digit",
  });
  const offset = formatter.formatToParts(approximateUtc)
    .find((part) => part.type === "timeZoneName")?.value ?? "GMT-5";
  const match = offset.match(/GMT([+-]\d{1,2})(?::(\d{2}))?/);
  if (!match) return -5;
  return Number(match[1]) + Number(match[2] ?? "0") / 60 * Math.sign(Number(match[1]));
}

function icsDateToIso(key: string, value: string): string | null {
  const match = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/);
  if (!match) return null;
  const [, y, m, d, hh, mm, ss = "00", z] = match;
  const year = Number(y);
  const month = Number(m);
  const day = Number(d);
  const hour = Number(hh);
  const minute = Number(mm);
  const second = Number(ss);
  if (z) return new Date(Date.UTC(year, month - 1, day, hour, minute, second)).toISOString();

  // The live BLS feed currently declares `TZID=US-Eastern` while older
  // fixtures and some calendar clients use America/New_York or US/Eastern.
  // Treat all three official aliases as Eastern rather than silently dropping
  // every scheduled release in the feed.
  const isEastern = /TZID=(?:America\/New_York|US[\/-]Eastern)/i.test(key);
  if (!isEastern) return null;
  const offsetHours = easternOffsetHours(year, month, day, hour, minute);
  return new Date(Date.UTC(year, month - 1, day, hour - offsetHours, minute, second)).toISOString();
}

function calendarIdentity(summary: string): Pick<EconomicRelease, "name" | "risk"> | null {
  const text = summary.trim();
  if (/Consumer Price Index/i.test(text)) return { name: "Consumer Price Index", risk: "HIGH" };
  if (/Employment Situation/i.test(text)) return { name: "Employment Situation", risk: "HIGH" };
  if (/Producer Price Index/i.test(text)) return { name: "Producer Price Index", risk: "HIGH" };
  if (/Job Openings and Labor Turnover Survey/i.test(text)) {
    return { name: "Job Openings and Labor Turnover Survey", risk: "HIGH" };
  }
  return null;
}

export function normalizeBlsCalendarIcs(ics: string, from: Date, to: Date): EconomicRelease[] {
  const fromMs = from.getTime();
  const toMs = to.getTime();
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || fromMs > toMs) return [];

  const releases: EconomicRelease[] = [];
  for (const event of parseIcsEvents(ics)) {
    // Production calendars may attach LANGUAGE or other standard ICS
    // parameters to SUMMARY/UID. Exact-key-only parsing silently erased valid
    // releases such as Employment Situation from the Pocket calendar.
    const summary = icsField(event, "SUMMARY");
    if (!summary) continue;
    const identity = calendarIdentity(summary);
    if (!identity) continue;

    const dateEntry = Object.entries(event).find(([key]) => key === "DTSTART" || key.startsWith("DTSTART;"));
    if (!dateEntry) continue;
    const scheduledAt = icsDateToIso(dateEntry[0], dateEntry[1]);
    if (!scheduledAt) continue;
    const timestamp = Date.parse(scheduledAt);
    if (timestamp < fromMs || timestamp > toMs) continue;

    const uid = icsField(event, "UID");
    releases.push({
      id: uid ? `bls-${uid}` : `bls-${identity.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${scheduledAt}`,
      name: identity.name,
      agency: "BLS",
      scheduledAt,
      risk: identity.risk,
      sourceUrl: BLS_CALENDAR_ENDPOINT,
    });
  }

  return releases.sort((left, right) => Date.parse(left.scheduledAt) - Date.parse(right.scheduledAt));
}

export function createBlsReleaseCalendarProvider(options: BlsProviderOptions = {}): EconomicReleaseProvider {
  const fetchImpl = options.fetchImpl ?? fetch;

  return {
    name: BLS_PROVIDER_NAME,
    async fetchUpcomingReleases(from: Date, to: Date, signal?: AbortSignal) {
      const response = await fetchImpl(BLS_CALENDAR_ENDPOINT, {
        headers: { Accept: "text/calendar", "User-Agent": "Pocket Bullseye/1.3 (+https://nashaimarkets.com)" },
        cache: "no-store",
        signal,
      });
      if (!response.ok) throw new Error(`BLS release schedule unavailable (${response.status}).`);
      return normalizeBlsCalendarIcs(await response.text(), from, to);
    },
  };
}
