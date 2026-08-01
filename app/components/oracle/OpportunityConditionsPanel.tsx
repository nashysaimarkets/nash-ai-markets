import type { OpportunityRadarEducational } from "../../lib/oracle/opportunity-conditions.ts";
import { StatusBadge } from "../../dashboard/components/visual/StatusBadge.tsx";

function statusTone(status: string): "positive" | "info" | "caution" | "muted" | "risk" {
  if (status === "developing") return "positive";
  if (status === "watching") return "info";
  if (status === "unavailable") return "muted";
  return "caution";
}

export function OpportunityConditionsPanel({ model }: { model: OpportunityRadarEducational }) {
  const empty = model.activeCount === 0;

  return (
    <section className="oracleOpportunity" aria-labelledby="opportunity-radar-title">
      <header>
        <span className="companionEyebrow">OPPORTUNITY RADAR</span>
        <h2 id="opportunity-radar-title">Educational condition watches</h2>
        <p>
          {empty
            ? "No verified conditions are ready."
            : `${model.activeCount} active watch${model.activeCount === 1 ? "" : "es"} from verified conditions.`}
        </p>
      </header>

      {empty ? (
        <div className="oracleOpportunityEmpty" role="status">
          <StatusBadge label="Awaiting confirmation" tone="muted" />
          <strong>No verified conditions are ready.</strong>
          <p>
            {model.cards[0]?.missing[0]
              ? `Missing: ${model.cards[0].missing[0]}.`
              : "Confirmation evidence remains incomplete for educational setup families."}
          </p>
        </div>
      ) : (
        <ul className="oracleOpportunityGrid">
          {model.cards.map((card) => (
            <li key={card.id} className={`is-${card.status}`}>
              <StatusBadge label={card.status} tone={statusTone(card.status)} />
              <strong>{card.category}</strong>
              {card.supporting.length ? (
                <p>
                  <em>Supporting · </em>
                  {card.supporting.slice(0, 2).join(" · ")}
                </p>
              ) : null}
              {card.missing.length ? (
                <p>
                  <em>Missing · </em>
                  {card.missing.slice(0, 2).join(" · ")}
                </p>
              ) : null}
              <p>
                <b>Invalidation:</b> {card.invalidation}
              </p>
              {card.eventRisk ? <p className="is-warn">{card.eventRisk}</p> : null}
            </li>
          ))}
        </ul>
      )}
      <p className="companionDisclosure">{model.disclosure}</p>
    </section>
  );
}
