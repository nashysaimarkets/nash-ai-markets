# Launch Gate Status

Last evidence review: **16 August 2026**. This record separates repository proof,
private-staging evidence, and work that still requires a paid provider,
third-party configuration, physical-device testing, qualified approval or a
named business owner.

| Gate | Status | Current evidence / remaining requirement |
|---|---|---|
| Repository tests and type safety | Cleared | Dedicated GitHub Actions quality gate passes secret scan, typecheck, lint, **617 unit tests**, 4 component-render tests, 8 production-safeguard simulations, operations validation, verified artifact build and rendered-artifact tests |
| Operations and environment documentation | Cleared | Implemented variable surface matches `ENVIRONMENT_VARIABLES.md`; Resend, audit-only, hosted-only and local-fixture boundaries are documented |
| Isolated private staging | Cleared | Owner-only Sites/Vercel preview paths exist for the Bullseye launch candidate; production was not changed |
| Private marketing walkthrough | Cleared for visual review | Dashboard, Morning Brief, Trading Desk, Ideas, Reviews, Profile and Preferences now use the real Bullseye presentation with deterministic example-only data; the route is production-blocked, noindex and write-isolated |
| Isolated staging Supabase project | Cleared | The deployed staging browser artifact uses project `pxlqvaddvghjjhenqmdh`; the coded guard expects the same project |
| Staging browser auth artifact | Cleared | Empty cache-bust commit `796686dd956deeb1f9adb7b99ef676bb2baa654d` forced a fresh staging build. The live Supabase host is `pxlqvaddvghjjhenqmdh.supabase.co`, the auth guard is true, and production was untouched |
| Staging schema and member-data protection | Cleared for current schema | Critical member tables have RLS enabled and authenticated read policies; server-only operational tables remain deny-by-default |
| Staging authentication URLs | Cleared | Exact staging Site URL and callback are configured; the owner-only gate can reach Bullseye `/login` |
| Primary desktop customer journey | Provisionally accepted | Owner reports Dashboard, Morning Brief, Trading Desk and related navigation working on private staging; repeat automated signed-in walkthrough remains an evidence task |
| Private Vercel preview authentication, reuse and sign-out | Security mechanics passed; repository isolation guard added; deployment evidence pending | On 16 August 2026 one request on the private feature preview delivered one link, authenticated the owner account and returned to protected `/dashboard`. Deliberate sign-out ended the session; a direct `/dashboard` request returned to `/login`; reusing the same link produced `error=signin&reason=missing`; and a final `/dashboard` request remained unauthenticated. Supabase's project list confirms the preview's baked `opmgzchnmcgnsfwpmysc` provider is named `nashaimarkets Project`, while `pxlqvaddvghjjhenqmdh` is `nashaimarkets-staging`. The test therefore exercised the production-linked auth service once and is not isolated-staging acceptance. The feature branch now makes all Vercel deployment URLs require the staging provider before OTP submission, while canonical production origins retain their existing behaviour. **93 focused auth, trust, navigation, preview-isolation, PWA and resilience tests pass locally**; connected CI/build and private-preview proof remain. No second email was sent; the session was signed out and the link invalidated. No provider configuration was changed |
| Authenticated tablet/mobile/accessibility matrix | Partially cleared | Owner reported **PHONE PASS** on the private example preview on 16 August 2026, including page navigation and the repaired auto-closing member menu. Authenticated tablet/mobile protected routes, tablet width, keyboard, VoiceOver and TalkBack evidence remain |
| Market-data failure safety | Cleared | Unavailable, delayed, stale, malformed, timeout and provider-failure states remain explicit and fail closed |
| Official zero-cost macro runtime | Cleared for Phase 9 | Commit `dfb97a1757073658d4b094cb0802b2cfe72c56e` integrates isolated `VerifiedMacroContext` on Dashboard, Morning Brief and Trading Desk. Fabricated ES/VIX inputs remain blocked and the directional engine remains fail closed |
| Populated live/delayed session acceptance | Blocked by display/redistribution entitlement | Obtain written quotes confirming paid customer-facing display and derived-output rights. Prefer the existing FMP adapter only if its separate display licence is the lowest total cost; do not assume a retail API plan grants redistribution. Then verify ES candles, VIX, DXY, Treasury coverage, freshness and provider-call budget in staging |
| OpenAI brief fallback | Cleared in repository | Deterministic fallback and invalid/missing/timeout provider paths pass; connected staging evidence remains part of the populated-session run |
| Stripe test-mode lifecycle | Implementation complete | Application Checkout, portal, webhook, Price environment mapping and contract tests are in place. Dashboard presence plus live lifecycle proof are an external operational checklist, not an application-development blocker. Do not recreate Stripe objects unless runtime testing proves a break |
| Transactional email delivery | Not launch-cleared | Dormant Resend transport and idempotent templates are implemented. Confirm verified sender/domain, suppression handling, delivery monitoring and named ownership; avoid repeated magic-link requests during testing |
| Organic prelaunch marketing | Preparation allowed | Approved launch teaser and private real-layout preview exist. Organic content may point to a truthful waitlist/prelaunch destination once each asset keeps example/delayed labels and risk limits visible |
| Paid advertising | Not launch-cleared | Complete qualified financial-promotion review, platform verification, public landing-page acceptance, privacy/tracking approval and a fixed spend cap. Paid activity must remain waitlist-only until the marketed product capability is actually deliverable |
| Performance adviser backlog | Non-blocking before scale | Add selected foreign-key indexes and optimise auth-policy initialisation after measuring production-like workloads |
| Staging backup/restore and incident drill | Requires operational approval | Record backup, disposable restore, RPO/RTO, rollback owner and escalation path |
| Monitoring and alert ownership | Not configured | Define health monitors, thresholds, test alerts and named response ownership |
| Privacy, retention and vendor register | Requires business/legal approval | Approve processor inventory, retention/deletion rules, advertising/tracking use and customer-facing privacy terms |
| Risk disclaimer and financial-promotion review | Requires qualified approval | Approve launch copy, campaign assets and permitted jurisdictions before public promotion |
| Production DNS, secrets and deployment | Not authorised | Complete every public-launch blocker, select immutable artifact and rollback owner, then obtain an explicit go decision |

