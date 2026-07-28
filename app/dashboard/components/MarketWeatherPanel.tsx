import type {
  MarketScoreModel,
  MarketWeatherModel,
  OpportunityRadarModel,
  WeatherTone,
} from "../lib/market-weather.ts";
type Props = {
  weather: MarketWeatherModel;
  radar: OpportunityRadarModel;
  score: MarketScoreModel;
};

function WeatherGlyph({ kind }: { kind: "trend" | "vol" | "mom" | "breadth" | "conditions" }) {
  if (kind === "trend") {
    return (
      <svg viewBox="0 0 24 24" className="mccWxIcon" aria-hidden="true">
        <circle cx="12" cy="12" r="4" fill="currentColor" />
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === "vol") {
    return (
      <svg viewBox="0 0 24 24" className="mccWxIcon" aria-hidden="true">
        <path d="M3 14c2-4 4-6 6-6s3 3 5 3 4-5 7-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M3 18c2-3 4-4.5 6-4.5s3 2.2 5 2.2 4-3.7 7-3.7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity=".55" />
      </svg>
    );
  }
  if (kind === "mom") {
    return (
      <svg viewBox="0 0 24 24" className="mccWxIcon" aria-hidden="true">
        <path d="M5 14 L10 8 L14 12 L19 6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M16 6h3v3" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (kind === "breadth") {
    return (
      <svg viewBox="0 0 24 24" className="mccWxIcon" aria-hidden="true">
        <path d="M4 16c2-6 4-9 8-9s6 3 8 9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M8 16h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="mccWxIcon" aria-hidden="true">
      <path d="M12 4v3M12 17v3M6.5 7.5l2 2M15.5 14.5l2 2M4 12h3M17 12h3M6.5 16.5l2-2M15.5 9.5l2-2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="12" r="2.4" fill="currentColor" />
    </svg>
  );
}

function Stars({ rating }: { rating: number }) {
  return (
    <div className="mccRadarStars" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, index) => (
        <span key={index} className={index < rating ? "is-on" : "is-off"} aria-hidden="true">
          ★
        </span>
      ))}
    </div>
  );
}

function ScoreRing({
  score,
  tone,
  descriptor,
}: {
  score: number | null;
  tone: WeatherTone;
  descriptor: string;
}) {
  const value = score == null ? 0 : Math.max(0, Math.min(100, score));
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  return (
    <div
      className={`mccScoreRing is-${tone}`}
      role="img"
      aria-label={
        score == null
          ? "Trading Conditions Score awaiting verified inputs"
          : `Trading Conditions Score ${score} out of 100, ${descriptor}`
      }
    >
      <svg viewBox="0 0 140 140" aria-hidden="true">
        <circle className="mccScoreTrack" cx="70" cy="70" r={radius} />
        <circle
          className="mccScoreProgress"
          cx="70"
          cy="70"
          r={radius}
          style={{ strokeDasharray: `${circumference}`, strokeDashoffset: offset }}
        />
      </svg>
      <div className="mccScoreValue">
        <strong>{score == null ? "—" : `${score} / 100`}</strong>
        <b className="mccScoreDescriptor">{descriptor}</b>
        <span>Trading Conditions Score</span>
      </div>
    </div>
  );
}

export function MarketWeatherPanel({ weather, radar, score }: Props) {
  const cards: Array<{
    key: string;
    kind: "trend" | "vol" | "mom" | "breadth" | "conditions";
    title: string;
    label: string;
    detail: string;
    tone: WeatherTone;
  }> = [
    { key: "trend", kind: "trend", title: "Trend", label: weather.trend.label, detail: weather.trend.detail, tone: weather.trend.tone },
    { key: "vol", kind: "vol", title: "Volatility", label: weather.volatility.label, detail: weather.volatility.detail, tone: weather.volatility.tone },
    { key: "mom", kind: "mom", title: "Momentum", label: weather.momentum.label, detail: weather.momentum.detail, tone: weather.momentum.tone },
    { key: "breadth", kind: "breadth", title: "Breadth", label: weather.breadth.label, detail: weather.breadth.detail, tone: weather.breadth.tone },
    {
      key: "conditions",
      kind: "conditions",
      title: "Trading Conditions",
      label: weather.tradingConditions.label,
      detail: weather.tradingConditions.detail,
      tone: weather.tradingConditions.tone,
    },
  ];

  return (
    <section className="mccWeatherBoard" aria-label="Market Weather and Opportunity Radar">
      <div className="mccWeatherPanel">
        <header>
          <div>
            <span className="mccEyebrow">MARKET WEATHER™</span>
            <h2>Read the session in seconds</h2>
            <p>Coloured conditions from verified Bullseye engines only.</p>
          </div>
          <div className={`mccOutlookState ${weather.verified ? "is-verified" : "is-closed"}`}>
            <i aria-hidden="true" />
            <strong>{weather.verified ? "Verified weather" : "Awaiting inputs"}</strong>
          </div>
        </header>
        <div className="mccWeatherGrid">
          {cards.map((card) => (
            <article key={card.key} className={`mccWeatherCard is-${card.tone}`}>
              <span>
                <WeatherGlyph kind={card.kind} />
                {card.title}
              </span>
              <strong>{card.label}</strong>
              <p>{card.detail}</p>
            </article>
          ))}
        </div>
      </div>

      <div className="mccRadarScoreRow">
        <article className={`mccOpportunityRadar ${radar.available ? "is-open" : "is-closed"}`}>
          <header>
            <div>
              <span className="mccEyebrow">OPPORTUNITY RADAR™</span>
              <h2>Today&apos;s Best Opportunity</h2>
            </div>
            <Stars rating={radar.rating} />
          </header>
          <p className="mccRadarHeadline">{radar.headline}</p>
          <dl className="mccRadarGrid">
            <div>
              <dt>Opportunity Rating</dt>
              <dd><Stars rating={radar.rating} /></dd>
            </div>
            <div>
              <dt>Direction</dt>
              <dd className={`is-dir-${radar.direction === "Long" ? "long" : radar.direction === "Short" ? "short" : "aside"}`}>
                {radar.direction}
              </dd>
            </div>
            <div>
              <dt>Probability</dt>
              <dd>{radar.probability === "None" ? "Awaiting confirmation" : radar.probability}</dd>
            </div>
            <div>
              <dt>Preferred Zone</dt>
              <dd>{radar.preferredZone}</dd>
            </div>
            <div>
              <dt>Target Area</dt>
              <dd>{radar.targetArea}</dd>
            </div>
            <div>
              <dt>Invalidation</dt>
              <dd>{radar.invalidation}</dd>
            </div>
            <div>
              <dt>Risk Level</dt>
              <dd>{radar.riskLevel}</dd>
            </div>
            <div className="is-wide">
              <dt>Reasoning</dt>
              <dd>{radar.reasoning}</dd>
            </div>
          </dl>
        </article>

        <article className={`mccMarketScore is-${score.tone}`}>
          <ScoreRing score={score.score} tone={score.tone} descriptor={score.descriptor} />
          <p className="mccScoreSummary">{score.summary}</p>
          <ul className="mccScoreFactors">
            {score.factors.map((factor) => (
              <li key={factor.label} className={`is-${factor.tone}`}>
                <strong>{factor.label}</strong>
                <span>{factor.detail}</span>
              </li>
            ))}
          </ul>
        </article>
      </div>
    </section>
  );
}
