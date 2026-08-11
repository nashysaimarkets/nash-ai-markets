import type { EconomicRelease } from "../../macro-data.ts";
import type { EconomicReleaseProvider } from "./contracts.ts";

export type OfficialEconomicCalendarResult = {
  releases: EconomicRelease[];
  successfulProviders: string[];
  failedProviders: string[];
};

function validDate(value: string): number | null {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function validRelease(value: unknown, fromMs: number, toMs: number): value is EconomicRelease {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Partial<EconomicRelease>;
  if (
    typeof candidate.id !== "string" || !candidate.id.trim()
    || typeof candidate.name !== "string" || !candidate.name.trim()
    || !["BLS", "BEA", "CENSUS", "FED"].includes(String(candidate.agency))
    || !["HIGH", "MED"].includes(String(candidate.risk))
    || typeof candidate.scheduledAt !== "string"
  ) return false;

  const scheduledMs = validDate(candidate.scheduledAt);
  if (scheduledMs === null || scheduledMs < fromMs || scheduledMs > toMs) return false;

  if (candidate.sourceUrl !== undefined) {
    if (typeof candidate.sourceUrl !== "string" || !candidate.sourceUrl.trim()) return false;
    try {
      const url = new URL(candidate.sourceUrl);
      if (url.protocol !== "https:") return false;
    } catch {
      return false;
    }
  }

  if (candidate.actual !== undefined && candidate.actual !== null && !Number.isFinite(candidate.actual)) return false;
  if (candidate.previous !== undefined && candidate.previous !== null && !Number.isFinite(candidate.previous)) return false;

  return true;
}

function dedupeKey(release: EconomicRelease): string {
  return [
    release.agency,
    new Date(release.scheduledAt).toISOString(),
    release.name.trim().toLowerCase().replace(/\s+/g, " "),
  ].join("|");
}

export async function aggregateOfficialEconomicCalendar(
  providers: readonly EconomicReleaseProvider[],
  from: Date,
  to: Date,
): Promise<OfficialEconomicCalendarResult> {
  const fromMs = from.getTime();
  const toMs = to.getTime();
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || fromMs > toMs) {
    return { releases: [], successfulProviders: [], failedProviders: providers.map((provider) => provider.name) };
  }

  const settled = await Promise.allSettled(
    providers.map((provider) => provider.fetchUpcomingReleases(from, to)),
  );

  const successfulProviders: string[] = [];
  const failedProviders: string[] = [];
  const deduped = new Map<string, EconomicRelease>();

  settled.forEach((result, index) => {
    const provider = providers[index]!;
    if (result.status === "rejected" || !Array.isArray(result.value)) {
      failedProviders.push(provider.name);
      return;
    }

    successfulProviders.push(provider.name);
    for (const release of result.value) {
      if (!validRelease(release, fromMs, toMs)) continue;
      const normalized: EconomicRelease = {
        ...release,
        id: release.id.trim(),
        name: release.name.trim(),
        scheduledAt: new Date(release.scheduledAt).toISOString(),
      };
      const key = dedupeKey(normalized);
      if (!deduped.has(key)) deduped.set(key, normalized);
    }
  });

  const releases = [...deduped.values()].sort((left, right) => {
    const byTime = Date.parse(left.scheduledAt) - Date.parse(right.scheduledAt);
    if (byTime !== 0) return byTime;
    const byAgency = left.agency.localeCompare(right.agency);
    if (byAgency !== 0) return byAgency;
    const byName = left.name.localeCompare(right.name);
    return byName !== 0 ? byName : left.id.localeCompare(right.id);
  });

  return { releases, successfulProviders, failedProviders };
}
