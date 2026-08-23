"use client";

import { useState } from "react";
import type { MarketingPreviewFixture } from "../lib/illustrative-fixtures.ts";
import type { MarketingPreviewPageId } from "../lib/page-sections.ts";
import { MarketingPreviewChart } from "./MarketingPreviewChart.tsx";

type PreviewPageProps = {
  fixture: MarketingPreviewFixture;
  onNavigate: (page: MarketingPreviewPageId) => void;
};

function toneClass(tone: string) {
  return `is-${tone}`;
}

function formatLevel(value: number) {
  return value.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function sparklinePoints(values: number[]) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, 0.01);
  return values
    .map((value, index) => `${(index / Math.max(values.length - 1, 1)) * 100},${26 - ((value - min) / span) * 22}`)
    .join(" ");
}

function ExampleFlag({ label = "EXAMPLE ONLY · NOT LIVE" }: { label?: string }) {
  return <span className="mpExampleFlag">{label}</span>;
}

function CrossMarketCards({ fixture }: { fixture: MarketingPreviewFixture }) {
  return (
    <div className="mpCrossGrid">
      {fixture.crossMarket.map((card) => (
        <article key={card.symbol} className={toneClass(card.tone)}>
          <span>{card.symbol}</span>
          <strong>{card.change}</strong>
          <svg viewBox="0 0 100 28" role="img" aria-label={`${card.label} illustrative mini chart`}>
            <polyline points={sparklinePoints(card.sparkline)} />
          </svg>
          <small>{card.label}</small>
        </article>
      ))}
    </div>
  );
}

