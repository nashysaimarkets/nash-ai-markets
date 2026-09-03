import type { EconomicRelease, MacroObservation } from "../../macro-data.ts";
import type { EconomicReleaseProvider, ScalarObservationProvider } from "./contracts.ts";

export const FED_PROVIDER_NAME = "Federal Reserve Board";
export const FED_BROAD_DOLLAR_ATTRIBUTION = "Federal Reserve Board / H.10 Nominal Broad Dollar Index / Not DXY";
export const FED_H10_DAILY_INDEX_CSV =
  "https://www.federalreserve.gov/datadownload/Output.aspx?rel=H10&series=122e3bcb627e8e53f1bf72a1a09cfb81&lastobs=10&from=&to=&filetype=csv&label=include&layout=seriescolumn";
export const FED_MONETARY_POLICY_RSS = "https://www.federalreserve.gov/feeds/press_monetary.xml";
export const FED_EVENTS_CALENDAR_BASE = "https://www.federalreserve.gov/newsevents";

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
type FedOptions = { fetchImpl?: FetchLike; now?: () => number };

function finiteNumber(value: string): number | null {
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function csvCells(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]!;
    if (char === "\"") {
      if (quoted && line[i + 1] === "\"") { current += "\""; i += 1; }
      else quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(current);
      current = "";
    } else current += char;
  }
  cells.push(current);
  return cells;
}

export function normalizeFedBroadDollarCsv(csv: string, retrievedAt: string): MacroObservation[] {
  const lines = csv.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];
  const header = csvCells(lines[0]!);
  const dateIndex = header.findIndex((cell) => /^DATE$/i.test(cell.trim()));
  const broadIndex = header.findIndex((cell) => /JRXWTFB_N\.B/i.test(cell) || /Nominal Broad Dollar Index/i.test(cell));
  if (dateIndex < 0 || broadIndex < 0) return [];

  const rows = lines.slice(1).flatMap((line) => {
    const cells = csvCells(line);
    const date = cells[dateIndex]?.trim() ?? "";
    const value = finiteNumber(cells[broadIndex] ?? "");
    const timestamp = Date.parse(`${date}T00:00:00.000Z`);
    return Number.isFinite(timestamp) && value !== null ? [{ at: new Date(timestamp).toISOString(), value }] : [];
  }).sort((a, b) => Date.parse(b.at) - Date.parse(a.at));

  const latest = rows[0];
  if (!latest) return [];

  return [{
    id: `fed-broad-dollar-${latest.at.slice(0, 10)}`,
    metric: "FED_BROAD_DOLLAR",
    value: latest.value,
    unit: "JAN06=100",
    observationAt: latest.at,
    retrievedAt,
    freshness: "DAILY",
    source: {
      agency: FED_PROVIDER_NAME,
      dataset: "H.10 Nominal Broad Dollar Index",
      attribution: FED_BROAD_DOLLAR_ATTRIBUTION,
    },
  }];
}

export function createFederalReserveDollarProvider(options: FedOptions = {}): ScalarObservationProvider {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? Date.now;
  return {
    name: FED_PROVIDER_NAME,
    async fetchObservations(signal?: AbortSignal) {
      const retrievedAt = new Date(now()).toISOString();
      try {
        const response = await fetchImpl(FED_H10_DAILY_INDEX_CSV, {
          headers: { Accept: "text/csv" },
          cache: "no-store",
          signal,
        });
        if (!response.ok) return [];
        return normalizeFedBroadDollarCsv(await response.text(), retrievedAt);
      } catch {
        return [];
      }
    },
  };
}

function xmlText(block: string, tag: string): string | null {
  const match = block.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match?.[1]?.replace(/<!\[CDATA\[|\]\]>/g, "").trim() || null;
}

export function normalizeFedMonetaryPolicyRss(
  xml: string,
  from: Date,
  to: Date,
): EconomicRelease[] {
  const fromMs = from.getTime();
  const toMs = to.getTime();
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || fromMs > toMs) return [];
  const items = xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? [];
  const releases: EconomicRelease[] = [];

  for (const item of items) {
    const title = xmlText(item, "title") ?? "";
    if (!/FOMC statement|Minutes of the Federal Open Market Committee/i.test(title)) continue;
    const pubDate = xmlText(item, "pubDate");
    const link = xmlText(item, "link");
    if (!pubDate || !link || !link.startsWith("https://www.federalreserve.gov/")) continue;
    const timestamp = Date.parse(pubDate);
    if (!Number.isFinite(timestamp) || timestamp < fromMs || timestamp > toMs) continue;

    const name = /minutes/i.test(title) ? "FOMC Minutes" : "FOMC Statement";
    const scheduledAt = new Date(timestamp).toISOString();
    releases.push({
      id: `fed-${name.toLowerCase().replace(/\s+/g, "-")}-${scheduledAt}`,
      name,
      agency: "FED",
      scheduledAt,
      risk: "HIGH",
      sourceUrl: link,
    });
  }

  return releases.sort((a, b) => Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt));
}

