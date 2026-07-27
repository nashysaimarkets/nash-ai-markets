import { TradePlanChecklist } from "./TradePlanChecklist.tsx";

type Props = {
  nextEvent: { name: string; risk: string; when: string; countdown?: string } | null;
  events: Array<{ time: string; name: string; risk: string }>;
  noTrade: string[];
  reviewTrigger: string;
  decisionReady: boolean;
};

function pretty(value: string) {
  return value.replaceAll("_", " ").replaceAll("-", " ");
}

export function DashboardReviewPanel(props: Props) {
  return <section className="dashSection dashReview" aria-labelledby="dash-review-title">
    <header className="dashSectionHeader">
      <div>
        <span className="eliteEyebrow">EVENTS AND REVIEW</span>
        <h2 id="dash-review-title">Events, review conditions and checklist</h2>
        <p>Use this section after the market plan — not as a second stand-aside lecture.</p>
      </div>
    </header>

    <div className="dashReviewGrid">
      <article>
        <h3>Next verified event</h3>
        {props.nextEvent ? <>
          <strong>{props.nextEvent.name}</strong>
          <p>{props.nextEvent.when} UK · {props.nextEvent.risk} impact{props.nextEvent.countdown ? ` · ${props.nextEvent.countdown}` : ""}</p>
        </> : <p>No verified economic calendar event is available from the provider. Nothing is invented.</p>}
        {props.events.length > 1 ? <ul>{props.events.slice(0, 4).map((event) => <li key={`${event.time}-${event.name}`}><time>{event.time}</time> {event.name} <span>{event.risk}</span></li>)}</ul> : null}
      </article>
      <article>
        <h3>Review conditions</h3>
        <p>{props.reviewTrigger}</p>
        {props.noTrade.length ? <ul>{props.noTrade.slice(0, 3).map((item) => <li key={item}>{pretty(item)}</li>)}</ul> : <p>{props.decisionReady ? "No additional no-trade codes." : "Stand aside while data quality recovers."}</p>}
      </article>
    </div>

    <TradePlanChecklist />
  </section>;
}
