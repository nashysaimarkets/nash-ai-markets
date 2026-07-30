import type { OpportunityRadarEducational } from "../../lib/oracle/opportunity-conditions.ts";

export function OpportunityConditionsPanel({ model }: { model: OpportunityRadarEducational }) {
  return (
    <section className="oracleOpportunity" aria-labelledby="opportunity-radar-title">
      <header>
        <span className="companionEyebrow">OPPORTUNITY RADAR</span>
        <h2 id="opportunity-radar-title">Educational condition watches</h2>
        <p>{model.activeCount} active watch{model.activeCount === 1 ? "" : "es"} from verified conditions.</p>
      </header>
      <ul className="oracleOpportunityGrid">
        {model.cards.map((card) => (
          <li key={card.id} className={`is-${card.status}`}>
            <span>{card.status}</span>
            <strong>{card.category}</strong>
            {card.supporting.length ? (
              <div>
                <em>Supporting</em>
                <ul>{card.supporting.map((item) => <li key={item}>{item}</li>)}</ul>
              </div>
            ) : null}
            {card.missing.length ? (
              <div>
                <em>Missing confirmation</em>
                <ul>{card.missing.map((item) => <li key={item}>{item}</li>)}</ul>
              </div>
            ) : null}
            <p><b>Invalidation:</b> {card.invalidation}</p>
            {card.levels.length ? <p><b>Levels:</b> {card.levels.join(" · ")}</p> : null}
            {card.eventRisk ? <p className="is-warn">{card.eventRisk}</p> : null}
            <small>{card.freshness}</small>
          </li>
        ))}
      </ul>
      <p className="companionDisclosure">{model.disclosure}</p>
    </section>
  );
}
