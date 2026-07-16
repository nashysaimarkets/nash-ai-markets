import type { ReactNode } from "react";
import type { DataProvenance } from "../lib/provenance.ts";
import { DataProvenanceBlock } from "./DataProvenanceBlock";
import { formatPanelTimestamp, panelMarketStatus, panelUnavailableMessage } from "../lib/terminal-state.ts";

type PanelProps = {
  eyebrow: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  id?: string;
  provenance?: DataProvenance;
};

export function Panel({ eyebrow, title, subtitle, children, className, id, provenance }: PanelProps) {
  const unavailableMessage = panelUnavailableMessage(provenance?.status ?? "");
  const marketStatus = provenance ? panelMarketStatus(provenance.status) : null;
  return (
    <section id={id} className={['terminalPanel', className].filter(Boolean).join(' ')}>
      <div className="terminalPanelHead">
        <div>
          <span className="terminalPanelEyebrow">{eyebrow}</span>
          <h2>{title}</h2>
        </div>
        <div className="terminalPanelMeta">
          {subtitle ? <small>{subtitle}</small> : null}
          {provenance && marketStatus ? (
            <>
              <span className="panelMarketStatus" data-market-status={marketStatus.toLowerCase()}><i />{marketStatus}</span>
              <time dateTime={provenance.lastUpdated}>Updated {formatPanelTimestamp(provenance.lastUpdated)}</time>
            </>
          ) : null}
        </div>
      </div>
      {unavailableMessage ? (
        <div className="panelUnavailableState" role="status">
          <strong>VERIFIED DATA UNAVAILABLE</strong>
          <span>{unavailableMessage}</span>
        </div>
      ) : children}
      {provenance ? (
        <div className="panelProvenanceWrap">
          <DataProvenanceBlock provenance={provenance} />
        </div>
      ) : null}
    </section>
  );
}
