import Link from "next/link";
import type { MarketLevel, MarketDataStatus } from "../../lib/market-data.ts";

type Props = { verified: boolean; dataStatus: MarketDataStatus; stateLabel: string; confidence: number | null; bias: string; risk: string; expectedMove: string; support: MarketLevel | null; resistance: MarketLevel | null; bullishTrigger: string; bearishTrigger: string; invalidation: string; noTradeConditions: string[]; summary: string };
const pretty = (value: string) => value.replaceAll("_", " ").replaceAll("-", " ").toLowerCase();

export function TodaysBullseyePlan(props: Props) {
  const unavailable = "Awaiting verified input";
  return <section className={`todaysBullseyePlan ${props.verified ? "isVerified" : "isFailClosed"}`} aria-labelledby="todays-plan-title">
    <header><div><span className="eliteEyebrow">OBSERVED + DERIVED INTELLIGENCE</span><h2 id="todays-plan-title">Today&apos;s BULLSEYE Plan</h2><p>{props.verified ? props.summary : "The research workflow remains available, but directional output stays withheld until current inputs verify."}</p></div><div className="planState"><small>{props.verified ? "CONDITIONAL POSTURE" : "SAFETY POSTURE"}</small><strong>{props.verified ? props.bias : "STAND ASIDE"}</strong><span>{props.stateLabel} · {props.dataStatus}</span></div></header>
    <div className="planDecisionStrip"><div><span>Derived bias</span><strong>{props.verified ? pretty(props.bias) : "Not inferred"}</strong></div><div><span>Engine confidence</span><strong>{props.verified && props.confidence !== null ? `${props.confidence}/100` : unavailable}</strong></div><div><span>Current risk</span><strong>{props.verified ? pretty(props.risk) : "Unrated"}</strong></div><div><span>Expected move</span><strong>{props.expectedMove}</strong></div></div>
    <div className="planEvidenceGrid">
      <article><span>OBSERVED LEVELS <b>PROVIDER</b></span><dl><div><dt>Key resistance</dt><dd>{props.verified && props.resistance ? props.resistance.value : unavailable}</dd></div><div><dt>Key support</dt><dd>{props.verified && props.support ? props.support.value : unavailable}</dd></div></dl><small>Levels appear only when supplied by the verified snapshot.</small></article>
      <article><span>DERIVED SCENARIOS <b>ENGINE</b></span><dl><div><dt>Bullish confirmation</dt><dd>{props.verified ? props.bullishTrigger : unavailable}</dd></div><div><dt>Bearish confirmation</dt><dd>{props.verified ? props.bearishTrigger : unavailable}</dd></div><div><dt>Invalidation condition</dt><dd>{props.verified ? props.invalidation : unavailable}</dd></div></dl></article>
      <article className="planRiskPanel"><span>NO-TRADE CONDITIONS</span>{props.noTradeConditions.length ? <ul>{props.noTradeConditions.slice(0, 4).map((reason) => <li key={reason}>{pretty(reason)}</li>)}</ul> : <p>{props.verified ? "No critical engine no-trade condition is currently active." : "Current data must verify before any scenario can become active."}</p>}<Link href="/terminal">Open full decision evidence →</Link></article>
    </div>
  </section>;
}
