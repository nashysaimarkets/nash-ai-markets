import type { DeskDecisionPresentation } from "../lib/desk-decision-presentation.ts";

type DeskDecisionSummaryProps = {
  decision: DeskDecisionPresentation;
  onOpenRisk?: () => void;
};

export function DeskDecisionSummary({ decision, onOpenRisk }: DeskDecisionSummaryProps) {
  return (
    <section
      className={`deskDecisionSummary is-permission-${decision.permissionTone}`}
      aria-labelledby="desk-decision-summary-title"
    >
      <header>
        <span className="ctEyebrow">Decision summary</span>
        <h2 id="desk-decision-summary-title">Market lean, permission, and confidence</h2>
      </header>
      <div className="deskDecisionGrid" role="list">
        <div className={`deskDecisionCell is-${decision.leanTone}`} role="listitem">
          <span>Market lean</span>
          <strong>{decision.leanLabel}</strong>
        </div>
        <div className={`deskDecisionCell is-permission-${decision.permissionTone}`} role="listitem">
          <span>Trade permission</span>
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
      {decision.primaryRisk ? (
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
      ) : null}
    </section>
  );
}