function DashboardPreview({ fixture }: PreviewPageProps) {
  const { posture, levels, candles, crossMarket } = fixture;
  const latest = candles.at(-1)!;
  const first = candles[0]!;
  const net = latest.close - first.close;
  const netPct = (net / first.close) * 100;
  const avgRange =
    candles.slice(-20).reduce((sum, candle) => sum + (candle.high - candle.low), 0) / Math.min(20, candles.length);
  const upBars = candles.filter((candle) => candle.close >= candle.open).length;
  const trendBias = netPct > 0.08 ? "Rising" : netPct < -0.08 ? "Falling" : "Balanced";
  const momentum = Math.abs(netPct) > 0.12 ? "Expanding" : "Contained";
  const structure = posture.leanTone === "mixed" ? "Range" : posture.leanTone === "neutral" ? "Compression" : "Directional";
  const volumeTone = candles.slice(-8).reduce((sum, candle) => sum + candle.volume, 0) >
    candles.slice(0, 8).reduce((sum, candle) => sum + candle.volume, 0)
    ? "Building"
    : "Steady";

  return (
    <>
      <section className="mpPosture" aria-labelledby="mp-posture-title">
        <header>
          <div>
            <span className="mpEyebrow">TODAY&apos;S POSTURE</span>
            <h2 id="mp-posture-title">{posture.headline}</h2>
            <p>{posture.summary}</p>
          </div>
          <span className={`mpPill ${toneClass(posture.permissionTone)}`}>{posture.participation}</span>
        </header>
        <div className="mpDecisionGrid">
          <article><span>Participation</span><strong className={toneClass(posture.permissionTone)}>{posture.participation}</strong></article>
          <article><span>Observed market lean</span><strong className={toneClass(posture.leanTone)}>{posture.lean}</strong></article>
          <article><span>Confidence</span><strong>{posture.confidence}</strong><small>{posture.confidenceDetail}</small></article>
          <article><span>Primary condition</span><strong>{posture.primaryCondition}</strong></article>
        </div>
      </section>

      <div className="mpWorkspace">
        <MarketingPreviewChart candles={candles} levels={levels} stateLabel={fixture.label} />
        <aside className="mpSideStack" aria-label="Illustrative support panels">
          <section className="mpPanel">
            <header><span>KEY LEVELS</span><h3>Session map</h3></header>
            <ul>
              <li><span>R2</span><strong>{formatLevel(levels.r2)}</strong></li>
              <li><span>R1</span><strong>{formatLevel(levels.r1)}</strong></li>
              <li><span>Pivot</span><strong>{formatLevel(levels.pivot)}</strong></li>
              <li><span>S1</span><strong>{formatLevel(levels.s1)}</strong></li>
              <li><span>S2</span><strong>{formatLevel(levels.s2)}</strong></li>
            </ul>
          </section>
          <section className="mpPanel">
            <header><span>OVERNIGHT / SESSION</span><h3>Range context</h3></header>
            <ul>
              <li><span>Overnight high</span><strong>{formatLevel(levels.overnightHigh)}</strong></li>
              <li><span>Overnight low</span><strong>{formatLevel(levels.overnightLow)}</strong></li>
              <li><span>Overnight range</span><strong>{formatLevel(levels.overnightRange)}</strong></li>
              <li><span>Overnight midpoint</span><strong>{formatLevel(levels.overnightMidpoint)}</strong></li>
              <li><span>Expected move</span><strong>{formatLevel(levels.expectedMove)}</strong></li>
              <li><span>Session status</span><strong>{posture.sessionStatus}</strong></li>
            </ul>
          </section>
          <section className="mpPanel">
            <header><span>MARKET WEATHER</span><h3>{posture.weather}</h3></header>
            <p>{posture.weatherDetail}</p>
          </section>
          <section className="mpPanel">
            <header><span>CROSS-MARKET</span><h3>Related cards</h3></header>
            <div className="mpCrossGrid">
              {crossMarket.map((card) => (
                <article key={card.symbol} className={toneClass(card.tone)}>
                  <span>{card.symbol}</span><strong>{card.change}</strong>
                  <svg viewBox="0 0 100 28" role="img" aria-label={`${card.label} illustrative mini chart`}><polyline points={sparklinePoints(card.sparkline)} /></svg>
                  <small>{card.label}</small>
                </article>
              ))}
            </div>
          </section>
        </aside>
      </div>

      <section className="mpBottomStrip" aria-label="Illustrative analytics strip">
        <article className="mpPanel">
          <header><span>EVIDENCE SUMMARY</span><h3>Illustrative stack</h3></header>
          <ul className="mpEvidence">{posture.evidence.map((item) => <li key={item}>{item}</li>)}</ul>
        </article>
        <article className="mpPanel mpMiniMetrics">
          <header><span>SESSION ANALYTICS</span><h3>Compact read</h3></header>
          <div className="mpMetricGrid">
            <div><span>Trend</span><strong>{trendBias}</strong></div>
            <div><span>Momentum</span><strong>{momentum}</strong></div>
            <div><span>Structure</span><strong>{structure}</strong></div>
            <div><span>Volume</span><strong>{volumeTone}</strong></div>
            <div><span>Net</span><strong>{`${net >= 0 ? "+" : ""}${net.toFixed(2)} (${netPct >= 0 ? "+" : ""}${netPct.toFixed(2)}%)`}</strong></div>
            <div><span>Avg range</span><strong>{avgRange.toFixed(2)}</strong></div>
            <div><span>Up bars</span><strong>{`${upBars}/${candles.length}`}</strong></div>
            <div><span>Last</span><strong>{formatLevel(latest.close)}</strong></div>
          </div>
        </article>
        <article className="mpPanel">
          <header><span>RECENT POSTURE HISTORY</span><h3>Session trail</h3></header>
          <ul>{posture.postureHistory.map((item) => <li key={`${item.label}-${item.lean}`}><span>{item.label}</span><strong>{item.lean}</strong></li>)}</ul>
        </article>
      </section>
    </>
  );
}

