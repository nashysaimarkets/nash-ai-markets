export type DataStatus = "LIVE" | "DELAYED" | "MODELLED" | "PLACEHOLDER" | "UNAVAILABLE";
export type DataKind = "fact" | "analysis";

export type DataProvenance = {
  source: string;
  lastUpdated: string;
  status: DataStatus;
  kind: DataKind;
  badgeLabel: string;
};

export function createDataProvenance(input: {
  source: string;
  lastUpdated: string;
  status: DataStatus;
  kind: DataKind;
}): DataProvenance {
  const badgeLabel = input.status === "LIVE"
    ? "Live"
    : input.status === "DELAYED"
      ? "Delayed"
      : input.status === "MODELLED"
        ? "Modelled"
        : input.status === "PLACEHOLDER"
          ? "Placeholder"
          : "Unavailable";

  return {
    source: input.source,
    lastUpdated: input.lastUpdated,
    status: input.status,
    kind: input.kind,
    badgeLabel,
  };
}

export function formatProvenanceLabel(provenance: DataProvenance): string {
  return `${provenance.kind === "fact" ? "Fact" : "Analysis"} · ${provenance.badgeLabel}`;
}
