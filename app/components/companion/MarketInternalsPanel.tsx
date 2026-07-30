import type { MarketInternalCard } from "../../lib/ai-market-insight.ts";

export function MarketInternalsPanel({ cards }: { cards: readonly MarketInternalCard[] }) {
  return (
    <section className="companionInternals" aria-labelledby="market-internals-title">
      <header>
        <span className="companionEyebrow">MARKET INTERNALS</span>
        <h2 id="market-internals-title">Breadth &amp; flow</h2>
        <p>Shown only when a verified feed exists. No placeholders are invented.</p>
      </header>
      <ul className="companionInternalsGrid">
        {cards.map((card) => (
          <li key={card.id} className="is-unavailable">
            <span>{card.label}</span>
            <strong>{card.status}</strong>
            <p>{card.detail}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
