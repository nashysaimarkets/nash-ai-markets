import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "../../utils/supabase/server";

export const metadata: Metadata = {
  title: "Mission Control | NASH AI Markets",
  description: "The NASH AI Markets Mission Control pre-market intelligence workspace.",
};

type ScoreComponent = { label: string; score: number };
type MarketEvent = { time: string; name: string; risk: "HIGH" | "MED"; countdown: string };

const events: MarketEvent[] = [
  { time: "13:30 UK", name: "US inflation data", risk: "HIGH", countdown: "01:24:18" },
  { time: "14:30 UK", name: "US cash session opens", risk: "HIGH", countdown: "02:24:18" },
  { time: "19:00 UK", name: "Federal Reserve speaker", risk: "MED", countdown: "06:54:18" },
];

const weatherDetails = [
  ["PRESSURE", "Bullish and rising"],
  ["WIND", "Moderate buying"],
  ["VISIBILITY", "Good"],
  ["STORM RISK", "Elevated after 13:30"],
] as const;

const scoreComponents: ScoreComponent[] = [
  { label: "Trend", score: 88 },
  { label: "Momentum", score: 82 },
  { label: "Liquidity", score: 76 },
  { label: "Breadth", score: 79 },
  { label: "Volatility", score: 68 },
  { label: "Macro", score: 61 },
];

const keyLevels = [
  ["R2", "6,350", "Momentum breakout", "resistance"],
  ["R1", "6,332", "First resistance", "resistance"],
  ["PV", "6,310", "Daily pivot", "pivot"],
  ["S1", "6,288", "First support", "support"],
  ["S2", "6,264", "Overnight range low", "support"],
] as const;

