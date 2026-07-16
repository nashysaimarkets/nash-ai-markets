import type { DataProvenance } from "../lib/provenance";
import { DataProvenanceBadge } from "./DataProvenanceBadge";

type DataProvenanceBlockProps = {
  provenance: DataProvenance;
};

export function DataProvenanceBlock({ provenance }: DataProvenanceBlockProps) {
  return (
    <div className="dataProvenanceBlock">
      <div className="dataProvenanceBlockMeta">
        <span>Source</span>
        <strong>{provenance.source}</strong>
      </div>
      <div className="dataProvenanceBlockMeta">
        <span>Last updated</span>
        <strong>{provenance.lastUpdated}</strong>
      </div>
      <div className="dataProvenanceBlockMeta dataProvenanceBlockMetaStatus">
        <span>Data status</span>
        <DataProvenanceBadge provenance={provenance} />
      </div>
    </div>
  );
}