function MorningBriefPreview({ fixture, onNavigate }: PreviewPageProps) {
  const { posture, levels } = fixture;
  return (
    <>
      <section className="mpPageHero mpBriefHero">
        <div>
          <span className="mpEyebrow">YOUR 30-SECOND BRIEF</span>
          <h2>Good afternoon. <em>{posture.headline}.</em></h2>
          <p>A calm example of how Bullseye turns market context into a structured preparation route.</p>
          <div className="mpActionRow">
            <button type="button" className="mpPrimaryButton" onClick={() => onNavigate("dashboard")}>Open example Dashboard</button>
            <button type="button" onClick={() => onNavigate("terminal")}>Open example Trading Desk</button>
          </div>
        </div>
        <div className="mpHeroStats">
          <article><span>Session</span><strong>Regular session</strong><small>Example snapshot · 15:55 UK</small></article>
          <article><span>Feed</span><strong className="is-caution">Illustrative</strong><small>Deterministic presentation data</small></article>
          <article><span>Membership</span><strong>Elite example</strong><small>Educational commentary only</small></article>
        </div>
      </section>
      <div className="mpNotice"><strong>ILLUSTRATIVE BRIEF.</strong><span>No live market reading, personalised advice or trade instruction is shown.</span></div>
      <nav className="mpJourney" aria-label="Example Morning Brief route">
        <span>Briefing route</span><a href="#mp-decision">01 Decision</a><a href="#mp-context">02 Context</a><a href="#mp-levels">03 Levels</a><a href="#mp-risk">04 Risk</a><a href="#mp-act">05 Act</a>
      </nav>
      <section className="mpFeatureGrid" id="mp-decision">
        <article className="mpPanel mpFeatureLead">
          <header><span>TODAY&apos;S DECISION</span><h3>{posture.headline}</h3></header>
          <p>{posture.summary}</p>
          <div className="mpDecisionGrid mpDecisionGridCompact">
            <article><span>Participation</span><strong className={toneClass(posture.permissionTone)}>{posture.participation}</strong></article>
            <article><span>Observed lean</span><strong className={toneClass(posture.leanTone)}>{posture.lean}</strong></article>
            <article><span>Confidence</span><strong>{posture.confidence}</strong></article>
            <article><span>Condition</span><strong>{posture.primaryCondition}</strong></article>
          </div>
        </article>
        <article className="mpPanel" id="mp-context">
          <header><span>WHAT CHANGED</span><h3>Cross-market context</h3></header>
          <p>Related markets are grouped beside the main S&amp;P 500 picture so the member can see alignment and conflict quickly.</p>
          <CrossMarketCards fixture={fixture} />
        </article>
      </section>
      <section className="mpTripleGrid">
        <article className="mpPanel" id="mp-levels">
          <header><span>VERIFIED LEVELS · EXAMPLE</span><h3>Decision map</h3></header>
          <ul>
            <li><span>Upside reference</span><strong>{formatLevel(levels.r1)}</strong></li>
            <li><span>Decision pivot</span><strong>{formatLevel(levels.pivot)}</strong></li>
            <li><span>Downside reference</span><strong>{formatLevel(levels.s1)}</strong></li>
            <li><span>Expected move</span><strong>±{formatLevel(levels.expectedMove)}</strong></li>
          </ul>
        </article>
        <article className="mpPanel" id="mp-risk">
          <header><span>WATCH / AVOID</span><h3>Risk first</h3></header>
          <ul className="mpChecklist">
            <li><b>01</b><span>Do not chase price into the example resistance zone.</span></li>
            <li><b>02</b><span>Stand aside when evidence conflicts.</span></li>
            <li><b>03</b><span>Reduce activity around the example event window.</span></li>
          </ul>
        </article>
        <article className="mpPanel" id="mp-act">
          <header><span>NEXT ACTIONS</span><h3>Prepare, then observe</h3></header>
          <ul className="mpChecklist">
            <li><b>✓</b><span>Mark personal levels</span></li><li><b>✓</b><span>Review invalidation</span></li><li><b>○</b><span>Wait for confirmation</span></li>
          </ul>
          <button type="button" className="mpInlineButton" onClick={() => onNavigate("terminal")}>Continue to Trading Desk</button>
        </article>
      </section>
    </>
  );
}

