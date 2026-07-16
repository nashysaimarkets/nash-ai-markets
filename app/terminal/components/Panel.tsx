import type { ReactNode } from "react";
import type { DataProvenance } from "../lib/provenance.ts";
import { DataProvenanceBlock } from "./DataProvenanceBlock";
import { panelUnavailableMessage } from "../lib/terminal-state.ts";

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
  return (
    <section id={id} className={['terminalPanel', className].filter(Boolean).join(' ')}>
      <div className="terminalPanelHead">
        <div>
          <span className="terminalPanelEyebrow">{eyebrow}</span>
          <h2>{title}</h2>
        </div>
        {subtitle ? <small>{subtitle}</small> : null}
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
