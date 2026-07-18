# Project BULLSEYE — Implementation Roadmap

Last reconciled: 18 July 2026  
Working branch: `bullseye-direct-dashboard-redesign`

## Operating rules

This roadmap is maintained alongside `PROJECT_BULLSEYE_MASTER_BACKLOG.md` and
`PROJECT_BULLSEYE_STATUS.md`. Every Project BULLSEYE session must read all three
before work begins, update affected statuses, and preserve every approved idea.

Allowed statuses are `DONE`, `IN PROGRESS`, `BLOCKED`, `DECISION REQUIRED`,
`BACKLOG`, and `OUT OF SCOPE`. A status may only move to `DONE` when repository
or deployed evidence supports it.

## Permanent brokerage exclusions

The following are permanently `OUT OF SCOPE`:

- Brokerage-account connections.
- Trade or order execution.
- Automated trading.
- Copy trading.
- Deposits or withdrawals.
- Custody of customer funds.
- Broker or intermediary services.

Educational analysis, structured trade planning, market intelligence and
risk-management tools remain in scope. Nothing in this roadmap authorizes
investment advice, invented data, guaranteed outcomes, or weakened
authentication, billing, entitlement, legal, or market-data safeguards.

## Phase status

| Phase | Status | Exit gate |
|---|---|---|
| 1. Launch and first paying subscribers | BLOCKED | All external authentication, Stripe, legal, monitoring, authenticated-device and test-subscription evidence recorded; working preview approved; explicit approval requested before production merge |
| 2. Verified market intelligence | BLOCKED | Phase 1 approved, FMP rights and authoritative CME ES mapping verified, required deployment variables confirmed |
| 3. Morning Brief and publishing automation | BACKLOG | Phase 2 safely established; provider, sender, review and deterministic publishing controls approved |
| 4. Premium member tools | BACKLOG | Phase 3 stable; product priorities and any business rules approved |
| 5. Launch and customer acquisition | BACKLOG | Launch candidate and claims/legal review approved |
| 6. Operations, analytics and retention | BACKLOG | Consent, retention, ownership and vendor decisions approved |
| 7. Brand and delight | BACKLOG | Core launch work stable; feature flags and accessibility acceptance complete |

## Phase 1 — Launch and first paying subscribers

| Approved item | Status | Current evidence or next gate |
|---|---|---|
| Direct premium dashboard redesign | IN PROGRESS | Implemented through `d2bed75`; requires authenticated desktop, tablet and mobile approval |
| Dashboard account layout, navigation, Mission Tools, greeting and PWA corrections | DONE | Implemented in `978fe5f`, `0b80454`, and `d2bed75`; automated suite/build previously passed |
| Secure passwordless authentication | BLOCKED | Code and redirect contracts exist; Resend/Supabase delivery, callback, expiry, reuse, session persistence and logout require external-console and real-email evidence |
| Resend and Supabase delivery/callback validation | BLOCKED | Verified sending-domain and SMTP/auth-log evidence required without exposing secrets |
| Stripe checkout, upgrade, renewal, portal and cancellation | BLOCKED | Fail-closed implementation exists; full Stripe test-mode lifecycle and webhook evidence required |
| Free, Pro and Elite entitlements | IN PROGRESS | Server-side progressive access and locked premium states exist; real-account and lifecycle verification required |
| Founding 100 badge, number and continuous-subscription price lock | IN PROGRESS | Permanent ledger and UI exist; real record, concurrency, lifecycle and price-lock verification required |
| Pricing and membership presentation | IN PROGRESS | Approved catalogue and public pricing exist; final business-copy approval required |
| 30-day money-back guarantee | DECISION REQUIRED | Final business/legal wording and operational refund process require approval |
| Membership comparison, upgrade, billing portal and cancellation experience | IN PROGRESS | Public and protected flows exist; real Stripe lifecycle evidence remains required |
| Premium onboarding | IN PROGRESS | Authenticated onboarding and persisted preferences exist; real-user journey requires verification |
| Preferences placement | DECISION REQUIRED | Decide whether preferences remain embedded in onboarding/Profile or receive a standalone protected route |
| Terms, Privacy, Risk Disclaimer and educational-not-advice wording | DECISION REQUIRED | Pages exist; launch-jurisdiction and qualified legal/business approval required |
| SEO, Open Graph, sitemap, robots, structured data and icons | DONE | Current launch-candidate documents record implementation and automated verification |
| Performance and Core Web Vitals | BLOCKED | Source/build evidence exists; deployed Core Web Vitals baseline requires a working approved preview |
| Accessibility and responsive review | BLOCKED | Automated contracts exist; authenticated keyboard, screen-reader, tablet and mobile evidence required |
| Error, loading, stale and offline states | IN PROGRESS | Safe states exist; authenticated deployed visual acceptance remains outstanding |
| Complete test-subscription journey | BLOCKED | Requires Stripe test mode, webhook delivery, Supabase verification and an authorized test user |
| Launch monitoring | DECISION REQUIRED | Monitoring vendor, thresholds, owner and escalation timing must be chosen |
| Rollback checklist | IN PROGRESS | Checklist and incident runbook exist; immutable rollback artifact, operators and rehearsal evidence required |
| Production merge and deployment | BLOCKED | Explicit approval is mandatory after all Phase 1 gates clear |