function TradingDeskPreview({ fixture }: PreviewPageProps) {
  const [deskTab, setDeskTab] = useState("Charts");
  const latest = fixture.candles.at(-1)!;
  return (
    <>
      <section className={`mpDeskMission ${toneClass(fixture.posture.permissionTone)}`}>
        <div>
          <span className="mpEyebrow">ACTIVE DESK · ILLUSTRATIVE</span>
          <div className="mpDeskInstrument"><div><small>S&amp;P 500 FUTURES</small><h2>ES</h2></div><div><strong>{formatLevel(latest.close)}</strong><span>+0.31% example move</span></div></div>
          <div className="mpDeskPermission"><span>Participation permission</span><strong>{fixture.posture.participation}</strong><small>{fixture.posture.primaryCondition}</small></div>
        </div>
        <div className="mpDeskReadiness">
          <ExampleFlag />
          <strong>4 / 4</strong><span>Example evidence connected</span>
          <div><i className="is-ready" /><i className="is-ready" /><i className="is-ready" /><i className="is-ready" /></div>
        </div>
      </section>
      <div className="mpDeskTabs" role="tablist" aria-label="Example Trading Desk views">
        {["Overview", "Charts", "Catalysts", "Journal"].map((tab) => <button key={tab} type="button" role="tab" aria-selected={deskTab === tab} className={deskTab === tab ? "is-active" : undefined} onClick={() => setDeskTab(tab)}>{tab}</button>)}
      </div>
      <div className="mpDeskLayout">
        <div className="mpDeskMain">
          <MarketingPreviewChart candles={fixture.candles} levels={fixture.levels} stateLabel={fixture.label} />
          <section className="mpFeatureGrid">
            <article className="mpPanel"><header><span>CATALYST RADAR</span><h3>Example event windows</h3></header><div className="mpTimeline"><div><b>16:00</b><span>US activity release</span><small>High impact · example</small></div><div><b>18:00</b><span>Policy speaker window</span><small>Medium impact · example</small></div><div><b>20:00</b><span>Closing flow</span><small>Session risk</small></div></div></article>
            <article className="mpPanel"><header><span>CONFIRMATION ENGINE</span><h3>Evidence health</h3></header><div className="mpHealthGrid"><div><span>Price structure</span><strong>Aligned</strong></div><div><span>Momentum</span><strong>Improving</strong></div><div><span>Cross-market</span><strong>Supportive</strong></div><div><span>Event risk</span><strong className="is-caution">Elevated</strong></div></div></article>
          </section>
        </div>
        <aside className="mpDeskRail">
          <section className="mpPanel"><header><span>MARKETS</span><h3>Example watchlist</h3></header><div className="mpMarketList"><button type="button" className="is-active"><span>ES</span><small>S&amp;P 500</small><strong>+0.31%</strong></button><button type="button"><span>NQ</span><small>Nasdaq 100</small><strong>+0.44%</strong></button><button type="button"><span>RTY</span><small>Russell 2000</small><strong>+0.18%</strong></button><button type="button"><span>VIX</span><small>Volatility</small><strong className="is-down">−2.10%</strong></button></div></section>
          <section className="mpPanel"><header><span>SESSION LEVELS</span><h3>ES map</h3></header><ul><li><span>R1</span><strong>{formatLevel(fixture.levels.r1)}</strong></li><li><span>Pivot</span><strong>{formatLevel(fixture.levels.pivot)}</strong></li><li><span>S1</span><strong>{formatLevel(fixture.levels.s1)}</strong></li><li><span>ON midpoint</span><strong>{formatLevel(fixture.levels.overnightMidpoint)}</strong></li></ul></section>
          <section className="mpPanel"><header><span>DESK NOTE</span><h3>{deskTab} view selected</h3></header><p>This control demonstrates how members organise the workspace. It does not save or submit anything.</p></section>
        </aside>
      </div>
    </>
  );
}

