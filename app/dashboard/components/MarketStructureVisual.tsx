import type { MarketLevel } from "../../lib/market-data.ts";

type MarketStructureVisualProps = {
  levels: MarketLevel[];
  scores: {
    riskOnRiskOff: number;
    marketSentiment: number;
    trend: number;
    volatility: number;
  };
  status: string;
  directionalBias: string;
  confidence: number | null;
};

const SIGNALS = [
  { key: "riskOnRiskOff", label: "Risk appetite", low: "Risk-off", high: "Risk-on" },
  { key: "marketSentiment", label: "Sentiment", low: "Defensive", high: "Constructive" },
  { key: "trend", label: "Trend structure", low: "Weak", high: "Strong" },
  { key: "inverseVolatility", label: "Volatility context", low: "Elevated", high: "Contained" },
] as const;

export function MarketStructureVisual({ levels, scores, status, directionalBias, confidence }: MarketStructureVisualProps) {
  const available = status === "LIVE" || status === "DELAYED";
  const signalValues = {
    riskOnRiskOff: scores.riskOnRiskOff,
    marketSentiment: scores.marketSentiment,
    trend: scores.trend,
    inverseVolatility: 100 - scores.volatility,
  };
  const support = levels.filter((level) => level.type === "support").slice(0, 2);
  const resistance = levels.filter((level) => level.type === "resistance").slice(0, 2);
  const hasLevels = support.length > 0 || resistance.length > 0;
  const relationPoints = SIGNALS.map((signal, index) => `${196 + signalValues[signal.key] * 4.68},${39 + index * 64}`).join(" ");

  return (
    <section className="eliteStructurePanel" aria-labelledby="structure-title">
      <header>
        <div>
          <span className="eliteEyebrow">BULLSEYE INTELLIGENCE MAP</span>
          <h2 id="structure-title">Market structure at a glance</h2>
          <p>Normalised decision-engine context—not a price chart or forecast.</p>
        </div>
        {available ? <div className="eliteStructureSummary"><span><small>Directional bias</small><strong>{directionalBias}</strong></span><span><small>Confidence</small><strong>{confidence ?? "—"}{confidence === null ? "" : "/100"}</strong></span></div> : <span className="eliteChartLegend"><i /> Provider verification in progress</span>}
      </header>
      <div className="eliteStructureBody">
        <div className="eliteSignalChart">
          {available ? <svg viewBox="0 0 720 286" role="img" aria-label="Normalised risk appetite, sentiment, trend and volatility context">
            <defs>
              <linearGradient id="eliteSignalRail" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#ef7777" stopOpacity=".34" />
                <stop offset=".5" stopColor="#7c8d98" stopOpacity=".16" />
                <stop offset="1" stopColor="#62e6b1" stopOpacity=".38" />
              </linearGradient>
              <filter id="eliteSignalGlow"><feGaussianBlur stdDeviation="2.5" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
            </defs>
            <line x1="196" x2="196" y1="22" y2="255" className="eliteChartAxis" />
            <line x1="430" x2="430" y1="22" y2="255" className="eliteChartAxis isMid" />
            <line x1="664" x2="664" y1="22" y2="255" className="eliteChartAxis" />
            <g className="eliteContextTarget">
              <circle cx="430" cy="139" r="118" />
              <circle cx="430" cy="139" r="78" />
              <circle cx="430" cy="139" r="38" />
            </g>
            <polyline points={relationPoints} className="eliteRelationshipSpine" />
            {SIGNALS.map((signal, index) => {
              const value = signalValues[signal.key];
              const y = 43 + index * 64;
              const markerX = 196 + value * 4.68;
              return <g key={signal.key}>
                <text x="10" y={y - 4} className="eliteSignalName">{signal.label}</text>
                <text x="10" y={y + 13} className="eliteSignalContext">{value < 45 ? signal.low : value > 55 ? signal.high : "Balanced"}</text>
                <rect x="196" y={y - 8} width="468" height="9" rx="4.5" fill="url(#eliteSignalRail)" />
                <line x1={markerX} x2={markerX} y1={y - 15} y2={y + 8} className="eliteSignalMarker" filter="url(#eliteSignalGlow)" />
                <circle cx={markerX} cy={y - 3.5} r="4.5" className="eliteSignalPoint" />
                <text x={markerX} y={y - 22} textAnchor="middle" className="eliteSignalValue">{value}</text>
              </g>;
            })}
            <text x="196" y="278" textAnchor="start" className="eliteAxisLabel">0 · DEFENSIVE</text>
            <text x="430" y="278" textAnchor="middle" className="eliteAxisLabel">50 · NEUTRAL</text>
            <text x="664" y="278" textAnchor="end" className="eliteAxisLabel">100 · CONSTRUCTIVE</text>
          </svg> : <div className="eliteSignalEmpty" role="status">
            <span aria-hidden="true"><i /><i /><i /></span>
            <div><strong>Awaiting verified intelligence</strong><p>The Bullseye context map will resolve directional structure, confidence and key levels after provider validation.</p></div>
          </div>}
        </div>
        <aside className="eliteLevelRail" aria-label="Verified support and resistance">
          <div className="eliteLevelRailHeading"><span>KEY LEVELS</span><small>{available && hasLevels ? "Verified provider input" : "Provider verification in progress"}</small></div>
          {available && hasLevels ? <>
            <div className="eliteLevelGroup isResistance"><span>RESISTANCE</span>{resistance.length ? resistance.map((level) => <div key={`${level.label}-${level.value}`}><small>{level.label}</small><strong>{level.value}</strong><em>{level.note}</em></div>) : <p>Not supplied</p>}</div>
            <div className="eliteLevelMid"><span>DECISION RANGE</span><i /></div>
            <div className="eliteLevelGroup isSupport"><span>SUPPORT</span>{support.length ? support.map((level) => <div key={`${level.label}-${level.value}`}><small>{level.label}</small><strong>{level.value}</strong><em>{level.note}</em></div>) : <p>Not supplied</p>}</div>
          </> : <div className="eliteLevelEmpty"><span aria-hidden="true">⌁</span><strong>Level intelligence awaiting verification</strong><p>Support and resistance appear only when supplied by the active market provider.</p></div>}
        </aside>
      </div>
    </section>
  );
}
