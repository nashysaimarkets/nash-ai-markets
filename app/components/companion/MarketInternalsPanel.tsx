import type { MarketInternalCard } from "../../lib/ai-market-insight.ts";
import { ConceptHint } from "../oracle/ConceptHint.tsx";

/**
 * Every card in this section is legitimately unavailable until a verified feed
 * is connected. Repeating the same "Unavailable" badge and the same awaiting
 * sentence on six full-size cards made ordinary missing coverage look like six
 * separate failures, so the shared status is stated once for the group and each
 * metric keeps a single concise description plus its existing detail on demand.
 */
export function MarketInternalsPanel({ cards }: { cards: readonly MarketInternalCard[] }) {
  return (
    <section className="companionInternals" aria-labelledby="market-internals-title">
      <header>
        <span className="companionEyebrow">MARKET INTERNALS</span>
        <h2 id="market-internals-title">
          Breadth &amp; flow <span className="dashPlannedBadge">Planned integration</span>
        </h2>
        <p>
          Advanced datasets that are not connected yet. These are planned integrations rather than faults, and
          nothing here is estimated — unavailable is never shown as zero.
        </p>
      </header>
      <ul className="companionInternalsGrid is-wide is-compact">
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
            <p>{card.measures}</p>
            <details className="companionWhy">
              <summary>Why it matters</summary>
              <p>{card.whyItMatters}</p>
              <p className="companionInternalStatus">
                {card.status}. {card.detail}
              </p>
            </details>
          </li>
        ))}
      </ul>
    </section>
  );
}