### Phase 1 external blockers

1. Resend sending-domain verification and Supabase SMTP/auth configuration
   evidence.
2. Real magic-link delivery and callback/session/logout evidence.
3. Stripe test-mode products, Prices, portal, webhook and complete lifecycle
   evidence.
4. Real authenticated Elite/Founding desktop, tablet and mobile review.
5. Preferences placement decision.
6. Legal, privacy, financial-promotion and vendor/processor approval.
7. Monitoring, support, backup, RPO/RTO, deployment and rollback ownership.
8. One end-to-end test subscription and a monitored staging soak.

No production merge or deployment is authorized while these gates remain open.

## Phase 2 — Verified market intelligence

| Approved item | Status | Current evidence or next gate |
|---|---|---|
| FMP entitlement and commercial-display rights | BLOCKED | Written plan/licensing evidence required |
| Authoritative CME ES mapping | BLOCKED | Provider catalogue must identify the licensed contract or continuous symbol |
| Required Vercel variable presence | BLOCKED | Confirm names/presence only; never expose values |
| Licensed ES historical OHLCV | BLOCKED | Implement only after the three gates above |
| Approved 1m, 5m, 15m, 1h, 4h and 1D intervals | BLOCKED | Enable only genuinely provider-supported intervals; never synthesize |
| Fail-closed unavailable and NO TRADE safeguards | DONE | Existing validation rejects malformed, future, stale and provider-error states |
| NASH AI Terminal chart, overview, levels, pivots, scenarios and event-risk presentation | IN PROGRESS | Current safe Terminal exists; licensed candles and authenticated deployed acceptance remain blocked |
| S&P 500-first market experience | BACKLOG | Preserve current ES-first architecture; expand only after verified ES launch |
| Expected move and key levels | BACKLOG | Must derive only from verified inputs |
| VIX, Dollar Index and Treasury yields | IN PROGRESS | Existing provider mappings require deployed provenance/licensing verification |
| Economic calendar and event countdowns | BACKLOG | Requires verified event source and timestamps |
| Explainable market intelligence | BACKLOG | Overnight, news, volatility, dollar, yields and event evidence must be verified |
| Bullish, bearish and stand-aside scenarios | BACKLOG | Deterministic, explainable and fail-closed |
| Confidence, invalidation and risk rating | BACKLOG | Display only when validated evidence is sufficient |
| Additional Nasdaq, Gold, Bitcoin and approved markets | BACKLOG | Expand after the S&P 500-first experience is stable |
| Elegant loading, offline, stale and provider-restricted states | IN PROGRESS | Implemented foundations require deployed acceptance |
| Mobile-first layouts and installable app experience | IN PROGRESS | PWA and responsive foundations exist; authenticated physical-device acceptance remains blocked |

