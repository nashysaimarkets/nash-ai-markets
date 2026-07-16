import type { DataProvenance } from "../lib/provenance";

type DataProvenanceBadgeProps = {
  provenance: DataProvenance;
};

export function DataProvenanceBadge({ provenance }: DataProvenanceBadgeProps) {
  return (
    <div className="dataProvenanceBadge" data-status={provenance.status}>
      <span className="dataProvenanceBadgeLabel">{provenance.badgeLabel}</span>
      <span className="dataProvenanceBadgeKind">{provenance.kind === "fact" ? "Fact" : "Analysis"}</span>
    </div>
  );
}
