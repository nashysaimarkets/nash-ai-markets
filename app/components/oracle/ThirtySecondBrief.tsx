import type { ThirtySecondBriefModel } from "../../lib/oracle/thirty-second-brief.ts";
import { ConceptHint } from "./ConceptHint.tsx";

export function ThirtySecondBrief({ model }: { model: ThirtySecondBriefModel }) {
  return (
    <section className={`oracleThirty${!model.available ? " is-limited" : ""}`} aria-labelledby="thirty-second-title">
      <header>
        <div>
          <span className="companionEyebrow">TODAY IN 30 SECONDS</span>
          <h2 id="thirty-second-title">{model.title}</h2>
        </div>
        <ConceptHint conceptId="delayed-data" />
      </header>
      <dl className="oracleThirtyGrid">
        <div><dt>Posture</dt><dd>{model.posture}</dd></div>
        <div><dt>Observed lean</dt><dd>{model.lean}</dd></div>
        <div><dt>Supporting factor</dt><dd>{model.supportingFactor}</dd></div>
        <div><dt>Biggest risk</dt><dd>{model.biggestRisk}</dd></div>
        <div><dt>Next catalyst</dt><dd>{model.nextCatalyst}</dd></div>
        <div><dt>Avoid</dt><dd>{model.avoid}</dd></div>
        <div className="is-wide"><dt>Data freshness</dt><dd>{model.freshness}</dd></div>
      </dl>
      <p className="companionDisclosure">{model.disclosure}</p>
    </section>
  );
}
