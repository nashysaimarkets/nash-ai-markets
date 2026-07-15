
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "../../utils/supabase/server";
import { runBullseyeEngine } from "../lib/bullseye-engine";
import { formatSnapshotAge, formatUkTimestamp, getMarketSnapshot } from "../lib/market-data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Mission Control | NASH AI Markets",
  description: "The NASH AI Markets Mission Control intelligence workspace.",
};

function statusMessage(status: string): string {
  if (status === "LIVE") return "VERIFIED LIVE DATA";
  if (status === "DELAYED") return "VERIFIED DELAYED DATA";
  if (status === "UNAVAILABLE") return "LIVE FEED UNAVAILABLE — SAFE FALLBACK ACTIVE";
  return "PREVIEW DATA — FORMAT DEMONSTRATION ONLY";
}

export default async function Terminal() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  if (!user.email) redirect("/?membership=required#membership");

  const { data: membership } = await supabase
    .from("memberships")
    .select("plan, status, current_period_end")
    .ilike("email", user.email)
    .in("status", ["active", "trialing"])
    .in("plan", ["pro", "elite"])
    .maybeSingle();

  if (!membership) redirect("/?membership=required#membership");

  const snapshot = await getMarketSnapshot();
  const bullseye = runBullseyeEngine(snapshot);
  const asOf = formatUkTimestamp(snapshot.asOf);
  const snapshotAge = formatSnapshotAge(snapshot.asOf);
  const isVerified = snapshot.status === "LIVE" || snapshot.status === "DELAYED";
  const portalUrl = process.env.STRIPE_CUSTOMER_PORTAL_LINK ||
    "mailto:hello@nashaimarkets.com?subject=Manage%20my%20subscription";

  return (
    <main className="missionControl">
      <aside className="mcSidebar">
        <Link href="/" className="brand"><span className="mark"><i /></span><span>NASH <b>AI</b></span></Link>
        <nav aria-label="Member navigation">
          <a className="active" href="#overview">Mission Control</a>
          <a href="#brief">Mission Brief</a>
          <a href="#levels">Market Map</a>
          <a href="#scenarios">Probability Engine</a>
          <a href="#calendar">Economic Clock</a>
        </nav>
        <div className="mcMemberCard">
          <span>MEMBER SERVICES</span><p>{user.email}</p><p>{membership.plan.toUpperCase()} MEMBER</p>
          <a href={portalUrl}>Manage subscription ↗</a><a href="/auth/signout">Sign out ↗</a>
        </div>
      </aside>

      <section className="mcMain" id="overview">
        <header className="mcHeader">
          <div><span className="kicker">MISSION CONTROL™ V3</span><h1>Good morning, trader.</h1>
            <p>{snapshot.source} · As of {asOf} UK · {snapshotAge}</p></div>
          <div className={`mcStatus status-${snapshot.status.toLowerCase()}`}><span>DATA STATUS</span><strong><i /> {snapshot.status}</strong></div>
        </header>

        <div className="mcPreviewNotice">{statusMessage(snapshot.status)}{!isVerified && " · NOT CURRENT MARKET DATA OR A TRADING SIGNAL"}</div>

        <section className="mcKpiStrip" aria-label="Market snapshot">
          {snapshot.quotes.map((quote) => <article key={quote.symbol}><span>{quote.label}</span><strong>{quote.value}</strong><b className={quote.direction}>{quote.change}</b></article>)}
        </section>

        <section className="mcHeroGrid">
          <article className="mcPanel weatherPanel">
            <div className="mcPanelHead"><div><span>MARKET WEATHER™</span><h2>{bullseye.weather}</h2></div>
              <div className="weatherIcon" aria-hidden="true">{bullseye.weather === "STORMY" ? "⚡" : bullseye.weather === "CLEAR" ? "☀" : "◐"}</div></div>
            <p className="weatherForecast">{snapshot.summary}</p>
            <div className="weatherRows"><div><span>WORKING BIAS</span><strong>{bullseye.bias}</strong></div><div><span>SESSION RISK</span><strong>{bullseye.risk}</strong></div><div><span>CONFIDENCE</span><strong>{bullseye.confidence}%</strong></div><div><span>DATA STATE</span><strong>{snapshot.status}</strong></div></div>
          </article>

          <article className="mcPanel scorePanel">
            <div className="mcPanelHead"><div><span>BULLSEYE SCORE™</span><h2>Evidence alignment</h2></div><strong className="scoreValue">{bullseye.score}</strong></div>
            <div className="confidenceLine"><span>DECISION CONFIDENCE</span><b>{bullseye.confidence}%</b></div>
            <div className="scoreComponents">{Object.entries(snapshot.evidence).map(([label, score]) => <div key={label}><span>{label}</span><i><em style={{ width: `${score}%` }} /></i><b>{score}</b></div>)}</div>
          </article>

          <article className="mcPanel dnaPanel">
            <div className="mcPanelHead"><div><span>MARKET DNA™</span><h2>Current regime</h2></div><small>{bullseye.risk} RISK</small></div>
            <ul>{bullseye.dna.map((item) => <li key={item}>{item}</li>)}</ul><div className="dnaTag">{bullseye.dna.join(" · ")}</div>
          </article>
        </section>

        <section className="mcPanel missionBrief" id="brief">
          <div className="mcPanelHead"><div><span>AI MISSION BRIEF</span><h2>What matters today</h2></div><small>VERIFY BEFORE ACTING</small></div>
          <p>{bullseye.missionBrief}</p>
          <div className="briefActions">
            <div><span>RISK-WINDOW PREP</span><strong>{bullseye.riskWindowPrep}</strong></div>
            <div><span>DEFINED-RISK APPROACH</span><strong>{bullseye.optionsApproach}</strong></div>
            <div><span>STAND ASIDE IF</span><strong>{bullseye.standAside}</strong></div>
          </div>
        </section>

        <div className="mcTwoColumn">
          <section className="mcPanel" id="levels">
            <div className="mcPanelHead"><div><span>MARKET MAP</span><h2>Key levels</h2></div><small>ES FUTURES</small></div>
            {snapshot.levels.map((level) => <div className={`mcLevel ${level.type}`} key={level.label}><span>{level.label}</span><strong>{level.value}</strong><p>{level.note}</p></div>)}
          </section>
          <section className="mcPanel economicClock" id="calendar">
            <div className="mcPanelHead"><div><span>ECONOMIC CLOCK™</span><h2>Next risk windows</h2></div><small>UK TIME</small></div>
            {snapshot.events.map((event) => <div className="clockEvent" key={`${event.time}-${event.name}`}><div><strong>{event.time}</strong><span>CHECK CALENDAR</span></div><p>{event.name}</p><b className={event.risk === "HIGH" ? "high" : "medium"}>{event.risk}</b></div>)}
          </section>
        </div>

        <section className="mcPanel scenariosPanel" id="scenarios">
          <div className="mcPanelHead"><div><span>PROBABILITY ENGINE™</span><h2>Triggers and invalidations</h2></div><small>MODELLED · NOT CERTAINTY</small></div>
          <div className="probabilityBar" aria-label="Scenario probabilities"><i style={{ width: `${bullseye.bullProbability}%` }} /><b style={{ width: `${bullseye.bearProbability}%` }} /><em style={{ width: `${bullseye.noTradeProbability}%` }} /></div>
          <div className="scenarioCards">
            <article className="bull"><b>BULL CASE · {bullseye.bullProbability}%</b><h3>{bullseye.bullTrigger}</h3><p>Invalidation: {bullseye.bullInvalidation}.</p></article>
            <article className="bear"><b>BEAR CASE · {bullseye.bearProbability}%</b><h3>{bullseye.bearTrigger}</h3><p>Invalidation: {bullseye.bearInvalidation}.</p></article>
            <article className="wait"><b>NO-TRADE · {bullseye.noTradeProbability}%</b><h3>Range and whipsaw</h3><p>{bullseye.standAside}</p></article>
          </div>
        </section>

        <footer className="mcFooter">Educational market commentary only. Futures and options involve substantial risk. Model probabilities are decision-support estimates, not predictions. Verify the displayed status, timestamp, source and levels independently.<Link href="/">Back to NASH AI Markets</Link></footer>
      </section>
    </main>
  );
}
