import type { ReactNode } from "react";

type PanelProps = {
  eyebrow: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
};

export function Panel({ eyebrow, title, subtitle, children, className }: PanelProps) {
  return (
    <section className={['terminalPanel', className].filter(Boolean).join(' ')}>
      <div className="terminalPanelHead">
        <div>
          <span className="terminalPanelEyebrow">{eyebrow}</span>
          <h2>{title}</h2>
        </div>
        {subtitle ? <small>{subtitle}</small> : null}
      </div>
      {children}
    </section>
  );
}