const EXAMPLE_IDEAS = [
  { type: "watching", title: "Opening-range continuation watch", market: "ES · intraday", status: "WATCHING", thesis: "Higher-low structure holds above the example session midpoint.", confirmation: "Acceptance above the opening range with improving breadth.", invalidation: "Loss of the midpoint and failed reclaim.", risk: "Event window approaching" },
  { type: "review", title: "Failed-breakdown reversal review", market: "ES · replay", status: "REVIEW", thesis: "An example breakdown failed and returned inside the prior range.", confirmation: "Reclaim held for two completed example candles.", invalidation: "Fresh low below the failed-breakdown wick.", risk: "Educational replay only" },
  { type: "no-trade", title: "Conflicting evidence — stand aside", market: "ES · risk control", status: "NO TRADE", thesis: "Price, volatility and participation do not align.", confirmation: "None — the correct example action is patience.", invalidation: "Reassess only after evidence alignment improves.", risk: "Capital preservation" },
] as const;

function IdeasPreview() {
  const [filter, setFilter] = useState("All");
  const ideas = filter === "All" ? EXAMPLE_IDEAS : EXAMPLE_IDEAS.filter((idea) => idea.status === filter.toUpperCase());
  return (
    <>
      <section className="mpPageHero"><div><span className="mpEyebrow">MEMBER IDEAS</span><h2>A disciplined space for hypotheses—not signals.</h2><p>Members can record a thesis, required confirmation, invalidation and risk before reviewing the outcome. Every card is an example, not a recommendation.</p></div><div className="mpHeroScore"><ExampleFlag label="DEMO IDEAS · NOT RECOMMENDATIONS" /><strong>3</strong><span>Example cards</span></div></section>
      <div className="mpFilterBar" role="group" aria-label="Filter example ideas">{["All", "Watching", "Review", "No trade"].map((item) => <button key={item} type="button" className={filter === item ? "is-active" : undefined} onClick={() => setFilter(item)}>{item}</button>)}</div>
      <section className="mpIdeasGrid">
        {ideas.map((idea) => <article className={`mpIdeaCard is-${idea.type}`} key={idea.title}><header><div><span>{idea.market}</span><h3>{idea.title}</h3></div><b>{idea.status}</b></header><dl><div><dt>Thesis</dt><dd>{idea.thesis}</dd></div><div><dt>Confirmation required</dt><dd>{idea.confirmation}</dd></div><div><dt>Invalidation</dt><dd>{idea.invalidation}</dd></div><div><dt>Risk note</dt><dd>{idea.risk}</dd></div></dl><footer><span>Example journal entry</span><button type="button">Open review</button></footer></article>)}
      </section>
      <section className="mpPanel mpWideCallout"><div><span className="mpEyebrow">IDEA DISCIPLINE</span><h3>Every idea needs an invalidation before it becomes useful.</h3><p>The live product stores member-created notes privately. This public example never reads or writes an account.</p></div><div className="mpScoreRing"><strong>82</strong><span>Example process score</span></div></section>
    </>
  );
}

