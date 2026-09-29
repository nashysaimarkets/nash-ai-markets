import type { MacroObservation } from "../../macro-data.ts";
import type { ScalarObservationProvider } from "./contracts.ts";

export type OfficialObservationsResult = {
  observations: MacroObservation[];
  successfulProviders: string[];
  failedProviders: string[];
};

function validObservation(value: unknown): value is MacroObservation {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Partial<MacroObservation>;
  return (
    typeof candidate.id === "string" && candidate.id.trim().length > 0
    && typeof candidate.metric === "string" && candidate.metric.trim().length > 0
    && typeof candidate.unit === "string"
    && typeof candidate.observationAt === "string"
    && typeof candidate.retrievedAt === "string"
    && typeof candidate.freshness === "string"
    && Boolean(candidate.source)
    && typeof candidate.source?.agency === "string"
    && typeof candidate.source?.dataset === "string"
    && typeof candidate.source?.attribution === "string"
    && (candidate.value === null || Number.isFinite(candidate.value))
  );
}

function dedupeKey(observation: MacroObservation): string {
  return [observation.metric, observation.observationAt, observation.source.agency].join("|");
}

export async function aggregateOfficialObservations(
  providers: readonly ScalarObservationProvider[],
  signal?: AbortSignal,
): Promise<OfficialObservationsResult> {
  if (!providers.length) {
    return { observations: [], successfulProviders: [], failedProviders: [] };
  }

  const settled = await Promise.allSettled(
    providers.map((provider) => provider.fetchObservations(signal)),
  );

  const successfulProviders: string[] = [];
  const failedProviders: string[] = [];
  const deduped = new Map<string, MacroObservation>();

  settled.forEach((result, index) => {
    const provider = providers[index]!;
    if (result.status === "rejected" || !Array.isArray(result.value)) {
      failedProviders.push(provider.name);
      return;
    }

    successfulProviders.push(provider.name);
    for (const observation of result.value) {
      if (!validObservation(observation)) continue;
      const normalized: MacroObservation = {
        ...observation,
        id: observation.id.trim(),
        observationAt: new Date(observation.observationAt).toISOString(),
        retrievedAt: new Date(observation.retrievedAt).toISOString(),
      };
      const key = dedupeKey(normalized);
      if (!deduped.has(key)) deduped.set(key, normalized);
    }
  });

  const observations = [...deduped.values()].sort((left, right) => {
    const byMetric = left.metric.localeCompare(right.metric);
    if (byMetric !== 0) return byMetric;
    return Date.parse(right.observationAt) - Date.parse(left.observationAt);
  });

  return { observations, successfulProviders, failedProviders };
}
