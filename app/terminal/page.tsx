import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "../../utils/supabase/server";

export const metadata: Metadata = {
  title: "NASH AI Terminal™",
  description: "Preview the NASH AI Markets daily S&P 500 futures intelligence terminal.",
};

const events = [
  ["13:30 UK", "US CPI / inflation data", "HIGH"],
  ["14:30 UK", "US cash session opens", "HIGH"],
  ["19:00 UK", "Federal Reserve speaker", "MED"],
];

export default async function Terminal() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: membership } = await supabase
    .from("memberships")
    .select("plan,status,current_period_end")
    .eq("email", user.email?.toLowerCase() ?? "")
    .in("status", ["active", "trialing"])
    .maybeSingle();
  if (!membership) redirect("/membership-required");
  const portalUrl = process.env.STRIPE_CUSTOMER_PORTAL_LINK || "mailto:hello@nashaimarkets.com?subject=Manage%20my%20subscription";
  return <main className="dashboard">
    <aside className="dashSide">
      <a href="/" className="brand"><span className="mark"><i /></span><span>NASH <b>AI</b></span></a>
      <nav><a className="active" href="#overview">Overview</a><a href="#levels">Key levels</a><a href="#scenarios">Scenarios</a><a href="#options">Options desk</a><a href="#calendar">Calendar</a></nav>
      <div className="sidePlan"><span>{membership.plan.toUpperCase()} MEMBER</span><p>{user.email}<br/>Update your card, invoices or cancellation through Stripe.</p><a href={portalUrl}>Manage subscription ↗</a><a href="/auth/signout">Sign out ↗</a></div>
    </aside>
    <div className="dashMain" id="overview">
      <header className="dashTop"><div><span className="kicker">NASH AI TERMINAL™</span><h1>Good morning, trader.</h1><p>Monday · Pre-market briefing · Illustrative preview</p></div><div className="sessionBadge"><span>SESSION RISK</span><b>● ELEVATED</b></div></header>
      <div className="previewNotice">PREVIEW DATA — FORMAT DEMONSTRATION ONLY, NOT A LIVE SIGNAL</div>
      <section className="dashMetrics"><article><span>ES FUTURES</span><strong>6,318.25</strong><em className="positive">+0.34%</em></article><article><span>VIX</span><strong>16.42</strong><em className="negative">−1.08%</em></article><article><span>10Y YIELD</span><strong>4.31%</strong><em className="positive">+3 bps</em></article><article><span>US DOLLAR</span><strong>97.84</strong><em>FLAT</em></article></section>
      <div className="dashColumns">
        <section className="dashPanel" id="levels"><div className="panelHead"><div><span>MARKET MAP</span><h2>Key levels</h2></div><small>ES FUTURES</small></div><div className="dashLevel resistance"><span>R2</span><strong>6,350</strong><p>Momentum breakout</p></div><div className="dashLevel resistance"><span>R1</span><strong>6,332</strong><p>First resistance</p></div><div className="dashLevel pivot"><span>PV</span><strong>6,310</strong><p>Daily pivot</p></div><div className="dashLevel support"><span>S1</span><strong>6,288</strong><p>First support</p></div><div className="dashLevel support"><span>S2</span><strong>6,264</strong><p>Range low</p></div></section>
        <section className="dashPanel biasPanel"><div className="panelHead"><div><span>BASE CASE</span><h2>Neutral → bullish</h2></div><b>64%</b></div><p>Buyers retain control while price accepts above the daily pivot. A clean rejection at R1 would reduce conviction and bring the lower range back into focus.</p><div className="condition"><span>CONFIRMATION</span><strong>Hold above 6,310</strong></div><div className="condition"><span>INVALIDATION</span><strong>Acceptance below 6,288</strong></div></section>
      </div>
      <section className="dashPanel scenarios" id="scenarios"><div className="panelHead"><div><span>DECISION FRAMEWORK</span><h2>Session scenarios</h2></div><small>WAIT FOR CONFIRMATION</small></div><div className="dashScenario bull"><b>BULL CASE</b><h3>Acceptance above R1</h3><p>Momentum improves above 6,332 with breadth confirmation. Avoid chasing the opening spike.</p></div><div className="dashScenario bear"><b>BEAR CASE</b><h3>Pivot failure</h3><p>Loss of 6,310 shifts focus toward 6,288. Avoid shorting directly into established support.</p></div><div className="dashScenario wait"><b>NO-TRADE</b><h3>Range and whipsaw</h3><p>Repeated pivot crosses without volume confirmation favour patience and reduced exposure.</p></div></section>
      <div className="dashColumns lower">
        <section className="dashPanel" id="options"><div className="panelHead"><div><span>ELITE PREVIEW</span><h2>Options desk</h2></div><small>VOLATILITY FIRST</small></div><p className="deskCopy">Elevated event risk favours defined-risk structures and patience around the opening repricing. Review implied volatility before selecting any strike or expiry.</p><div className="locked"><span>ELITE</span><b>Daily setup details unlock with Elite membership</b><a href="/#membership">Compare plans ↗</a></div></section>
        <section className="dashPanel" id="calendar"><div className="panelHead"><div><span>TODAY</span><h2>Event calendar</h2></div></div>{events.map(([time,name,risk])=><div className="event" key={name}><strong>{time}</strong><p>{name}</p><span className={risk === "HIGH" ? "high" : "medium"}>{risk}</span></div>)}</section>
      </div>
      <footer className="dashFooter">Educational market commentary only. Futures and options involve substantial risk. Preview values are illustrative and are not current market data.<a href="/">Back to NASH AI Markets</a></footer>
    </div>
  </main>;
}
