import type { MarketInternalCard } from "../../lib/ai-market-insight.ts";
import { ConceptHint } from "../oracle/ConceptHint.tsx";

export function MarketInternalsPanel({ cards }: { cards: readonly MarketInternalCard[] }) {
  return (
    <section className="companionInternals" aria-labelledby="market-internals-title">
      <header>
        <span className="companionEyebrow">MARKET INTERNALS</span>
        <h2 id="market-internals-title">Breadth &amp; flow</h2>
        <p>Polished unavailable states until a verified feed exists. Unavailable is not zero.</p>
      </header>
      <ul className="companionInternalsGrid is-wide">
        {cards.map((card) => (
          <li key={card.id} className="is-unavailable">
            <div className="companionInternalHead">
              <span>{card.label}</span>
              <ConceptHint
                conceptId={
                  card.id === "put-call"
                    ? "put-call"
                    : card.id === "gamma"
                      ? "gamma"
                      : card.id === "dealer"
                        ? "dealer"
                        : card.id
                }
              />
            </div>
            <strong>{card.status}</strong>
            <p>{card.detail}</p>
            <small>{card.measures}</small>
            <details className="companionWhy">
              <summary>Why it matters</summary>
              <p>{card.whyItMatters}</p>
            </details>
          </li>
        ))}
      </ul>
    </section>
  );
}
