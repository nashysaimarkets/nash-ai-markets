import type { EconomicRelease, MacroObservation } from "../../macro-data.ts";
import type { EconomicReleaseProvider, ScalarObservationProvider } from "./contracts.ts";

export const FED_PROVIDER_NAME = "Federal Reserve Board";
export const FED_BROAD_DOLLAR_ATTRIBUTION = "Federal Reserve Board / H.10 Nominal Broad Dollar Index / Not DXY";
export const FED_H10_DAILY_INDEX_CSV =
  "https://www.federalreserve.gov/datadownload/Output.aspx?rel=H10&series=122e3bcb627e8e53f1bf72a1a09cfb81&lastobs=10&from=&to=&filetype=csv&label=include&layout=seriescolumn";
export const FED_MONETARY_POLICY_RSS = "https://www.federalreserve.gov/feeds/press_monetary.xml";

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

/**
 * Uses the Federal Reserve's official monetary-policy RSS feed for published
 * FOMC statements/minutes. It intentionally does not infer future meeting times
 * from the human-readable calendar.
 */
export function createFederalReserveReleaseProvider(options: Pick<FedOptions, "fetchImpl"> = {}): EconomicReleaseProvider {
  const fetchImpl = options.fetchImpl ?? fetch;
  return {
    name: FED_PROVIDER_NAME,
    async fetchUpcomingReleases(from, to, signal?: AbortSignal) {
      try {
        const response = await fetchImpl(FED_MONETARY_POLICY_RSS, {
          headers: { Accept: "application/rss+xml, application/xml" },
          cache: "no-store",
          signal,
        });
        if (!response.ok) return [];
        return normalizeFedMonetaryPolicyRss(await response.text(), from, to);
      } catch {
        return [];
      }
    },
  };
}
