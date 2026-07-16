
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "../../utils/supabase/server";
import { runBullseyeEngine } from "../lib/bullseye-engine";
import { formatMarketGatewayDataAge } from "../lib/live-market-gateway";
import { formatSnapshotAge, formatUkTimestamp } from "../lib/market-data";
import { createDashboardViewModel } from "./lib/dashboard-data";
import { getTerminalMarketData } from "./lib/terminal-market-data-provider";
import { terminalStatusMessage } from "./lib/terminal-state";
import { Panel } from "./components/Panel";
import { MetricChip } from "./components/MetricChip";
import { DecisionVerdict } from "./components/DecisionVerdict";
import { EliteTradeSetup } from "./components/EliteTradeSetup";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Mission Control | NASH AI Markets",
  description: "The NASH AI Markets Mission Control intelligence workspace.",
};

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

  const { snapshot, gatewayStatus } = await getTerminalMarketData();
  const bullseye = runBullseyeEngine(snapshot);
  const viewModel = createDashboardViewModel(snapshot, bullseye);
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
          <a href="#brief">AI Briefing</a>
          <a href="#futures">S&P 500 Futures</a>
          <a href="#calendar">Economic Calendar</a>
          <a href="#options">Options Overview</a>
        </nav>
        <div className="mcMemberCard">
          <span>MEMBER SERVICES</span><p>{user.email}</p><p>{membership.plan.toUpperCase()} MEMBER</p>
          <a href={portalUrl}>Manage subscription ↗</a><a href="/auth/signout">Sign out ↗</a>
        </div>
      </aside>

      <section className="mcMain" id="overview">
        <header className="mcHeader">
          <div>
            <span className="kicker">MISSION CONTROL™ V3</span>
            <h1>Good morning, trader.</h1>
            <p>{snapshot.source} · {isVerified ? `As of ${asOf} UK · ${snapshotAge}` : "No verified market update available"}</p>
          </div>
          <div className={`mcStatus status-${snapshot.status.toLowerCase()}`}>
            <span>DATA STATUS</span>
            <strong><i /> {snapshot.status}</strong>
          </div>
        </header>

        <div className="mcPreviewNotice" role={!isVerified ? "alert" : undefined}>
          <span>{terminalStatusMessage(snapshot.status, gatewayStatus.failureCount)}{!isVerified && " · SAFE FALLBACK ACTIVE"}</span>
          {!isVerified ? <a href="/terminal">Retry verified data ↗</a> : null}
        </div>

        <section className="mcKpiStrip" aria-label="Market snapshot">
          {viewModel.heroMetrics.map((metric) => (
            <MetricChip key={metric.label} label={metric.label} value={metric.value} delta={metric.delta} tone={metric.tone} />
          ))}
        </section>

        <section className="terminalDashboardGrid" aria-label="Dashboard sections">
          <Panel eyebrow="DATA PROVENANCE" title="Dashboard source status" subtitle="Fact vs analysis" className="panelProvenance" id="provenance" provenance={viewModel.provenance}>
            <p className="panelBody">The dashboard now records provenance metadata for each card so you can distinguish validated facts from AI-generated analysis at a glance.</p>
            <dl className="marketGatewayStatus" aria-label="Market gateway status">
              <div><dt>CONNECTION</dt><dd>{gatewayStatus.connectionStatus.replace("_", " ").toUpperCase()}</dd></div>
              <div><dt>PROVIDER</dt><dd>{gatewayStatus.providerName}</dd></div>
              <div><dt>LAST ATTEMPT</dt><dd>{gatewayStatus.lastAttempt ? formatUkTimestamp(gatewayStatus.lastAttempt) : "Not attempted"}</dd></div>
              <div><dt>LAST SUCCESS</dt><dd>{gatewayStatus.lastSuccessfulUpdate ? formatUkTimestamp(gatewayStatus.lastSuccessfulUpdate) : "None"}</dd></div>
              <div><dt>DATA AGE</dt><dd>{formatMarketGatewayDataAge(gatewayStatus.dataAgeMs)}</dd></div>
              <div><dt>FAILURES</dt><dd>{gatewayStatus.failureCount}</dd></div>
              <div><dt>FALLBACK</dt><dd>{gatewayStatus.fallbackActive ? "ACTIVE" : "INACTIVE"}</dd></div>
            </dl>
          </Panel>
          <Panel eyebrow="NASH AI DECISION ENGINE" title="Market verdict" subtitle="Synthesised recommendation" className="panelVerdict" id="verdict" provenance={viewModel.analysisProvenance}>
            <DecisionVerdict
              overallBias={viewModel.verdict.overallBias}
              confidenceScore={viewModel.verdict.confidenceScore}
              tradeRating={viewModel.verdict.tradeRating}
              riskLevel={viewModel.verdict.riskLevel}
              suggestedDirection={viewModel.verdict.suggestedDirection}
              entryZone={viewModel.verdict.entryZone}
              stopZone={viewModel.verdict.stopZone}
              profitTarget1={viewModel.verdict.profitTarget1}
              profitTarget2={viewModel.verdict.profitTarget2}
              noTradeWarning={viewModel.verdict.noTradeWarning}
            />
          </Panel>

          <Panel eyebrow="ELITE TRADE SETUP" title="Trade of the day" subtitle="Premium execution view" className="panelEliteTrade" id="elite-trade" provenance={viewModel.analysisProvenance}>
            <EliteTradeSetup
              title={viewModel.eliteTradeSetup.title}
              direction={viewModel.eliteTradeSetup.direction}
              conviction={viewModel.eliteTradeSetup.conviction}
              entryZone={viewModel.eliteTradeSetup.entryZone}
              stopLoss={viewModel.eliteTradeSetup.stopLoss}
              target1={viewModel.eliteTradeSetup.target1}
              target2={viewModel.eliteTradeSetup.target2}
              riskReward={viewModel.eliteTradeSetup.riskReward}
              timeframe={viewModel.eliteTradeSetup.timeframe}
              status={viewModel.eliteTradeSetup.status}
              explanation={viewModel.eliteTradeSetup.explanation}
            />
          </Panel>

          <Panel eyebrow="S&P 500 FUTURES" title="Futures snapshot" subtitle="ES / NQ / RTY" className="panelFutures" id="futures" provenance={viewModel.provenance}>
            <div className="futuresHero">
              <div>
                <span className="displayValue">{viewModel.futures.value}</span>
                <div className="futuresMeta">
                  <b>{viewModel.futures.change}</b>
                  <span>{viewModel.futures.status}</span>
                </div>
              </div>
              <div className="futuresBias">
                <span>BIAS</span>
                <strong>{viewModel.futures.bias}</strong>
              </div>
            </div>
            <p className="panelBody">{viewModel.futures.note}</p>
            <div className="supportResistanceList">
              {viewModel.futures.levels.map((level) => (
                <div className={`levelRow ${level.type}`} key={level.label}>
                  <span>{level.label}</span>
                  <strong>{level.value}</strong>
                  <small>{level.note}</small>
                </div>
              ))}
            </div>
          </Panel>

          <Panel eyebrow="AI MARKET BRIEFING" title="What matters now" subtitle="Modelled context" className="panelBrief" id="brief" provenance={viewModel.analysisProvenance}>
            <div className="briefingSummary">
              <div className="briefingScore">
                <strong>{viewModel.briefing.score}</strong>
                <span>{viewModel.briefing.confidence}% confidence</span>
              </div>
              <p>{viewModel.briefing.summary}</p>
            </div>
            <div className="briefingList">
              {viewModel.briefing.bullets.map((bullet) => (
                <div key={bullet.title}>
                  <h3>{bullet.title}</h3>
                  <p>{bullet.body}</p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel eyebrow="PRE-MARKET BRIEF" title="Opening setup" subtitle="Session prep" className="panelBriefing" provenance={viewModel.analysisProvenance}>
            <div className="briefTextBlock">
              <h3>{viewModel.preMarketBrief.title}</h3>
              <p>{viewModel.preMarketBrief.body}</p>
            </div>
          </Panel>

          <Panel eyebrow="AFTER-HOURS BRIEF" title="Post-close posture" subtitle="Nightly read" className="panelBriefing" provenance={viewModel.analysisProvenance}>
            <div className="briefTextBlock">
              <h3>{viewModel.afterHoursBrief.title}</h3>
              <p>{viewModel.afterHoursBrief.body}</p>
            </div>
          </Panel>

          <Panel eyebrow="TODAY'S ECONOMIC EVENTS" title="Catalysts to watch" subtitle="Global agenda" className="panelCalendarCompact" provenance={viewModel.provenance}>
            <div className="calendarList">
              {viewModel.economicEvents.map((event) => (
                <div className="calendarRow" key={`${event.time}-${event.name}`}>
                  <div>
                    <strong>{event.time}</strong>
                    <p>{event.name}</p>
                  </div>
                  <b className={event.risk === "HIGH" ? "high" : "medium"}>{event.risk}</b>
                </div>
              ))}
            </div>
          </Panel>

          <Panel eyebrow="MARKET MOVERS" title="Leadership & laggards" subtitle="Cross-market flow" className="panelMovers" provenance={viewModel.provenance}>
            <div className="miniList">
              {viewModel.movers.map((mover) => (
                <div key={mover.name} className="miniRow">
                  <span>{mover.name}</span>
                  <strong>{mover.value}</strong>
                  <b>{mover.change}</b>
                </div>
              ))}
            </div>
          </Panel>

          <Panel eyebrow="TOP AI HEADLINES" title="What the desk is tracking" subtitle="Signal focus" className="panelHeadlines" provenance={viewModel.provenance}>
            <div className="headlineList">
              {viewModel.headlines.map((headline) => (
                <div key={headline.title}>
                  <h3>{headline.title}</h3>
                  <p>{headline.detail}</p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel eyebrow="MARKET SENTIMENT" title="Risk appetite" subtitle="Composite signal" className="panelSentiment" provenance={viewModel.analysisProvenance}>
            <div className="sentimentHero">
              <strong>{viewModel.sentiment.score}</strong>
              <span>{viewModel.sentiment.label}</span>
            </div>
            <p className="panelBody">{viewModel.sentiment.detail}</p>
          </Panel>

          <Panel eyebrow="RISK RATING" title="Session risk" subtitle="1–10" className="panelRisk" provenance={viewModel.analysisProvenance}>
            <div className="riskHero">
              <strong>{viewModel.riskRating}</strong>
              <span>/ 10</span>
            </div>
            <p className="panelBody">{viewModel.riskRating >= 7 ? "Risk is elevated and execution discipline matters." : viewModel.riskRating >= 4 ? "Balanced risk, with clear decision points." : "Risk is relatively contained."}</p>
          </Panel>

          <Panel eyebrow="PROBABILITIES" title="Bullish / neutral / bearish" subtitle="Session outlook" className="panelProbabilities" provenance={viewModel.analysisProvenance}>
            <div className="probabilityGrid">
              <div><span>BULLISH</span><strong>{viewModel.probabilities.bullish}%</strong></div>
              <div><span>NEUTRAL</span><strong>{viewModel.probabilities.neutral}%</strong></div>
              <div><span>BEARISH</span><strong>{viewModel.probabilities.bearish}%</strong></div>
            </div>
          </Panel>

          <Panel eyebrow="EXPECTED MOVE" title="Today's S&P 500 session" subtitle="Estimated range" className="panelExpectedMove" provenance={viewModel.analysisProvenance}>
            <div className="expectedMoveHero">
              <strong>{viewModel.expectedMove}</strong>
              <span>Expected move</span>
            </div>
          </Panel>

          <Panel eyebrow="RECOMMENDED FUTURES BIAS" title="Directional posture" subtitle="ES futures" className="panelBias" provenance={viewModel.analysisProvenance}>
            <div className="biasHero">
              <strong>{viewModel.futuresBias}</strong>
            </div>
          </Panel>

          <Panel eyebrow="RECOMMENDED OPTIONS BIAS" title="Preferred structure" subtitle="Risk-managed" className="panelOptionsBias" provenance={viewModel.analysisProvenance}>
            <div className="biasHero">
              <strong>{viewModel.optionsBias}</strong>
            </div>
          </Panel>

          <Panel eyebrow="KEY LEVELS" title="Support & resistance" subtitle="ES FUTURES" className="panelLevels" provenance={viewModel.provenance}>
            <div className="supportResistanceList">
              {viewModel.supportResistance.map((level) => (
                <div className={`levelRow ${level.type}`} key={level.label}>
                  <span>{level.label}</span>
                  <strong>{level.value}</strong>
                  <small>{level.note}</small>
                </div>
              ))}
            </div>
          </Panel>

          <Panel eyebrow="VIX" title="Volatility pulse" subtitle="Risk barometer" className="panelVix" provenance={viewModel.provenance}>
            <div className="statHero">
              <span className="displayValue">{viewModel.vix.value}</span>
              <b>{viewModel.vix.change}</b>
            </div>
            <p className="panelBody">{viewModel.vix.note}</p>
          </Panel>

          <Panel eyebrow="TREASURY YIELDS" title="Rates backdrop" subtitle="Macro context" className="panelTreasuries" provenance={viewModel.provenance}>
            <div className="miniList">
              {viewModel.treasuries.map((treasury) => (
                <div key={treasury.label} className="miniRow">
                  <span>{treasury.label}</span>
                  <strong>{treasury.value}</strong>
                  <b>{treasury.delta}</b>
                </div>
              ))}
            </div>
          </Panel>

          <Panel eyebrow="US DOLLAR INDEX" title="FX pressure" subtitle="Cross-asset lens" className="panelDollar" provenance={viewModel.provenance}>
            <div className="statHero">
              <span className="displayValue">{viewModel.dollar.value}</span>
              <b>{viewModel.dollar.change}</b>
            </div>
            <p className="panelBody">{viewModel.dollar.note}</p>
          </Panel>

          <Panel eyebrow="ECONOMIC CALENDAR" title="Next risk windows" subtitle="UK TIME" className="panelCalendar" id="calendar" provenance={viewModel.provenance}>
            <div className="calendarList">
              {viewModel.calendar.map((event) => (
                <div className="calendarRow" key={`${event.time}-${event.name}`}>
                  <div>
                    <strong>{event.time}</strong>
                    <p>{event.name}</p>
                  </div>
                  <b className={event.risk === "HIGH" ? "high" : "medium"}>{event.risk}</b>
                </div>
              ))}
            </div>
          </Panel>

          <Panel eyebrow="FEAR & GREED" title="Sentiment read" subtitle="Composite signal" className="panelFearGreed" provenance={viewModel.analysisProvenance}>
            <div className="sentimentHero">
              <strong>{viewModel.fearGreed.score}</strong>
              <span>{viewModel.fearGreed.label}</span>
            </div>
            <p className="panelBody">{viewModel.fearGreed.detail}</p>
          </Panel>

          <Panel eyebrow="OPTIONS OVERVIEW" title="Risk & positioning" subtitle="Premiums" className="panelOptions" id="options" provenance={viewModel.analysisProvenance}>
            <div className="optionsGrid">
              <div>
                <span>PUT/CALL</span>
                <strong>{viewModel.options.putCall}</strong>
              </div>
              <div>
                <span>IV</span>
                <strong>{viewModel.options.iv}</strong>
              </div>
              <div>
                <span>SKEW</span>
                <strong>{viewModel.options.skew}</strong>
              </div>
            </div>
            <p className="panelBody">{viewModel.options.detail}</p>
          </Panel>
        </section>

        <footer className="mcFooter">Educational market commentary only. Futures and options involve substantial risk. Model probabilities are decision-support estimates, not predictions. Verify the displayed status, timestamp, source and levels independently.<Link href="/">Back to NASH AI Markets</Link></footer>
      </section>
    </main>
  );
}