## Current decision

**Private staging and compliant prelaunch preparation continue. Public production
and paid subscription acquisition remain NO-GO.** Stripe application work is
treated as complete; further Stripe Dashboard checks are operational and not an
application-development blocker unless runtime billing breaks. The stale staging
auth bundle has been replaced and the core staging sign-in and Elite journey now
pass. The product can continue through device, accessibility, resilience,
marketing-asset and private-staging preparation without buying the data upgrade.
It must not represent unavailable data as live, bypass authentication, migrate
production, deploy publicly, or advertise profit/prediction claims.

## Next blocking sequence

1. Run connected CI/build for the new repository guard, then verify on the resulting private Vercel deployment that `/login` reports the provider mismatch before OTP submission. Use only an inert test address for that fail-closed UI check; do not generate another email. For actual authentication, use the isolated Sites staging origin tied to `pxlqvaddvghjjhenqmdh`.
2. Finish tablet-width, keyboard and VoiceOver/TalkBack evidence (`npm run staging:auth-evidence` once gitignored storage state is present). The private Vercel preview's protected-route, deliberate sign-out, return-path and one-time-link reuse evidence are recorded; the owner-reported private-preview phone navigation pass is also recorded.
3. Record natural passwordless-link time-expiry evidence only if separately required; do not generate repeated email sends merely to duplicate the already-passed reuse control.
4. Confirm transactional-email sender/domain/suppression and delivery monitoring without repeated magic-link spam.
5. Obtain written FMP, CME-feed and Cboe/VIX display-rights quotes. Purchase no feed until rights and first-cohort economics are confirmed; then run the verified symbol, candle, freshness, fail-closed and provider-budget matrix.
6. Complete monitoring, restore, privacy/retention and qualified financial-promotion approvals.
7. Finalise the waitlist landing page, vertical/social creative derivatives, measurement plan and platform-verification position.
8. Run the final private-staging soak and record the explicit public go/no-go.
