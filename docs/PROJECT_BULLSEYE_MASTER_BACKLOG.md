# Project BULLSEYE — Master Backlog

This document preserves the approved product, launch and growth ideas discussed for NASH AI Markets. Nothing in this backlog should be treated as permission to weaken authentication, billing, market-data safety, legal disclosures or truthful unavailable states.

## Operating rule

Before any future coding session, read this file and `docs/PROJECT_BULLSEYE_STATUS.md`. Mark items as `DONE`, `IN PROGRESS`, `BLOCKED`, `DECISION REQUIRED` or `BACKLOG`. Do not silently drop ideas.

## Launch-critical

- [IN PROGRESS] Complete and merge the direct premium dashboard redesign after authenticated desktop, tablet and mobile approval.
- [DONE] Fix lower account/membership layout overlap, improve member-nav readability, improve Mission Tools readability, change hero greeting to “Welcome back”, and stop the PWA prompt obscuring content.
- [BLOCKED] Verify Resend domain and complete passwordless sign-in delivery/callback testing.
- [BLOCKED] Confirm FMP commercial-display licence, plan entitlement, Vercel variable presence and authoritative CME ES symbol before enabling production candles.
- [BLOCKED] Complete authenticated review of Dashboard, Terminal, Ideas, Brief, Profile, onboarding/preferences, Elite badge, Founding 100 badge, chart/loading/offline/error states and Easter Hunt.
- [DECISION REQUIRED] Decide whether Preferences remains embedded in onboarding/Profile or becomes a standalone protected route.
- [BLOCKED] Complete one real end-to-end subscription, billing portal and cancellation test before public launch.

## Core product experience

- [DONE/REFINE] Premium Mission Control dashboard with market state, directional bias, confidence, trade permission, daily plan, next event and one clear primary action.
- [DONE/REFINE] NASH AI Terminal with chart, market overview, support/resistance, pivots, scenarios, event risk and truthful unavailable states.
- [BACKLOG] Live S&P 500-first market experience, later expandable to Nasdaq, Gold, Bitcoin and other markets.
- [BACKLOG] Key-level presentation: expected move, support, resistance, invalidation and no-trade conditions.
- [BACKLOG] Explainable intelligence: overnight moves, news, economic events, Treasury yields, VIX, dollar, risk rating and bull/bear/stand-aside scenarios.
- [BACKLOG] Options-focused Elite desk with risk-first suggestions and no guaranteed-outcome language.
- [BACKLOG] Watchlists, saved trade ideas, structured trade planner, review triggers and trading journal.
- [BACKLOG] Verified performance dashboard using sufficient independently verified history only.
- [BACKLOG] Economic calendar and event countdowns from verified timestamps.
- [BACKLOG] Elegant loading, offline, stale, application-error and provider-restricted states.
- [BACKLOG] Mobile-first layouts and installable app experience that never obscures important content.
- [BACKLOG] Accessible navigation, keyboard support, skip links, reduced-motion support and readable contrast.

## Member and commercial experience

- [DONE/REFINE] Free, Pro and Elite memberships with secure entitlement checks.
- [APPROVED PLAN] Launch pricing: Free; Pro £14.99/month; Elite £29.99/month; annual £149/£299.
- [APPROVED PLAN] Founding 100 Pro/Elite lifetime price lock while the subscription remains continuously active.
- [APPROVED PLAN] 30-day money-back guarantee, subject to final business/legal wording.
- [DONE/REFINE] Elite badge and verified Founding Member number/badge; never show duplicate founding records.
- [BACKLOG] Premium onboarding that captures preferences and explains the member journey.
- [BACKLOG] Clear membership comparison, upgrade flow, billing portal and cancellation experience.
- [BACKLOG] Referral programme and member rewards.
- [BACKLOG] Annual subscription migration and renewal journeys.
- [BACKLOG] Admin dashboard for memberships, brief publication, support and operational status.

## Public website and trust

- [DONE/REFINE] Premium Homepage, Pricing, Login, About, Contact, Blog/Market Intelligence Journal and branded 404.
- [BACKLOG] Proper Membership sales page if `/pricing` is not retained as the sole canonical destination.
- [BACKLOG] FAQ, trust, methodology and transparent “what we are / are not” content.
- [BACKLOG] Legal pages: terms, privacy, cookie/consent, risk disclaimer and educational-not-advice wording.
- [BACKLOG] SEO metadata, Open Graph assets, structured data, sitemap, robots and favicon/app-icon verification.
- [BACKLOG] Performance, Core Web Vitals, analytics consent and launch monitoring.

## Briefing and automation

- [BACKLOG] Briefing Admin interface.
- [BACKLOG] Publish live daily briefings from Supabase.
- [BACKLOG] AI-assisted draft generation grounded only in verified data and deterministic engine evidence.
- [BACKLOG] One-click review and publishing workflow.
- [BACKLOG] Automated subscriber emails through Resend.
- [BACKLOG] Daily archive of briefings.
- [BACKLOG] Social-post generation and scheduled distribution without making unsupported performance claims.
- [BACKLOG] Analytics dashboard for acquisition, conversion, retention and content performance.

## Launch and marketing

- [BACKLOG] Cinematic 60–90 second hero launch film.
- [BACKLOG] 30-second social advert and 15-second teaser for TikTok, Instagram Reels and YouTube Shorts.
- [BACKLOG] Website hero video and screen-recorded product walkthrough.
- [BACKLOG] Morning Brief demonstration video.
- [BACKLOG] Launch-week sequence: teaser, dashboard reveal, Morning Brief preview, behind-the-scenes process and full launch film.
- [BACKLOG] Founding Member campaign with exclusivity, verified member numbers and price-lock messaging.
- [BACKLOG] Landing-page launch copy, launch emails and social campaign.
- [BACKLOG] Daily public market content that demonstrates value without giving away the full paid workflow.

## Brand and delight

- [DONE/REFINE] Black, emerald and gold premium visual system with NASH AI Markets and NASH AI Terminal branding.
- [BACKLOG] Preserve supplied graphics and replace them only with demonstrably better assets.
- [BACKLOG] Feature-flagged Golden Egg/Easter Hunt with accessible clues away from trading controls.
- [BACKLOG] Hidden smile/easter interaction and five-tap logo modal containing the approved Project BULLSEYE quote/brand moment.
- [BACKLOG] Restrained premium motion, micro-interactions and hover states without hurting performance or accessibility.

## Product council and feedback

- [DONE/REFINE] Authenticated Ideas Hub with submissions, votes, comments and monthly shortlist.
- [BACKLOG] Public roadmap/status labels: under review, planned, in development, released and declined.
- [BACKLOG] Member feedback loop after launch and a disciplined process for prioritising requested features.

## Cost-control and delivery rules

- [REQUIRED] No open-ended “continue autonomously” sessions.
- [REQUIRED] Each paid coding run must have one measurable objective, named files, a stop condition and a maximum scope.
- [REQUIRED] Every session ends with changed files, commit SHA, test/build results, preview URL and remaining blockers.
- [REQUIRED] Do not commission another audit until the previous audit’s concrete fixes are visibly deployed.
- [REQUIRED] Prioritise first paying subscribers over low-value feature expansion.
