export type DataStatus = "LIVE" | "DELAYED" | "VERIFIED" | "MODELLED" | "PLACEHOLDER" | "UNAVAILABLE";
export type DataKind = "fact" | "analysis";

export type DataProvenance = {
  source: string;
  lastUpdated: string;
  status: DataStatus;
  kind: DataKind;
  provider: string;
  badgeLabel: string;
};

export function createDataProvenance(input: {
  source: string;
  lastUpdated: string;
  status: DataStatus;
  kind: DataKind;
  provider?: string;
}): DataProvenance {
  const badgeLabel = input.status === "LIVE"
    ? "Live"
    : input.status === "DELAYED"
      ? "Delayed"
      : input.status === "VERIFIED"
        ? "Verified"
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
    provider: input.provider ?? "NASH AI Markets",
    badgeLabel,
  };
}

export function formatProvenanceLabel(provenance: DataProvenance): string {
  return `${provenance.kind === "fact" ? "Fact" : "Analysis"} · ${provenance.badgeLabel}`;
}
