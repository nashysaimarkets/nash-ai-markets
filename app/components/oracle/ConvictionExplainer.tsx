import type { ConvictionExplainerModel } from "../../lib/oracle/conviction-explainer.ts";
import { ConceptHint } from "./ConceptHint.tsx";

export function ConvictionExplainer({ model }: { model: ConvictionExplainerModel }) {
  return (
    <section className="oracleConviction" aria-labelledby="conviction-title">
      <header>
        <div>
          <span className="companionEyebrow">AI CONVICTION EXPLAINER</span>
          <h2 id="conviction-title">Why the cases look this way</h2>
        </div>
        <ConceptHint conceptId="bull-bear" />
      </header>
      <ul className="oracleConvictionList">
        {model.factors.map((factor) => (
          <li key={factor.id} className={`is-${factor.relation}`}>
            <div>
              <strong>{factor.label}</strong>
              <em>{factor.strength}</em>
              <span>{factor.dataStatus}</span>
            </div>
            <p>{factor.explanation}</p>
            <details className="companionWhy">
              <summary>Why this matters</summary>
              <p>{factor.whyItMatters}</p>
            </details>
          </li>
        ))}
      </ul>
      <p className="companionDisclosure">{model.methodology}</p>
    </section>
  );
}