function ReviewsPreview() {
  return (
    <>
      <section className="mpPageHero"><div><span className="mpEyebrow">SESSION REVIEWS</span><h2>Turn market days into repeatable lessons.</h2><p>A complete example library for pre-market briefings, post-market reviews and written session recaps.</p></div><div className="mpHeroScore"><ExampleFlag label="EXAMPLE MEDIA LIBRARY" /><strong>07</strong><span>Example reviews this month</span></div></section>
      <section className="mpReviewGrid">
        {[{ tag: "POST-MARKET", title: "Patience before the breakout", meta: "8:42 · Example session review", tone: "green" }, { tag: "PRE-MARKET", title: "Three levels that framed the day", meta: "6:18 · Example morning briefing", tone: "gold" }, { tag: "WEEKLY REVIEW", title: "Process over prediction", meta: "12:05 · Example weekly recap", tone: "blue" }].map((review, index) => <article className="mpReviewCard" key={review.title}><div className={`mpVideoFrame is-${review.tone}`}><span>{review.tag}</span><button type="button" aria-label={`Play ${review.title} example`}><i /></button><small>ILLUSTRATIVE VIDEO PLACEHOLDER</small></div><div><span>0{index + 1} · 21 JUL 2026</span><h3>{review.title}</h3><p>{review.meta}</p><button type="button">Open example review</button></div></article>)}
      </section>
      <section className="mpFeatureGrid">
        <article className="mpPanel"><header><span>WEEKLY SCORECARD</span><h3>Process quality</h3></header><div className="mpScoreRows"><div><span>Plan followed</span><b>4 / 5 days</b><i style={{ width: "80%" }} /></div><div><span>No-trade discipline</span><b>3 / 3</b><i style={{ width: "100%" }} /></div><div><span>Journal completed</span><b>4 / 5 days</b><i style={{ width: "80%" }} /></div></div></article>
        <article className="mpPanel"><header><span>LATEST SESSION</span><h3>Example review timeline</h3></header><div className="mpTimeline"><div><b>14:30</b><span>Opening volatility respected</span><small>Wait posture</small></div><div><b>15:10</b><span>Structure became constructive</span><small>Selective posture</small></div><div><b>20:55</b><span>Closed with process intact</span><small>Review saved</small></div></div></article>
      </section>
    </>
  );
}

function ProfilePreview() {
  return (
    <>
      <section className="mpProfileHero"><div className="mpAvatar" aria-hidden="true">AM</div><div><span className="mpEyebrow">EXAMPLE MEMBER</span><h2>Alex Morgan</h2><p>Member since July 2026 · United Kingdom</p></div><ExampleFlag label="SAMPLE ACCOUNT · NO REAL DETAILS" /></section>
      <section className="mpProfileGrid">
        <article className="mpPanel mpMembershipCard"><header><span>MEMBERSHIP</span><h3>Elite example</h3></header><div className="mpPlanPrice"><strong>£29</strong><span>/ month example</span></div><p>Full preparation workspace, expanded context and review tools when available under the member&apos;s plan.</p><ul className="mpChecklist"><li><b>✓</b><span>Dashboard and Morning Brief</span></li><li><b>✓</b><span>Trading Desk workspace</span></li><li><b>✓</b><span>Ideas and review library</span></li></ul><button type="button" className="mpPrimaryButton">Example billing portal</button></article>
        <article className="mpPanel"><header><span>ACCOUNT DETAILS</span><h3>Profile information</h3></header><div className="mpFieldList"><label><span>Display name</span><input value="Alex Morgan" readOnly /></label><label><span>Email</span><input value="example@nashaimarkets.com" readOnly /></label><label><span>Timezone</span><input value="Europe/London" readOnly /></label><label><span>Experience</span><input value="Developing trader" readOnly /></label></div><small className="mpFieldNote">Example fields cannot be saved from this presentation.</small></article>
        <article className="mpPanel"><header><span>SECURITY</span><h3>Passwordless access</h3></header><div className="mpSecurityRows"><div><span>Sign-in method</span><strong>Email magic link</strong></div><div><span>Last example sign-in</span><strong>Today · 14:06 UK</strong></div><div><span>Member data</span><strong className="is-open">Private</strong></div></div><button type="button">Review example sessions</button></article>
        <article className="mpPanel"><header><span>SUPPORT</span><h3>Need a hand?</h3></header><p>Guidance for account access, membership management and Bullseye&apos;s data-safety states.</p><div className="mpSupportLinks"><button type="button">Open help centre</button><button type="button">Contact support</button><button type="button">Read risk disclaimer</button></div></article>
      </section>
    </>
  );
}

