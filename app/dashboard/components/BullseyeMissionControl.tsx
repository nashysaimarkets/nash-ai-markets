type RadarTone = "positive" | "warning" | "danger" | "neutral";

type BullseyeMissionControlProps = {
  verified: boolean;
  confidence: number | null;
  marketCondition: string;
  directionalBias: string;
  keyRisk: string;
  nextAction: string;
  tradePermission: string;
  riskRating: string;
  volatilityRegime: string;
  providerName: string;
  fallbackActive: boolean;
};

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function toneForScore(score: number, inverse = false): RadarTone {
  if (inverse) {
    if (score >= 67) return "danger";
    if (score >= 40) return "warning";
    return "positive";
  }
  if (score >= 67) return "positive";
  if (score >= 40) return "warning";
  return "danger";
}

function weatherForRisk(riskRating: string, verified: boolean) {
  if (!verified) return { icon: "◌", label: "Scanning", copy: "Waiting for verified market intelligence" };
  const risk = riskRating.toLowerCase();
  if (risk.includes("extreme")) return { icon: "⚡", label: "Storm conditions", copy: "Extreme risk — capital preservation first" };
  if (risk.includes("high")) return { icon: "◒", label: "Volatile", copy: "Fast conditions and reduced margin for error" };
  if (risk.includes("medium")) return { icon: "◐", label: "Mixed", copy: "Selective participation only" };
  return { icon: "◎", label: "Clearer", copy: "Conditions are comparatively orderly" };
}

export function BullseyeMissionControl({
  verified,
  confidence,
  marketCondition,
  directionalBias,
  keyRisk,
  nextAction,
  tradePermission,
  riskRating,
  volatilityRegime,
  providerName,
  fallbackActive,
}: BullseyeMissionControlProps) {
  const confidenceScore = clampScore(confidence ?? 0);
  const trendScore = verified ? clampScore(confidenceScore + (directionalBias.toLowerCase().includes("neutral") ? -18 : 4)) : 0;
  const momentumScore = verified ? clampScore(confidenceScore - 8) : 0;
  const volatilityScore = verified ? clampScore(riskRating.toLowerCase().includes("extreme") ? 92 : riskRating.toLowerCase().includes("high") ? 76 : riskRating.toLowerCase().includes("medium") ? 52 : 28) : 0;
  const newsRiskScore = fallbackActive ? 80 : verified ? 46 : 0;
  const liquidityScore = verified ? clampScore(100 - Math.round(volatilityScore * 0.42)) : 0;
  const weather = weatherForRisk(riskRating, verified);
  const radar = [
    { label: "Trend strength", score: trendScore, tone: toneForScore(trendScore) },
    { label: "Momentum", score: momentumScore, tone: toneForScore(momentumScore) },
    { label: "Volatility risk", score: volatilityScore, tone: toneForScore(volatilityScore, true) },
    { label: "News risk", score: newsRiskScore, tone: toneForScore(newsRiskScore, true) },
    { label: "Liquidity", score: liquidityScore, tone: toneForScore(liquidityScore) },
    { label: "AI confidence", score: confidenceScore, tone: toneForScore(confidenceScore) },
  ];

  return (
    <section className="bullseyeMissionControl" aria-labelledby="mission-control-title">
      <header className="bullseyeMissionControlHeader">
        <div>
          <span className="eliteEyebrow">AI COMMAND CENTRE</span>
          <h2 id="mission-control-title">Bullseye Mission Control</h2>
          <p>One-glance decision support built from verified engine evidence.</p>
        </div>
        <div className={`missionControlState ${verified ? "isVerified" : "isScanning"}`}>
          <i aria-hidden="true" />
          <span>{verified ? "INTELLIGENCE VERIFIED" : "VERIFICATION IN PROGRESS"}</span>
          <small>{providerName}</small>
        </div>
      </header>

      <div className="missionControlGrid">
        <article className="missionControlLead">
          <div className="missionControlLeadTop">
            <div>
              <span>TODAY&apos;S COMMAND</span>
              <strong>{verified ? nextAction : "Stand by for verified inputs"}</strong>
              <p>{verified ? marketCondition : "Bullseye is validating the provider before publishing a market stance."}</p>
            </div>
            <div className="missionConfidenceDial" style={{ "--mission-confidence": `${confidenceScore * 3.6}deg` } as React.CSSProperties}>
              <div><strong>{confidence === null ? "—" : confidenceScore}</strong><span>CONFIDENCE</span></div>
            </div>
          </div>
          <dl className="missionControlFacts">
            <div><dt>Directional context</dt><dd>{verified ? directionalBias : "Not inferred"}</dd></div>
            <div><dt>Trade permission</dt><dd>{verified ? tradePermission : "NO-TRADE"}</dd></div>
            <div><dt>Volatility regime</dt><dd>{verified ? volatilityRegime : "Unverified"}</dd></div>
            <div><dt>Principal risk</dt><dd>{verified ? keyRisk : "Provider validation"}</dd></div>
          </dl>
        </article>

        <article className="bullseyeRadarCard">
          <header><div><span>BULLSEYE RADAR™</span><h3>Session readiness</h3></div><b>{verified ? `${confidenceScore}%` : "SCAN"}</b></header>
          <div className="bullseyeRadarList">
            {radar.map((item) => <div key={item.label} className={`radarMetric is-${item.tone}`}>
              <div><span>{item.label}</span><strong>{verified ? item.score : "—"}</strong></div>
              <div className="radarTrack"><i style={{ width: `${verified ? item.score : 0}%` }} /></div>
            </div>)}
          </div>
        </article>

        <article className="marketWeatherCard">
          <header><span>MARKET WEATHER™</span><small>{verified ? riskRating : "UNRATED"}</small></header>
          <div className="marketWeatherVisual" aria-hidden="true"><b>{weather.icon}</b><i /><i /><i /></div>
          <h3>{weather.label}</h3>
          <p>{weather.copy}</p>
          <footer><span>Market regime</span><strong>{verified ? volatilityRegime : "Awaiting verification"}</strong></footer>
        </article>

        <article className="nashCopilotCard">
          <header><div><span>NASH AI COPILOT</span><h3>Ask the right question first</h3></div><b>AI</b></header>
          <div className="copilotAnswer">
            <span>WHAT MATTERS MOST NOW?</span>
            <p>{verified ? keyRisk : "Do not infer direction from incomplete data. Wait for the provider safety checks to clear."}</p>
          </div>
          <div className="copilotPrompts" aria-label="Suggested Copilot prompts">
            <span>Biggest risk?</span><span>Patient at the open?</span><span>What is AI watching?</span>
          </div>
          <footer>{verified ? "Copilot summary uses current deterministic engine outputs." : "Copilot remains fail-closed until evidence is verified."}</footer>
        </article>
      </div>
    </section>
  );
}