## Phase 3 — Morning Brief and publishing automation

| Approved item | Status | Current evidence or next gate |
|---|---|---|
| Briefing Admin interface | BACKLOG | Define authorized roles and review workflow |
| Supabase live daily briefings | BACKLOG | Define schema, RLS, archive and rollback |
| Verified-data drafting | BACKLOG | Ground only in verified data and deterministic engine evidence |
| Human review and one-click publishing | BACKLOG | Require auditable approval before release |
| Member dashboard Brief delivery | IN PROGRESS | Member Brief surface exists; live publishing workflow is not complete |
| Resend subscriber emails | BLOCKED | Verified sender, provider configuration, idempotency and monitoring required |
| Daily briefing archive | BACKLOG | Preserve publication provenance and corrections |
| Social-post generation | BACKLOG | Human review and unsupported-claim prevention required |
| AI-assisted drafting safeguards | BACKLOG | Deterministic fallback, grounding and bounded failure behavior required |

## Phase 4 — Premium member tools

| Approved item | Status | Current evidence or next gate |
|---|---|---|
| Watchlists | BACKLOG | Product and persistence design required |
| Saved trade ideas | BACKLOG | Define ownership, retention and safety copy |
| Structured trade planner | BACKLOG | Educational planning only; no execution |
| Participation and invalidation rules | BACKLOG | Risk-first, user-owned and non-executing |
| Review triggers | BACKLOG | No automated order or brokerage behavior |
| Trading journal | BACKLOG | Define privacy, retention and export |
| Economic calendar and countdowns | BACKLOG | Reuse verified Phase 2 event source |
| Elite options-analysis workspace | BACKLOG | Educational, risk-first and no guaranteed-outcome language |
| Verified performance history | BLOCKED | Requires sufficient independently verified sample history |
| Polished Profile and account management | IN PROGRESS | Current protected Profile requires authenticated acceptance |
| Preferences | DECISION REQUIRED | Embedded versus standalone route decision remains open |
| Referral programme and member rewards | BACKLOG | Business, fraud, tax and terms design required |
| Annual subscription migration and renewal journeys | BACKLOG | Stripe lifecycle and customer communication design required |
| Ideas Hub submissions, votes and comments | DONE | Authenticated implementation exists |
| Ideas roadmap/status labels | BACKLOG | Under review, planned, in development, released and declined |
| Member feedback prioritization loop | BACKLOG | Define operating cadence and ownership |

## Phase 5 — Launch and customer acquisition

| Approved item | Status | Current evidence or next gate |
|---|---|---|
| Cinematic 60–90 second launch film | BACKLOG | Use approved brand and real product captures only |
| 30-second social advert | BACKLOG | Claims and platform review required |
| 15-second teaser | BACKLOG | Claims and platform review required |
| Website hero video | BACKLOG | Performance and accessibility fallback required |
| Product walkthrough | BACKLOG | Capture only approved deployed product |
| Morning Brief demonstration | BACKLOG | Requires completed verified Brief workflow |
| Launch-week content sequence | BACKLOG | Teaser, dashboard reveal, Brief preview, process and full film |
| Founding Member campaign | BACKLOG | Use verified numbers and approved price-lock wording only |
| Launch landing-page copy | BACKLOG | Final legal and commercial approval required |
| Launch emails | BLOCKED | Phase 3 email delivery controls required |
| TikTok, Instagram, YouTube, X, Facebook and LinkedIn content | BACKLOG | Platform-specific plan without misleading claims |
| Daily public market content | BACKLOG | Demonstrate value using verified data without exposing paid workflow |

