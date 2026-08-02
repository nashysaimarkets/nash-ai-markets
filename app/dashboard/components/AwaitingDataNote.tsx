import type { ReactNode } from "react";

/**
 * Shared presentation for the Dashboard's legitimate unavailable states.
 *
 * Several sections previously carried their own bespoke empty markup, each
 * restating the full reason in a slightly different way, which made ordinary
 * gaps in optional coverage read like six separate faults. This keeps every
 * state truthful and visible while giving them one calm, consistent shape:
 * a short status, a plain-English reason, and optional depth on request.
 */
export function AwaitingDataNote({
  statusLabel,
  reason,
  explanation,
  whyItMatters,
  sourceLine,
  action,
  className = "",
  labelledBy,
}: {
  statusLabel: string;
  reason: string;
  explanation?: string;
  whyItMatters?: string;
  sourceLine?: string;
  action?: ReactNode;
  className?: string;
  labelledBy?: string;
}) {
  return (
    <aside
      className={`dashAwaiting ${className}`.trim()}
      role="status"
      aria-label={labelledBy ? undefined : statusLabel}
      aria-labelledby={labelledBy}
    >
      <span className="dashAwaitingStatus">{statusLabel}</span>
      <p className="dashAwaitingReason">{reason}</p>
      {explanation ? <p className="dashAwaitingExplain">{explanation}</p> : null}
      {whyItMatters ? (
        <details className="dashAwaitingWhy">
          <summary>Why it matters</summary>
          <p>{whyItMatters}</p>
        </details>
      ) : null}
      {sourceLine ? <small className="dashAwaitingSource">{sourceLine}</small> : null}
      {action ? <div className="dashAwaitingAction">{action}</div> : null}
    </aside>
  );
}
