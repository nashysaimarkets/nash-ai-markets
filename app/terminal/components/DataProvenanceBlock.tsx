import type { DataProvenance } from "../lib/provenance.ts";
import { DataProvenanceBadge } from "./DataProvenanceBadge";
import { isVerifiedMarketTimestamp } from "../../lib/market-data.ts";

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
        <span>Provider</span>
        <strong>{provenance.provider}</strong>
      </div>
      <div className="dataProvenanceBlockMeta">
        <span>Last updated</span>
        <strong>{isVerifiedMarketTimestamp(provenance.lastUpdated) ? provenance.lastUpdated : "Unavailable"}</strong>
      </div>
      <div className="dataProvenanceBlockMeta dataProvenanceBlockMetaStatus">
        <span>Data status</span>
        <DataProvenanceBadge provenance={provenance} />
      </div>
    </div>
  );
}
