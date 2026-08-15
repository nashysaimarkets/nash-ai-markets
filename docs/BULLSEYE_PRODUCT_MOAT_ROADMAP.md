# Project Bullseye — Product Moat Roadmap

Status: **PRODUCT DIRECTION**  
Prepared: **15 August 2026**  
Scope: S&P 500 session preparation, decision support and review

## North star

NASH AI Markets should not try to beat TradingView at universal charting, Bookmap
at full-depth order flow, or a broker at execution. Its winning position is:

> **The most trustworthy S&P 500 session operating system — from orientation to
> decision to review.**

The product should answer five questions faster and more honestly than any
competitor:

1. What state is the market in now?
2. What evidence supports or contradicts that reading?
3. What event or level would change the plan?
4. Is participation permitted, conditional or blocked?
5. What did the original plan get right or wrong after the session?

Every major feature must strengthen one of those answers. A new tab that does not
strengthen them is probably clutter.

## The moat

### 1. Truth layer

Every material number or conclusion should expose, on demand:

- source/provider;
- instrument identity;
- observation timestamp;
- retrieval timestamp;
- freshness state;
- delayed/live/unavailable classification;
- licence/display status where relevant;
- transformation used;
- which engine conclusion depends on it;
- what happens when it is missing.

The interface should make **unknown** look deliberate and trustworthy, not broken.

### 2. Decision graph, not a black-box score

Let members open the Bullseye conclusion and see a compact evidence graph:

- trend evidence;
- volatility evidence;
- rates/dollar evidence;
- catalyst risk;
- structure/levels;
- contradictory factors;
- missing factors;
- exact reason participation is open, conditional or blocked.

Users should be able to answer “Why did Bullseye change?” without reading a long
report.

### 3. What changed since my last visit

On return, show only material changes:

- session phase changed;
- next catalyst changed;
- price crossed a verified reference;
- VIX/rates/dollar condition changed;
- data became stale or recovered;
- Bull/Bear lean changed;
- participation permission changed;
- risk rating changed.

This becomes a powerful reason to reopen the product throughout the day without
turning it into a noisy alert machine.

### 4. Plan-versus-reality replay

Archive the pre-session plan immutably, then compare it with verified outcomes:

- original market state;
- original scenarios and invalidations;
- catalysts known at the time;
- levels known at the time;
- later path of price;
- whether the correct scenario activated;
- whether a no-trade condition protected the user;
- process score separated from profit/loss;
- changes made after the fact clearly marked rather than silently rewritten.

This is more valuable than a generic chart replay because it teaches the member
how the complete decision process behaved.

### 5. Personal Risk OS

Keep personalised controls separate from market truth:

- preferred session and instruments;
- maximum planned risk entered by the user;
- time available to trade;
- event blackout preference;
- personal no-trade rules;
- daily readiness checklist;
- fatigue/emotion check;
- personal reference levels;
- broker/platform deep links;
- journal and review prompts.

Personal inputs may change presentation and reminders, but must never fabricate or
alter verified market evidence.

## Priority roadmap

## P0 — public-launch quality

These are more important than adding another indicator:

1. Complete mobile, tablet, keyboard and screen-reader acceptance.
2. Complete sign-in, sign-out, expired-link and return-path evidence.
3. Make the waitlist and approved checkout journeys measurable and recoverable.
4. Add named monitoring, alert thresholds, rollback ownership and a restore drill.
5. Complete privacy, retention, processor and financial-promotion review.
6. Obtain ES/VIX customer-display rights and run a populated-session soak.
7. Ensure every customer route has a useful loading, unavailable and error state.
8. Preserve one consistent visual hierarchy and remove unfinished navigation.

## P1 — immediate differentiation after launch

### A. “What changed?” return briefing

A compact diff card between the member’s last verified view and the current
snapshot. This should become the fastest product interaction.

### B. Event Mode

For CPI, payrolls, FOMC and other verified catalysts:

- event countdown;
- pre-event risk posture;
- scenarios without invented forecast certainty;
- automatic freeze/stand-aside window;
- post-event data-integrity wait;
- re-evaluation when fresh evidence arrives;
- “what changed” summary after the release.