function PreferencesPreview() {
  const [density, setDensity] = useState("Balanced");
  const [notifications, setNotifications] = useState(true);
  const [watchlist, setWatchlist] = useState({ ES: true, NQ: true, RTY: true, VIX: true, DXY: false });
  const [saved, setSaved] = useState(false);
  return (
    <>
      <section className="mpPageHero"><div><span className="mpEyebrow">WORKSPACE PREFERENCES</span><h2>A focused workspace, shaped around the member.</h2><p>These example controls demonstrate the current preference experience without reading or saving any real account setting.</p></div><ExampleFlag label="LOCAL DEMO CONTROLS" /></section>
      <section className="mpSettingsGrid">
        <article className="mpPanel"><header><span>MARKET FOCUS</span><h3>Example watchlist</h3></header><p>Choose the markets shown beside the main S&amp;P 500 workspace.</p><div className="mpToggleList">{Object.entries(watchlist).map(([symbol, enabled]) => <label key={symbol}><span><strong>{symbol}</strong><small>{symbol === "ES" ? "S&P 500 futures" : symbol === "NQ" ? "Nasdaq 100 futures" : symbol === "RTY" ? "Russell 2000 futures" : symbol === "VIX" ? "Volatility index" : "US dollar index"}</small></span><input type="checkbox" checked={enabled} onChange={(event) => setWatchlist((current) => ({ ...current, [symbol]: event.target.checked }))} /></label>)}</div></article>
        <article className="mpPanel"><header><span>DISPLAY</span><h3>Information density</h3></header><p>Control how much supporting information appears at once.</p><div className="mpSegmented" role="radiogroup" aria-label="Example information density">{["Focused", "Balanced", "Detailed"].map((item) => <button type="button" role="radio" aria-checked={density === item} className={density === item ? "is-active" : undefined} onClick={() => setDensity(item)} key={item}>{item}</button>)}</div><div className="mpPreferencePreview"><span>Selected layout</span><strong>{density}</strong><small>Example only · stored nowhere</small></div></article>
        <article className="mpPanel"><header><span>SESSION</span><h3>Trading-day context</h3></header><div className="mpFieldList"><label><span>Timezone</span><select defaultValue="Europe/London"><option>Europe/London</option><option>America/New_York</option></select></label><label><span>Primary session</span><select defaultValue="US regular session"><option>US regular session</option><option>US pre-market</option><option>Post-market review</option></select></label></div><label className="mpSwitchRow"><span><strong>Morning Brief reminder</strong><small>Example notification preference</small></span><input type="checkbox" checked={notifications} onChange={(event) => setNotifications(event.target.checked)} /></label></article>
        <article className="mpPanel"><header><span>SAFETY &amp; CLARITY</span><h3>Always visible</h3></header><ul className="mpChecklist"><li><b>✓</b><span>Data freshness and availability labels</span></li><li><b>✓</b><span>Illustrative / delayed / unavailable states</span></li><li><b>✓</b><span>Risk-first participation wording</span></li><li><b>✓</b><span>Educational-commentary disclaimer</span></li></ul><button type="button" className="mpPrimaryButton" onClick={() => setSaved(true)}>Save example preferences</button><p className="mpSaveStatus" aria-live="polite">{saved ? "Example preferences saved for this screen only." : "No account data is changed."}</p></article>
      </section>
    </>
  );
}

export function MarketingPreviewPageContent({ pageId, fixture, onNavigate }: PreviewPageProps & { pageId: MarketingPreviewPageId }) {
  if (pageId === "brief") return <MorningBriefPreview fixture={fixture} onNavigate={onNavigate} />;
  if (pageId === "terminal") return <TradingDeskPreview fixture={fixture} onNavigate={onNavigate} />;
  if (pageId === "ideas") return <IdeasPreview />;
  if (pageId === "reviews") return <ReviewsPreview />;
  if (pageId === "profile") return <ProfilePreview />;
  if (pageId === "preferences") return <PreferencesPreview />;
  return <DashboardPreview fixture={fixture} onNavigate={onNavigate} />;
}
