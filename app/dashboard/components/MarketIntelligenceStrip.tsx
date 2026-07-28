type StripQuote = {
  id: string;
  name: string;
  value: string | null;
  change: string | null;
  percent: string | null;
  direction: "up" | "down" | "flat" | "unknown";
  sparkline: number[];
  updatedAt: string | null;
  coverage: "live" | "awaiting";
  note?: string;
};

function Sparkline({ values, direction }: { values: number[]; direction: StripQuote["direction"] }) {
  if (values.length < 2) {
    return <svg className="mccSparkline is-empty" viewBox="0 0 64 24" aria-hidden="true"><path d="M2 12h60" /></svg>;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 64;
      const y = 22 - ((value - min) / span) * 20;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg className={`mccSparkline is-${direction}`} viewBox="0 0 64 24" aria-hidden="true">
      <polyline fill="none" strokeWidth="1.6" points={points} />
    </svg>
  );
}

function arrow(direction: StripQuote["direction"]) {
  if (direction === "up") return "▲";
  if (direction === "down") return "▼";
  if (direction === "flat") return "●";
  return "·";
}

export function MarketIntelligenceStrip({ quotes, loading = false }: { quotes: StripQuote[]; loading?: boolean }) {
  if (loading) {
    return (
      <section className="mccIntelStrip" aria-label="Market intelligence loading">
        {Array.from({ length: 6 }).map((_, index) => (
          <article key={index} className="mccIntelCard is-skeleton" aria-hidden="true">
            <div className="mccSkeletonBar short" />
            <div className="mccSkeletonBar" />
            <div className="mccSkeletonBar short" />
          </article>
        ))}
      </section>
    );
  }

  return (
    <section className="mccIntelStrip" aria-label="Market intelligence strip">
      {quotes.map((quote) => (
        <article key={quote.id} className={`mccIntelCard is-${quote.direction} is-${quote.coverage}`}>
          <header>
            <span>{quote.name}</span>
            <b aria-hidden="true">{arrow(quote.direction)}</b>
          </header>
          {quote.coverage === "awaiting" || quote.value === null ? (
            <>
              <strong className="mccAwaiting">Awaiting coverage</strong>
              <p>{quote.note ?? "Verified provider feed not connected for this instrument."}</p>
            </>
          ) : (
            <>
              <strong>{quote.value}</strong>
              <div className="mccIntelChange">
                <span>{quote.change ?? "—"}</span>
                <em>{quote.percent ?? ""}</em>
              </div>
              <Sparkline values={quote.sparkline} direction={quote.direction} />
              <footer>
                <small>{quote.updatedAt ? `Updated ${quote.updatedAt}` : "Timestamp unavailable"}</small>
              </footer>
            </>
          )}
        </article>
      ))}
    </section>
  );
}

export type { StripQuote };
