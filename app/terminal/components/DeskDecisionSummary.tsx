import type { DeskDecisionPresentation } from "../lib/desk-decision-presentation.ts";
import { buildTodaysPosture } from "../lib/desk-decision-presentation.ts";

type DeskDecisionSummaryProps = {
  decision: DeskDecisionPresentation;
  onOpenRisk?: () => void;
};

export function DeskDecisionSummary({ decision, onOpenRisk }: DeskDecisionSummaryProps) {
  const blocked = decision.permissionTone === "blocked";
  const posture = buildTodaysPosture(decision);

  return (
    <section
      id="decision-summary"
      className={`deskDecisionSummary is-permission-${decision.permissionTone}`}
      aria-labelledby="desk-decision-summary-title"
    >
      <header>
        <span className="ctEyebrow">{posture.eyebrow}</span>
        <h2 id="desk-decision-summary-title">{posture.headline}</h2>
        <p className="deskDecisionSubhead">{posture.summary}</p>
      </header>
      <div className={`deskDecisionGrid${blocked ? " is-blocked-priority" : ""}`} role="list">
        {blocked ? (
          <>
            <div className={`deskDecisionCell is-permission-${decision.permissionTone} is-priority`} role="listitem">
              <span>Participation</span>
              <strong>{decision.permissionLabel}</strong>
            </div>
            <div className={`deskDecisionCell is-${decision.leanTone}`} role="listitem">
              <span>Observed market lean</span>
              <strong>{decision.leanLabel}</strong>
            </div>
            <div className="deskDecisionCell" role="listitem">
              <span>Confidence</span>
              <strong>{decision.confidenceLabel}</strong>
              {decision.confidenceDetail ? (
                <small className="deskDecisionScoreDetail">{decision.confidenceDetail}</small>
              ) : null}
            </div>
            <div className="deskDecisionCell" role="listitem">
              <span>Primary condition</span>
              <strong>{decision.primaryRisk ?? decision.riskLabel}</strong>
            </div>
          </>
        ) : (
          <>
            <div className={`deskDecisionCell is-${decision.leanTone}`} role="listitem">
              <span>Observed market lean</span>
              <strong>{decision.leanLabel}</strong>
            </div>
            <div className={`deskDecisionCell is-permission-${decision.permissionTone}`} role="listitem">
              <span>Participation</span>
              <strong>{decision.permissionLabel}</strong>
            </div>
            <div className="deskDecisionCell" role="listitem">
              <span>Confidence</span>
              <strong>{decision.confidenceLabel}</strong>
              {decision.confidenceDetail ? (
                <small className="deskDecisionScoreDetail">{decision.confidenceDetail}</small>
              ) : null}
            </div>
            <div className="deskDecisionCell" role="listitem">
              <span>Risk state</span>
              <strong>{decision.riskLabel}</strong>
            </div>
          </>
        )}
      </div>
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
      ) : blocked ? (
        <details className="deskDecisionDetails">
          <summary>Technical confirmation details</summary>
          <p>
            Engine participation remains closed while required confirmations are incomplete.
            {decision.primaryRisk ? ` Condition on record: ${decision.primaryRisk}.` : ""}
            {decision.confidenceScore != null
              ? ` Engine confidence score: ${decision.confidenceScore} / 100.`
              : ""}{" "}
            This does not invalidate verified quotes, candles, levels or catalysts shown elsewhere on
            the desk.
          </p>
          {onOpenRisk ? (
            <button type="button" onClick={onOpenRisk}>
              Open Risk &amp; Journal
            </button>
          ) : null}
        </details>
      ) : null}
    </section>
  );
}