export default async function Terminal() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  if (!user.email) {
    redirect("/?membership=required#membership");
  }

  const { data: membership } = await supabase
    .from("memberships")
    .select("plan, status, current_period_end")
    .ilike("email", user.email)
    .in("status", ["active", "trialing"])
    .in("plan", ["pro", "elite"])
    .maybeSingle();

  if (!membership) {
    redirect("/?membership=required#membership");
  }

  const portalUrl =
    process.env.STRIPE_CUSTOMER_PORTAL_LINK ||
    "mailto:hello@nashaimarkets.com?subject=Manage%20my%20subscription";

  return (
    <main className="missionControl">
      <aside className="mcSidebar">
        <Link href="/" className="brand">
          <span className="mark"><i /></span>
          <span>NASH <b>AI</b></span>
        </Link>

        <nav aria-label="Member navigation">
          <a className="active" href="#overview">Mission Control</a>
          <a href="#brief">Morning Brief</a>
          <a href="#levels">Key Levels</a>
          <a href="#scenarios">Scenarios</a>
          <a href="#calendar">Economic Clock</a>
        </nav>

        <div className="mcMemberCard">
          <span>MEMBER SERVICES</span>
          <p>{user.email}</p>
          <a href={portalUrl}>Manage subscription ↗</a>
          <a href="/auth/signout">Sign out ↗</a>
        </div>
      </aside>

      <section className="mcMain" id="overview">
        <header className="mcHeader">
          <div>
            <span className="kicker">MISSION CONTROL™</span>
            <h1>Good morning, trader.</h1>
            <p>Pre-market intelligence · Illustrative preview</p>
          </div>
          <div className="mcStatus">
            <span>SESSION STATUS</span>
            <strong><i /> PREPARATION WINDOW</strong>
          </div>
        </header>

        <div className="mcPreviewNotice">
          PREVIEW DATA — FORMAT DEMONSTRATION ONLY, NOT LIVE MARKET DATA OR A TRADING SIGNAL
        </div>

        <section className="mcHeroGrid">
          <article className="mcPanel weatherPanel">
            <div className="mcPanelHead">
              <div><span>TODAY&apos;S MARKET WEATHER™</span><h2>Mostly sunny</h2></div>
              <div className="weatherIcon" aria-hidden="true">☀</div>
            </div>
            <p className="weatherForecast">
              Constructive conditions favour trend continuation while the daily pivot holds, with storm risk increasing around scheduled US data.
            </p>
            <div className="weatherRows">
              {weatherDetails.map(([label, value]) => (
                <div key={label}><span>{label}</span><strong>{value}</strong></div>
              ))}
            </div>
          </article>

          <article className="mcPanel scorePanel">
            <div className="mcPanelHead">
              <div><span>BULLSEYE SCORE™</span><h2>Evidence alignment</h2></div>
              <strong className="scoreValue">82</strong>
            </div>
            <div className="confidenceLine"><span>DECISION CONFIDENCE</span><b>HIGH · 84%</b></div>
            <div className="scoreComponents">
              {scoreComponents.map(({ label, score }) => (
                <div key={label}>
                  <span>{label}</span>
                  <i><em style={{ width: `${score}%` }} /></i>
                  <b>{score}</b>
                </div>
              ))}
            </div>
          </article>

          <article className="mcPanel dnaPanel">
            <div className="mcPanelHead">
              <div><span>MARKET DNA™</span><h2>Breakout watch</h2></div>
              <small>MODERATE CONVICTION</small>
            </div>
            <ul>
              <li>Constructive overnight structure</li>
              <li>Healthy but not exceptional participation</li>
              <li>Event risk may interrupt trend conditions</li>
              <li>Confirmation required above resistance</li>
            </ul>
            <div className="dnaTag">TRENDING · EVENT-SENSITIVE · LIQUID</div>
          </article>
        </section>

        <section className="mcPanel missionBrief" id="brief">
          <div className="mcPanelHead">
            <div><span>AI MISSION BRIEF</span><h2>What matters today</h2></div>
            <small>READ TIME · 45 SEC</small>
          </div>
          <p>
            Overnight futures remain constructive with buyers maintaining control above yesterday&apos;s value area. Volatility is contained, but scheduled US inflation data creates a clear risk window before the cash open. The base case remains cautiously bullish while price holds above the daily pivot. A sustained loss of first support would reduce confidence and return the lower overnight range to focus.
          </p>
          <div className="briefActions">
            <div><span>PREPARE FOR</span><strong>Data-driven volatility</strong></div>
            <div><span>AVOID</span><strong>Chasing the opening spike</strong></div>
            <div><span>VIEW CHANGES IF</span><strong>Support fails with rising VIX</strong></div>
          </div>
        </section>

        <div className="mcTwoColumn">
          <section className="mcPanel" id="levels">
            <div className="mcPanelHead">
              <div><span>MARKET MAP</span><h2>Key levels</h2></div><small>ES FUTURES</small>
            </div>
            {keyLevels.map(([label, value, note, type]) => (
              <div className={`mcLevel ${type}`} key={label}>
                <span>{label}</span><strong>{value}</strong><p>{note}</p>
              </div>
            ))}
          </section>

          <section className="mcPanel economicClock" id="calendar">
            <div className="mcPanelHead">
              <div><span>ECONOMIC CLOCK™</span><h2>Next risk windows</h2></div>
              <small>UK TIME</small>
            </div>
            {events.map((event) => (
              <div className="clockEvent" key={event.name}>
                <div><strong>{event.time}</strong><span>{event.countdown}</span></div>
                <p>{event.name}</p>
                <b className={event.risk === "HIGH" ? "high" : "medium"}>{event.risk}</b>
              </div>
            ))}
          </section>
        </div>

        <section className="mcPanel scenariosPanel" id="scenarios">
          <div className="mcPanelHead">
            <div><span>DECISION FRAMEWORK</span><h2>Session scenarios</h2></div><small>WAIT FOR CONFIRMATION</small>
          </div>
          <div className="scenarioCards">
            <article className="bull"><b>BULL CASE · 64%</b><h3>Acceptance above R1</h3><p>Momentum improves above 6,332 with breadth confirmation. Target the next mapped resistance rather than chasing the initial break.</p></article>
            <article className="bear"><b>BEAR CASE · 24%</b><h3>Daily pivot failure</h3><p>Acceptance below 6,310 shifts focus toward 6,288. Rising volatility would strengthen the bearish scenario.</p></article>
            <article className="wait"><b>NO-TRADE · 12%</b><h3>Range and whipsaw</h3><p>Repeated pivot crosses without participation favour patience, reduced exposure and waiting for clearer structure.</p></article>
          </div>
        </section>

        <footer className="mcFooter">
          Educational market commentary only. Futures and options involve substantial risk. Preview values are illustrative and are not current market data.
          <Link href="/">Back to NASH AI Markets</Link>
        </footer>
      </section>
    </main>
  );
}

