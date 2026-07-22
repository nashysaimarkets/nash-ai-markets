import type { MarketQuote } from "../../lib/market-data.ts";
import { formatScoreDisplay, formatConfidenceLabel, scoreIsDisplayable } from "../lib/score-display.ts";

type QuoteStrip = { label: string; value: string; change: string };
type Props = {
  name: string;
  posture: string;
  explanation: string;
  reviewTrigger: string;
  dataLabel: string;
  dataDetail: string;
  dataAge: string;
  lastVerified: string;
  sessionLabel: string;
  sessionDetail: string;
  quotes: QuoteStrip[];
  nextEvent: { name: string; risk: string; when: string } | null;
  riskRating: string | null;
  bullseyeScore: number | null;
  decisionReady: boolean;
  terminalHref: string;
  briefHref: string;
};

export function DashboardMarketStatus(props: Props) {
  return <section className="dashSection dashStatus" aria-labelledby="dash-status-title">
    <header className="dashSectionHeader">
      <div>
        <span className="eliteEyebrow">DASHBOARD</span>
        <h1 id="dash-status-title">Market status</h1>
        <p>Good session, {props.name}. One data-health strip and one posture — not repeated safety cards.</p>
      </div>
      <div className="dashQuickLinks">
        <a href={props.terminalHref}>Open terminal</a>
        <a href={props.briefHref}>Market brief</a>
        <a href="/profile">Account</a>
      </div>
    </header>

    <div className={`dashHealthStrip is-${props.dataLabel.toLowerCase().replaceAll(" ", "-")}`} role="status">
      <strong>{props.dataLabel}</strong>
      <span>{props.dataDetail}</span>
      <small>{props.lastVerified} · {props.dataAge} · {props.sessionLabel}</small>
    </div>

    <article className="dashPostureCard" aria-labelledby="dash-posture-title">
      <div>
        <span>Current posture</span>
        <h2 id="dash-posture-title">{props.posture}</h2>
        <p>{props.explanation}</p>
        <p className="dashReviewTrigger"><strong>Review trigger</strong> {props.reviewTrigger}</p>
      </div>
      <dl>
        <div><dt>Bullseye Score</dt><dd>{formatScoreDisplay(props.bullseyeScore, props.decisionReady && scoreIsDisplayable(props.bullseyeScore, props.decisionReady))}<small>{formatConfidenceLabel(props.decisionReady)}</small></dd></div>
        <div><dt>Risk rating</dt><dd>{props.riskRating ?? "Not rated"}<small>{props.riskRating ? "Derived from verified inputs" : "Withheld without sufficient verified evidence"}</small></dd></div>
        <div><dt>Session</dt><dd>{props.sessionLabel}<small>{props.sessionDetail}</small></dd></div>
        <div><dt>Next event</dt><dd>{props.nextEvent ? props.nextEvent.name : "No verified schedule"}<small>{props.nextEvent ? `${props.nextEvent.when} · ${props.nextEvent.risk} impact` : "Events appear only from the provider calendar"}</small></dd></div>
      </dl>
    </article>

    <div className="dashQuoteStrip" aria-label="Verified cross-market readings">
      {props.quotes.map((item) => <article key={item.label}><span>{item.label}</span><strong>{item.value}</strong><small>{item.change}</small></article>)}
    </div>
  </section>;
}

export function quoteStripFromSnapshot(quotes: MarketQuote[], stats: { latest: number; percentageChange: number } | null, esChange?: string | null): Array<{ label: string; value: string; change: string }> {
  const find = (symbol: string) => quotes.find((item) => item.symbol === symbol);
  const price = (value: number | null | undefined) => value == null ? "Unavailable" : value.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const vix = find("VIX"); const two = find("US2Y"); const ten = find("US10Y"); const dxy = find("DXY"); const es = find("ES");
  return [
    { label: "ES reference", value: stats ? price(stats.latest) : (es?.value ?? "Unavailable"), change: stats ? `${stats.percentageChange >= 0 ? "+" : ""}${stats.percentageChange.toFixed(2)}% / 24h` : (esChange ?? es?.change ?? "Change unavailable") },
    { label: "VIX", value: vix?.value ?? "Unavailable", change: vix?.change ?? "No verified reading" },
    { label: "US 2-year", value: two?.value ?? "Unavailable", change: two?.change ?? "No verified reading" },
    { label: "US 10-year", value: ten?.value ?? "Unavailable", change: ten?.change ?? "No verified reading" },
    { label: "DXY", value: dxy?.value ?? "Unavailable", change: dxy?.change ?? "No verified reading" },
  ];
}
