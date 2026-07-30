import { CONCEPT_EXPLAINERS, type ConceptExplainerId } from "../../lib/oracle/concept-explainers.ts";

export function ConceptHint({ conceptId }: { conceptId: ConceptExplainerId }) {
  const concept = CONCEPT_EXPLAINERS[conceptId];
  return (
    <details className="oracleConceptHint">
      <summary aria-label={`Explain ${concept.title}`}>What is this?</summary>
      <div>
        <strong>{concept.title}</strong>
        <p>{concept.summary}</p>
        <p>{concept.whyItMatters}</p>
      </div>
    </details>
  );
}
