import type { MarketEvent } from "../../lib/market-data.ts";
import type { ScoreDriver } from "../../lib/market-intelligence-engine.ts";

type Props = {
  verified: boolean;
  events: MarketEvent[];
  riskDrivers: ScoreDriver[];
  keyRisk: string;
  noTradeConditions: string[];
};

const label = (value: string) => value.replaceAll("_", " ").replaceAll("-", " ").toLowerCase();

function driverContext(driver: ScoreDriver) {
  if (driver.normalizedScore >= 56) return "Supportive";
  if (driver.normalizedScore <= 44) return "Restrictive";
  return "Balanced";
}

export function MarketCatalystBriefing({ verified, events, riskDrivers, keyRisk, noTradeConditions }: Props) {
  const availableDrivers = riskDrivers.filter((driver) => driver.rawValue !== null).slice(0, 3);
  const scheduledEvents = events.slice(0, 3);

  return <section className={`marketCatalystBriefing ${verified ? "isVerified" : "isUnavailable"}`} aria-labelledby="catalyst-briefing-title">
    <header>
      <div><span className="eliteEyebrow">CATALYSTS + RISK CONTROL</span><h2 id="catalyst-briefing-title">What could change the plan</h2><p>Verified scheduled events and deterministic risk inputs, presented as review conditions rather than predictions.</p></div>
      <span className="catalystVerification"><i aria-hidden="true" />{verified ? "Verified inputs" : "Verification pending"}</span>
    </header>
    {verified ? <div className="catalystBriefingGrid">
      <article>
        <span>SCHEDULED CATALYSTS</span>
        {scheduledEvents.length ? <ol>{scheduledEvents.map((event) => <li key={`${event.time}-${event.name}`}><time>{event.time}</time><div><strong>{event.name}</strong><small>{event.risk === "HIGH" ? "High-impact review window" : "Medium-impact review window"}</small></div><b>{event.risk}</b></li>)}</ol> : <div className="catalystEmpty"><strong>No verified events supplied</strong><p>Keep the session plan visible and recheck the provider calendar before participation.</p></div>}
      </article>
      <article>
        <span>DETERMINISTIC RISK DRIVERS</span>
        {availableDrivers.length ? <dl>{availableDrivers.map((driver) => <div key={driver.factor}><dt>{label(driver.factor)}</dt><dd><strong>{driverContext(driver)}</strong><span aria-label={`${driver.normalizedScore} out of 100`}><i style={{ width: `${driver.normalizedScore}%` }} /></span><small>{driver.normalizedScore}/100 derived score</small></dd></div>)}</dl> : <div className="catalystEmpty"><strong>Risk drivers unavailable</strong><p>No score is shown until the underlying provider observations verify.</p></div>}
      </article>
      <article className="catalystGuardrail">
        <span>PLAN GUARDRAILS</span>
        <strong>{keyRisk}</strong>
        {noTradeConditions.length ? <ul>{noTradeConditions.slice(0, 3).map((condition) => <li key={condition}>{label(condition)}</li>)}</ul> : <p>No critical no-trade condition is currently active. Continue to require scenario confirmation and invalidation discipline.</p>}
      </article>
    </div> : <div className="catalystUnavailable" role="status"><span aria-hidden="true">⌁</span><div><strong>Plan-change signals remain withheld</strong><p>Events, driver scores and guardrails will resolve after the provider snapshot passes freshness and completeness checks.</p></div></div>}
  </section>;
}
