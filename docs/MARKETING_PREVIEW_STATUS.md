# Private Marketing Preview — Status and Safety Record

Last verified: **15 August 2026**  
Repository: `nashysaimarkets/nash-ai-markets`  
Branch: `release/bullseye-launch-candidate`  
Behavioural acceptance baseline: `439bdcc13c09ffb9c9070786b406b241d51d8cde`  
Vercel Preview deployment: `dpl_EetoDn4KpowDxiAuGjWynrTcyGJj` — **READY**  
Public production: **UNTOUCHED / NO-GO**

## Purpose

The private marketing walkthrough now shows the actual signed-in Bullseye product presentation rather than a second custom mock design. Deterministic example fixtures replace only the data assembly layer so the product can be demonstrated without claiming unavailable information is live.

## Available walkthrough routes

| View | Private route | Presentation used |
|---|---|---|
| Dashboard | `/marketing-preview?view=dashboard` | Real `MemberShell` + `MarketCommandCentre` |
| Morning Brief | `/marketing-preview?view=brief` | Real `MemberShell` + `MorningMarketBrief` |
| Trading Desk | `/marketing-preview?view=terminal` | Real `MemberShell` + `TradingDeskOS` |
| Ideas | `/marketing-preview?view=ideas` | Real Ideas Hub design system and learning rail |
| Reviews | `/marketing-preview?view=reviews` | Real Reviews library and video archive presentation |
| Profile | `/marketing-preview?view=profile` | Real Profile/account design and subscription status components |
| Preferences | `/marketing-preview?view=preferences` | Real dashboard workspace controls in isolated local state |

Market-facing views accept deterministic example states where supported:

- `state=wait`
- `state=constructive`
- `state=defensive`

## Safety controls

1. The route fails closed with `notFound()` when `VERCEL_ENV === "production"`.
2. Metadata and response headers keep the walkthrough `noindex, nofollow`.
3. Every view carries a prominent **EXAMPLE-ONLY MEMBER EXPERIENCE** banner.
4. Example figures, candles, levels, votes, customer details and billing states are explicitly labelled illustrative.
5. Primary member navigation stays inside `/marketing-preview`.
6. Sign-out is disabled in preview mode.
7. Nested member links and form submissions are guarded so the walkthrough cannot perform account writes or enter protected member actions.
8. Preferences changes remain in component state and are not written to browser or account storage.
9. No live Stripe action, Supabase write, provider call, order execution or customer-data mutation is available from the walkthrough.
10. The signed-in smiley Easter egg remains present as an isolated presentation detail.

## Verification evidence

- Vercel Next.js build compiled successfully.
- TypeScript completed successfully during the Vercel build.
- Static generation and deployment completed successfully.
- Latest preview deployment reached **READY**.
- Dashboard, Morning Brief, Trading Desk, Ideas, Reviews, Profile and Preferences returned successful private-preview responses during the route conversion sequence.
- Latest Ideas response confirmed unique shortlist and roadmap card identifiers.
- Vercel runtime log review found no error, fatal or warning entries for the accepted preview deployment window.
- Production target, DNS, environment variables and live billing were not changed.

## Deliberately unchanged systems

- Production deployment and aliases
- Stripe products, Prices, Checkout, portal, webhook and live billing
- Supabase project/configuration, RLS and authentication behaviour
- Secrets and environment variables
- Market-data provider credentials or entitlement logic
- ES/VIX decision logic, data-safety gates and fail-closed behaviour
- Scheduled jobs and YouTube automation

## Remaining owner acceptance

The walkthrough is technically ready for visual review. Remaining evidence is human/device acceptance rather than another parallel redesign:

1. Review the seven views on phone and desktop.
2. Confirm that the real product styling is suitable for advertising captures.
3. Confirm the three market example states communicate clearly without appearing to be live.
4. Keep public production blocked until the separate launch-gate sequence is complete.

## Rollback

The preview conversion is isolated to the launch-candidate branch. If a regression is found, revert the preview commits or return to the last accepted branch commit before the affected change. Do not roll production forward or alter protected systems as a workaround.
