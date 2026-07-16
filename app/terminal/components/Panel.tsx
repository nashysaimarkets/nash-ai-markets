import type { ReactNode } from "react";
import type { DataProvenance } from "../lib/provenance.ts";
import { DataProvenanceBlock } from "./DataProvenanceBlock";

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
  return (
    <section id={id} className={['terminalPanel', className].filter(Boolean).join(' ')}>
      <div className="terminalPanelHead">
        <div>
          <span className="terminalPanelEyebrow">{eyebrow}</span>
          <h2>{title}</h2>
        </div>
        {subtitle ? <small>{subtitle}</small> : null}
      </div>
      {children}
      {provenance ? (
        <div className="panelProvenanceWrap">
          <DataProvenanceBlock provenance={provenance} />
        </div>
      ) : null}
    </section>
  );
}
