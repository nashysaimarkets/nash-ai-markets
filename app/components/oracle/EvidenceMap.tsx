import Link from "next/link";
import type { EvidenceMapModel } from "../../lib/oracle/evidence-map.ts";
import { ConceptHint } from "./ConceptHint.tsx";

export function EvidenceMap({ model }: { model: EvidenceMapModel }) {
  return (
    <section
      className={`oracleEvidenceMap is-${model.outcome.permissionTone}`}
      aria-labelledby="evidence-map-title"
    >
      <header>
        <div>
          <span className="companionEyebrow">TRANSPARENT EVIDENCE MAP</span>
          <h2 id="evidence-map-title">How the evidence reaches the permission</h2>
          <p>{model.summary}</p>
        </div>
        <ConceptHint conceptId="confidence" />
      </header>

      <div className="oracleEvidenceFlow">
        <div className="oracleEvidenceNodes" role="list" aria-label="Evidence factors">
          {model.nodes.map((node) => (
            <div role="listitem" className={`is-${node.lane}`} key={node.id}>
              <details>
                <summary>
                  <i aria-hidden="true" />
                  <span>
                    <strong>{node.displayLabel}</strong>
                    <small>{node.sourceLabel}</small>
                  </span>
                  <em>{node.relationLabel}</em>
                </summary>
                <div className="oracleEvidenceNodeDetail">
                  <p>{node.displayExplanation}</p>
                  <dl>
                    <div><dt>Strength</dt><dd>{node.strength}</dd></div>
                    <div><dt>Data</dt><dd>{node.displayDataStatus}</dd></div>
                  </dl>
                  <p><b>Why it matters:</b> {node.whyItMatters}</p>
                </div>
              </details>
            </div>
          ))}
        </div>

        <div className="oracleEvidenceConnector" aria-hidden="true">
          <i /><span>Evidence</span><i />
        </div>

        <aside className={`oracleEvidenceOutcome is-${model.outcome.permissionTone}`}>
          <span>DECISION PERMISSION</span>
          <strong>{model.outcome.permissionLabel}</strong>
          <p>{model.outcome.headline}</p>
          <dl>
            <div><dt>Observed lean</dt><dd>{model.outcome.leanLabel}</dd></div>
            <div><dt>Primary constraint</dt><dd>{model.outcome.primaryRisk}</dd></div>
            <div><dt>Evidence freshness</dt><dd>{model.outcome.freshness}</dd></div>
          </dl>
          <small>
            {model.exampleOnly ? "Example-only context" : model.verified ? "Verified context" : "Verification withheld"}
          </small>
        </aside>
      </div>

      <footer className="oracleEvidenceFooter">
        <ul aria-label="Evidence relation legend">
          <li className="is-supportive">Supportive</li>
          <li className="is-restrictive">Restrictive</li>
          <li className="is-neutral">Neutral</li>
          <li className="is-unavailable">Unavailable</li>
        </ul>
        <p>{model.methodology}</p>
        <Link href="/methodology">Read the Bullseye methodology →</Link>
      </footer>
    </section>
  );
}