## Phase 6 — Operations, analytics and retention

| Approved item | Status | Current evidence or next gate |
|---|---|---|
| Acquisition, conversion and retention analytics | DECISION REQUIRED | Approve vendor, consent, retention and processor terms |
| Consent-aware tracking | DECISION REQUIRED | Privacy/legal decision required before implementation |
| Membership administration | IN PROGRESS | Commercial and Founding admin surfaces exist; operational acceptance required |
| Unified admin dashboard for memberships, Brief publication, support and operational status | BACKLOG | Reuse existing admin surfaces; define roles, auditability and operational scope |
| Support administration | BACKLOG | Define roles, queues, access and audit trail |
| Operational health monitoring | DECISION REQUIRED | Choose provider, thresholds, owner and escalation |
| Renewal and annual-subscription journeys | BACKLOG | Build after Stripe lifecycle evidence |
| Cancellation feedback | BACKLOG | Define privacy, retention and non-coercive experience |
| Customer-support ownership and recovery | DECISION REQUIRED | Name owners, hours, escalation and recovery targets |
| Controlled social and Brief automation | BACKLOG | Human oversight, auditability and safe shutdown required |

## Phase 7 — Brand and delight

| Approved item | Status | Current evidence or next gate |
|---|---|---|
| Black, emerald and gold brand system | DONE | Current public and protected design system |
| Preserve supplied logos and approved graphics | IN PROGRESS | Existing production brand assets retained; replacements require visual approval |
| Restrained premium motion and hover states | IN PROGRESS | Existing motion respects reduced-motion; final authenticated review required |
| Golden Egg/Easter Hunt | IN PROGRESS | Feature-flagged implementation exists; discovery, persistence and accessibility require preview verification |
| Hidden smile/Easter interaction and five-tap logo brand moment | BACKLOG | Use only approved quote/brand content; keep accessible and away from trading controls |
| Reduced-motion support | IN PROGRESS | Implemented contracts require authenticated acceptance |
| Mobile-first installable experience | IN PROGRESS | PWA exists; final physical-device matrix remains open |

## Public website and trust continuity

| Approved item | Status | Current evidence or next gate |
|---|---|---|
| Homepage, Pricing, Login, About, Contact, Blog and branded 404 | DONE | Implemented launch-candidate surfaces |
| Canonical Membership destination | DONE | `/membership` resolves to Pricing |
| Proper Membership sales page if Pricing is not retained as canonical | BACKLOG | Current decision uses Pricing; revisit only if the canonical destination changes |
| FAQ, trust, methodology and transparent “what we are / are not” content | BACKLOG | Derive from approved product and legal positioning |
| Legal and risk pages | DECISION REQUIRED | Implemented drafts require final approval |
| SEO and discovery assets | DONE | Metadata, Open Graph, structured data, sitemap, robots and icons recorded |
| Performance, analytics consent and launch monitoring | BLOCKED | Deployed measurements and business/vendor decisions required |

## Cost-control and delivery controls

| Required rule | Status |
|---|---|
| No open-ended “continue autonomously” sessions | DONE |
| Each paid coding run has one measurable objective, named files, stop condition and maximum scope | DONE |
| Every session ends with changed files, commit SHA, test/build results, preview URL and blockers | IN PROGRESS |
| Do not commission another audit until the previous audit’s concrete fixes are visibly deployed | DONE |
| Prioritise first paying subscribers over low-value feature expansion | IN PROGRESS |
| Do not add a paid provider without explicit approval | DONE |
| Do not expose secrets or invent data, events, performance or customer claims | DONE |
| Do not merge or deploy production without explicit approval | DONE |

## Exact next phase

Remain in Phase 1. The next work is external launch-gate verification, beginning
with passwordless email delivery and callback evidence. Phase 2 must not begin
until Phase 1 is complete, all checks pass, a working preview is verified, and
the user explicitly approves continuation.
