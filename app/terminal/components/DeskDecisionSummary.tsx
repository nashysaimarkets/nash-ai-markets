import type { DeskDecisionPresentation } from "../lib/desk-decision-presentation.ts";

type DeskDecisionSummaryProps = {
  decision: DeskDecisionPresentation;
  onOpenRisk?: () => void;
};

export function DeskDecisionSummary({ decision, onOpenRisk }: DeskDecisionSummaryProps) {
  const blocked = decision.permissionTone === "blocked";
  const title = blocked
    ? "Participation, lean, and confidence"
    : "Market lean, permission, and confidence";

  return (
    <section
      className={`deskDecisionSummary is-permission-${decision.permissionTone}`}
      aria-labelledby="desk-decision-summary-title"
    >
      <header>
        <span className="ctEyebrow">Decision summary</span>
        <h2 id="desk-decision-summary-title">{title}</h2>
      </header>
      <div className={`deskDecisionGrid${blocked ? " is-blocked-priority" : ""}`} role="list">
        {blocked ? (
          <>
            <div className={`deskDecisionCell is-permission-${decision.permissionTone} is-priority`} role="listitem">
              <span>Participation</span>
              <strong>{decision.permissionLabel}</strong>
            </div>
            <div className={`deskDecisionCell is-${decision.leanTone}`} role="listitem">
              <span>Market lean</span>
              <strong>{decision.leanLabel}</strong>
            </div>
            <div className="deskDecisionCell" role="listitem">
              <span>Confidence</span>
              <strong>{decision.confidenceLabel}</strong>
            </div>
            <div className="deskDecisionCell" role="listitem">
              <span>Primary risk</span>
              <strong>{decision.primaryRisk ?? decision.riskLabel}</strong>
            </div>
          </>
        ) : (
          <>
            <div className={`deskDecisionCell is-${decision.leanTone}`} role="listitem">
              <span>Market lean</span>
              <strong>{decision.leanLabel}</strong>
            </div>
            <div className={`deskDecisionCell is-permission-${decision.permissionTone}`} role="listitem">
              <span>Participation</span>
              <strong>{decision.permissionLabel}</strong>
            </div>
            <div className="deskDecisionCell" role="listitem">
              <span>Confidence</span>
              <strong>{decision.confidenceLabel}</strong>
            </div>
            <div className="deskDecisionCell" role="listitem">
              <span>Risk state</span>
              <strong>{decision.riskLabel}</strong>
            </div>
          </>
        )}
      </div>
      <p className="deskDecisionWhy">
        <span>Why</span>
        {decision.why}
      </p>
      {(decision.supporting.length > 0 || decision.opposing.length > 0) ? (
        <div className="deskDecisionEvidence">
          {decision.supporting.length ? (
            <div>
              <h3>Supporting</h3>
              <ul>{decision.supporting.map((item) => <li key={`s-${item}`}>{item}</li>)}</ul>
            </div>
          ) : null}
          {decision.opposing.length ? (
            <div>
              <h3>Opposing</h3>
              <ul>{decision.opposing.map((item) => <li key={`o-${item}`}>{item}</li>)}</ul>
            </div>
          ) : null}
        </div>
      ) : null}
      {!blocked && decision.primaryRisk ? (
        <footer className="deskDecisionRisk">
          <div>
            <span>Primary risk</span>
            <strong>{decision.primaryRisk}</strong>
          </div>
          {onOpenRisk ? (
            <button type="button" onClick={onOpenRisk}>
              Open Risk &amp; Journal
            </button>
          ) : null}
        </footer>
      ) : blocked && onOpenRisk ? (
        <footer className="deskDecisionRisk">
          <div>
            <span>Next step</span>
            <strong>Review Risk &amp; Journal before any participation decision.</strong>
          </div>
          <button type="button" onClick={onOpenRisk}>
            Open Risk &amp; Journal
          </button>
        </footer>
      ) : null}
    </section>
  );
}