### C. Evidence map

An interactive but restrained diagram connecting ES, VIX, yields, dollar,
structure, catalysts and the resulting decision permission.

### D. Immutable Session Plan

One-click save of the morning plan with a visible timestamp and later comparison
against verified outcomes.

### E. Intelligent alerts

Alerts should describe a decision change, not merely a price move:

- participation changed from blocked to conditional;
- catalyst window entered;
- verified level crossed and held;
- supporting markets confirmed or contradicted;
- data freshness degraded;
- original scenario invalidated.

Members choose quiet, standard or active alert profiles. No automatic execution.

## P2 — premium learning engine

### A. Bullseye Pattern Library

Build from verified archived sessions, not synthetic success stories:

- similar volatility regimes;
- similar yield/dollar combinations;
- similar overnight structures;
- how often each scenario activated;
- sample size and date range;
- no unsupported probability when history is insufficient.

### B. Process analytics

Measure behaviours the member controls:

- checklist completion;
- trading inside/outside planned windows;
- respecting event blackouts;
- following invalidations;
- journalling and review consistency;
- outcomes shown separately and only when honestly measurable.

### C. Guided replay

Pause archived sessions at decision points and ask the member what they would do
before revealing the next verified segment. Score process, not guessed direction.

### D. Ask Bullseye with citations

Every answer links back to the exact verified cards and timestamps used. The
assistant must state when evidence is missing and must never invent news, levels,
probabilities or personalised instructions.

## P3 — shareable trust and growth

### A. Public session cards

Generate clean, delayed/archived share cards containing:

- session state;
- key catalyst;
- risk posture;
- conditional scenarios;
- timestamp, source and delayed/archive label;
- no personalised recommendation.

These become the safest organic-growth asset and bring viewers back to the
waitlist or public brief.

### B. Founder video workflow

Turn the same verified session object into:

- 30-second written summary;
- vertical social clip script;
- morning video brief;
- post-close review;
- archive card.

One evidence source prevents contradictory content across channels.

### C. Community learning, not social signals

Members can vote on product ideas, submit questions and discuss process lessons.
Do not build copy trading, leaderboards ranked by profit, public position feeds or
pressure-inducing social proof.

### D. Read-only integrations

Later integrations should begin read-only:

- calendar export;
- notification channels;
- chart-platform deep links;
- optional broker import for private journalling after security/legal review.

Order execution and account control create a different regulatory, security and
support product and should not be an early goal.

## Visual experience principles

1. The first screen must answer “What is the plan?” before showing secondary
   detail.
2. Use visual variety with purpose: gauges for state, lanes for scenarios,
   timelines for catalysts, charts for history and evidence maps for causality.
3. Never use an empty decorative chart where no historical series exists.
4. Make the primary action obvious on mobile without hiding risk disclosures.
5. Use motion only to explain change, freshness or session transition.
6. Keep colour semantic and consistent: constructive, defensive, caution,
   unavailable and illustrative states must never be confused.
7. Reveal depth progressively. Beginners get plain English; experienced users can
   open provenance, formulas and diagnostics.
8. Preserve the distinctive Bullseye identity without turning every card into a
   glowing panel.

## Features to resist

- hundreds of unrelated asset pages before the S&P workflow is exceptional;
- black-box “AI predicts tomorrow” scores;
- profit promises, signal leaderboards or copy trading;
- automatic order execution;
- unlicensed market display;
- endless indicator marketplaces;
- noisy chat rooms;
- gamified streaks that encourage trading frequency;
- fabricated back-tests or probabilities;
- duplicate pages that show the same information in different boxes.

## Product scorecard

A proposed feature should be prioritised only when it improves at least two of:

- decision clarity;
- data trust;
- risk discipline;
- speed to orientation;
- learning after the session;
- member retention;
- operational reliability;
- commercial conversion without misleading claims.

The long-term advantage is not having the most data on screen. It is making the
best possible decision from the evidence that is actually available — and being
honest when it is not enough.
