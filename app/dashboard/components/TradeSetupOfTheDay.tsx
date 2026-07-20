import type { MarketBias, RiskRating } from "../../lib/trading-decision-engine.ts";
import type { DirectionalPosture, ExecutionReadiness, PreferredSetupType } from "../../lib/structured-trade-planner.ts";

type Props = { verified: boolean; bias: MarketBias; posture: DirectionalPosture; setupType: PreferredSetupType; readiness: ExecutionReadiness; confirmation: string; invalidation: string; firstTarget: string; secondTarget: string; risk: RiskRating; confidence: number; noTradeConditions: string[]; asOf: string };
const words = (value: string) => value.replaceAll("_", " ").replaceAll("-", " ").toLowerCase();

export function TradeSetupOfTheDay(props: Props) {
  const valid = props.verified && props.readiness !== "not-ready" && props.posture !== "stand-aside" && props.setupType !== "none";
  return <section className={`tradeSetupOfDay ${valid ? "isConditional" : "isNoSetup"}`} aria-labelledby="trade-setup-title">
    <header><div><span className="eliteEyebrow">EDUCATIONAL SCENARIO PLANNING</span><h2 id="trade-setup-title">Trade Setup of the Day</h2><p>{valid ? "A conditional framework built from verified evidence—not an instruction or guarantee." : "No valid setup is published while evidence, levels or risk conditions remain incomplete."}</p></div><strong>{valid ? "CONDITIONAL" : "NO VALID SETUP"}</strong></header>
    <div className="tradeSetupGrid">
      <article><span>Market context</span><strong>{valid ? `${words(props.bias)} bias · ${words(props.setupType)}` : "Stand aside"}</strong><p>{valid ? `${words(props.posture)} posture with ${words(props.risk)} risk.` : "Wait for a verified decision state and defined market structure."}</p></article>
      <dl><div><dt>Preferred entry zone</dt><dd>{valid ? props.confirmation : "Unavailable"}</dd></div><div><dt>Confirmation required</dt><dd>{valid ? props.confirmation : "Verified current data and structure"}</dd></div><div><dt>Invalidation</dt><dd>{valid ? props.invalidation : "Any unverified or stale input"}</dd></div><div><dt>First objective</dt><dd>{valid ? props.firstTarget : "Not justified"}</dd></div><div><dt>Second objective</dt><dd>{valid ? props.secondTarget : "Not justified"}</dd></div><div><dt>Confidence</dt><dd>{valid ? `${props.confidence}/100` : "Withheld"}</dd></div></dl>
      <aside><span>Risk notes + no-trade gate</span>{props.noTradeConditions.length ? <ul>{props.noTradeConditions.slice(0, 4).map((condition) => <li key={condition}>{words(condition)}</li>)}</ul> : <p>Require confirmation, defined invalidation and acceptable risk/reward before participation.</p>}<time dateTime={props.asOf}>Evidence timestamp: {props.asOf}</time></aside>
    </div>
  </section>;
}
