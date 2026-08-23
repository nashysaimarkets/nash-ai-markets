import type { FilingActivity } from "../../macro-data.ts";
import type { FilingActivityProvider } from "./contracts.ts";

export const SEC_PROVIDER_NAME = "U.S. Securities and Exchange Commission";
export const SEC_ATTRIBUTION = "U.S. Securities and Exchange Commission / EDGAR";
export const SEC_SUBMISSIONS_BASE = "https://data.sec.gov/submissions/";

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export type SecFilingActivity = FilingActivity & {
  retrievedAt: string;
  primaryDocument?: string;
};

export type SecEdgarProviderOptions = {
  ciks: readonly string[];
  userAgent: string;
  fetchImpl?: FetchLike;
  now?: () => number;
};

function normalizeCik(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  if (!digits || digits.length > 10) return null;
  return digits.padStart(10, "0");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function recentRows(payload: unknown): SecFilingActivity[] {
  if (!isRecord(payload) || !isRecord(payload.filings) || !isRecord(payload.filings.recent)) return [];
  const recent = payload.filings.recent;
  const accessions = recent.accessionNumber;
  const forms = recent.form;
  const filed = recent.filingDate;
  const accepted = recent.acceptanceDateTime;
  const primaryDocs = recent.primaryDocument;
  if (!Array.isArray(accessions) || !Array.isArray(forms) || !Array.isArray(filed)) return [];

  const cik = normalizeCik(String(payload.cik ?? ""));
  const companyName = String(payload.name ?? "").trim();
  if (!cik || !companyName) return [];

  const rows: SecFilingActivity[] = [];
  for (let index = 0; index < accessions.length; index += 1) {
    const accessionNumber = String(accessions[index] ?? "").trim();
    const form = String(forms[index] ?? "").trim();
    const filedDate = String(filed[index] ?? "").trim();
    if (!accessionNumber || !["10-K", "10-Q", "8-K", "20-F", "40-F", "6-K"].includes(form)) continue;

    const acceptedValue = Array.isArray(accepted) ? String(accepted[index] ?? "").trim() : "";
    const acceptedMs = acceptedValue ? Date.parse(acceptedValue.endsWith("Z") ? acceptedValue : `${acceptedValue}Z`) : NaN;
    const filedMs = Date.parse(`${filedDate}T00:00:00.000Z`);
    const timestamp = Number.isFinite(acceptedMs) ? acceptedMs : filedMs;
    if (!Number.isFinite(timestamp)) continue;

    const primaryDocument = Array.isArray(primaryDocs) ? String(primaryDocs[index] ?? "").trim() : "";
    rows.push({
      id: `sec-${accessionNumber}`,
      companyName,
      cik,
      form,
      filedAt: new Date(timestamp).toISOString(),
      accessionNumber,
      source: {
        agency: SEC_PROVIDER_NAME,
        dataset: "EDGAR Submissions API",
        attribution: SEC_ATTRIBUTION,
      },
      retrievedAt: "",
      ...(primaryDocument ? { primaryDocument } : {}),
    });
  }
  return rows;
}

export function normalizeSecSubmissionsPayload(payload: unknown, retrievedAt: string): SecFilingActivity[] {
  return recentRows(payload)
    .map((row) => ({ ...row, retrievedAt }))
    .sort((left, right) => Date.parse(right.filedAt) - Date.parse(left.filedAt));
}

export function createSecEdgarFilingProvider(options: SecEdgarProviderOptions): FilingActivityProvider {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? Date.now;

  return {
    name: SEC_PROVIDER_NAME,
    async fetchRecentActivity() {
      if (!options.userAgent.trim()) return [];
      const retrievedAt = new Date(now()).toISOString();
      const ciks = [...new Set(options.ciks.map(normalizeCik).filter((cik): cik is string => Boolean(cik)))];

      const settled = await Promise.allSettled(ciks.map(async (cik) => {
        const url = `${SEC_SUBMISSIONS_BASE}CIK${cik}.json`;
        const response = await fetchImpl(url, {
          headers: {
            Accept: "application/json",
            "User-Agent": options.userAgent,
          },
          cache: "no-store",
        });
        if (!response.ok) return [];
        const payload: unknown = await response.json().catch(() => null);
        return normalizeSecSubmissionsPayload(payload, retrievedAt);
      }));

      return settled
        .flatMap((result) => result.status === "fulfilled" ? result.value : [])
        .sort((left, right) => Date.parse(right.filedAt) - Date.parse(left.filedAt));
    },
  };
}