const MONTH_NAMES = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"] as const;

function easternOffsetHours(year: number, month: number, day: number, hour: number): number {
  const approximateUtc = new Date(Date.UTC(year, month - 1, day, hour));
  const offset = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    timeZoneName: "shortOffset",
    hour: "2-digit",
  }).formatToParts(approximateUtc).find((part) => part.type === "timeZoneName")?.value ?? "GMT-5";
  const match = offset.match(/GMT([+-]\d{1,2})(?::(\d{2}))?/);
  if (!match) return -5;
  return Number(match[1]) + Number(match[2] ?? "0") / 60 * Math.sign(Number(match[1]));
}

function fedCalendarMonthUrl(year: number, month: number): string {
  return `${FED_EVENTS_CALENDAR_BASE}/${year}-${MONTH_NAMES[month - 1]}.htm`;
}

function calendarMonths(from: Date, to: Date): Array<{ year: number; month: number; url: string }> {
  const months: Array<{ year: number; month: number; url: string }> = [];
  const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
  const end = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1));
  while (cursor <= end && months.length < 3) {
    const year = cursor.getUTCFullYear();
    const month = cursor.getUTCMonth() + 1;
    months.push({ year, month, url: fedCalendarMonthUrl(year, month) });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return months;
}

function calendarText(html: string): string {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&ndash;|&#8211;/gi, "-")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeFedEventsCalendarHtml(
  html: string,
  year: number,
  month: number,
  from: Date,
  to: Date,
): EconomicRelease[] {
  const text = calendarText(html);
  const monthName = MONTH_NAMES[month - 1];
  if (!monthName || !/2:00\s*p\.?m\.?/i.test(text)) return [];
  const match = text.match(new RegExp(`FOMC Meeting\\s+Two-day meeting,\\s*${monthName}\\s+(\\d{1,2})\\s*[-–]\\s*(\\d{1,2})`, "i"));
  if (!match) return [];
  const decisionDay = Number(match[2]);
  const offsetHours = easternOffsetHours(year, month, decisionDay, 14);
  const timestamp = Date.UTC(year, month - 1, decisionDay, 14 - offsetHours);
  if (!Number.isFinite(timestamp) || timestamp < from.getTime() || timestamp > to.getTime()) return [];
  const scheduledAt = new Date(timestamp).toISOString();
  return [{
    id: `fed-fomc-rate-decision-${scheduledAt}`,
    name: "FOMC Rate Decision",
    agency: "FED",
    scheduledAt,
    risk: "HIGH",
    sourceUrl: fedCalendarMonthUrl(year, month),
  }];
}

/**
 * Combines the official monthly events calendar for scheduled FOMC decisions
 * with the monetary-policy RSS feed for published statements and minutes.
 */
export function createFederalReserveReleaseProvider(options: Pick<FedOptions, "fetchImpl"> = {}): EconomicReleaseProvider {
  const fetchImpl = options.fetchImpl ?? fetch;
  return {
    name: FED_PROVIDER_NAME,
    async fetchUpcomingReleases(from, to, signal?: AbortSignal) {
      const months = calendarMonths(from, to);
      const requests = await Promise.allSettled([
        fetchImpl(FED_MONETARY_POLICY_RSS, { headers: { Accept: "application/rss+xml, application/xml" }, cache: "no-store", signal }),
        ...months.map(({ url }) => fetchImpl(url, { headers: { Accept: "text/html" }, cache: "no-store", signal })),
      ]);
      const successfulResponses = requests.flatMap((result) => result.status === "fulfilled" && result.value.ok ? [result.value] : []);
      if (!successfulResponses.length) throw new Error("Federal Reserve release schedules unavailable.");
      const releases: EconomicRelease[] = [];
      const rss = requests[0];
      if (rss?.status === "fulfilled" && rss.value.ok) {
        releases.push(...normalizeFedMonetaryPolicyRss(await rss.value.text(), from, to));
      }
      for (let index = 0; index < months.length; index += 1) {
        const result = requests[index + 1];
        if (result?.status !== "fulfilled" || !result.value.ok) continue;
        const month = months[index]!;
        releases.push(...normalizeFedEventsCalendarHtml(await result.value.text(), month.year, month.month, from, to));
      }
      const byTimestamp = new Map<string, EconomicRelease>();
      for (const release of releases.sort((left, right) => left.name === "FOMC Rate Decision" ? -1 : right.name === "FOMC Rate Decision" ? 1 : 0)) {
        if (!byTimestamp.has(release.scheduledAt)) byTimestamp.set(release.scheduledAt, release);
      }
      return [...byTimestamp.values()].sort((left, right) => Date.parse(left.scheduledAt) - Date.parse(right.scheduledAt));
    },
  };
}
