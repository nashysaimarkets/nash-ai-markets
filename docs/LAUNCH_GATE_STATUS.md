# Launch Gate Status

Last evidence review: **15 August 2026**. This record separates repository proof,
private-staging evidence, and work that still requires a paid provider,
third-party configuration, physical-device testing, or business approval.

| Gate | Status | Current evidence / remaining requirement |
|---|---|---|
| Repository tests and type safety | Cleared | 530 unit tests, typecheck, lint, rendered-route tests, artifact validation, production simulation and security scan pass |
| Operations and environment documentation | Cleared | Implemented variable surface matches `ENVIRONMENT_VARIABLES.md`; hosted-only and local-fixture boundaries are documented |
| Isolated private staging | Cleared | Owner-only Sites staging exists at the recorded Bullseye staging origin; production was not changed |
| Isolated staging Supabase project | Cleared | The deployed staging browser artifact uses project `pxlqvaddvghjjhenqmdh`; the coded guard expects the same project |
| Staging browser auth artifact | Cleared | Empty cache-bust commit `796686dd956deeb1f9adb7b99ef676bb2baa654d` forced a fresh staging build. The live Supabase host is `pxlqvaddvghjjhenqmdh.supabase.co`, the auth guard is true, and production was untouched |
| Staging schema and member-data protection | Cleared for current schema | Critical member tables have RLS enabled and authenticated read policies; server-only operational tables remain deny-by-default |
| Staging authentication URLs | Cleared | Exact staging Site URL and callback are configured; ChatGPT Sites gate can reach Bullseye `/login` |
| Primary desktop customer journey | Provisionally accepted | Owner reports Dashboard, Morning Brief, Trading Desk and related navigation working on private staging; repeat automated signed-in walkthrough was unavailable in this review |
| Authentication expiry, reuse and sign-out matrix | Partially cleared | Staging sign-in, dashboard and Elite access passed with Supabase 200 responses and no recent auth failures. Expiry/reuse and deliberate sign-out evidence remain |
| Authenticated tablet/mobile/accessibility matrix | Requires staging evidence | Test protected routes on tablet and mobile widths plus keyboard, VoiceOver and TalkBack where available |
| Market-data failure safety | Cleared | Unavailable, delayed, stale, malformed, timeout and provider-failure states remain explicit and fail closed |
| Official zero-cost macro runtime | Cleared for Phase 9 | Commit `dfb97a1757073658d4b094cb0802b2cfe72c56e` integrates isolated `VerifiedMacroContext` on Dashboard, Morning Brief and Trading Desk. Fabricated ES/VIX inputs remain blocked and the directional engine remains fail-closed |
| Populated live/delayed session acceptance | Blocked by display/redistribution entitlement | Obtain written quotes confirming paid customer-facing display and derived-output rights. Prefer the existing FMP adapter only if its separate display licence is the lowest total cost; do not assume a retail API plan grants redistribution. Then verify ES candles, VIX, DXY, Treasury coverage, freshness and provider-call budget in staging |
| OpenAI brief fallback | Cleared in repository | Deterministic fallback and invalid/missing/timeout provider paths pass; connected staging evidence remains part of the populated-session run |
| Stripe test-mode lifecycle | Implementation complete | Application Checkout, portal, webhook, Price env mapping and contract tests are in place. Owner reports Dashboard test Prices, portal and webhook already exist. **Dashboard presence + live lifecycle proof are an external operational checklist**, not an application-development blocker. Do not recreate Stripe objects unless runtime testing proves a break. Optional evidence: `docs/STRIPE_STAGING_TEST_MATRIX.md` when exercising billing |
| Transactional email delivery | Not launch-cleared | Confirm sender/domain, suppression handling, idempotency and delivery monitoring; avoid repeated magic-link requests during testing |
| Performance adviser backlog | Non-blocking before scale | Add selected foreign-key indexes and optimise auth-policy initialisation after measuring production-like workloads |
| Staging backup/restore and incident drill | Requires operational approval | Record backup, disposable restore, RPO/RTO, rollback owner and escalation path |
| Monitoring and alert ownership | Not configured | Define health monitors, thresholds, test alerts and named response ownership |
| Privacy, retention and vendor register | Requires business/legal approval | Approve processor inventory, retention/deletion rules and customer-facing privacy terms |
| Risk disclaimer and financial-promotion review | Requires qualified approval | Approve launch copy and permitted jurisdictions before public promotion |
| Production DNS, secrets and deployment | Not authorized | Complete every public-launch blocker, select immutable artifact and rollback owner, then obtain an explicit go decision |

## Current decision

**Private staging continues. Public production remains NO-GO.** Stripe application
work is treated as complete; further Stripe Dashboard checks are operational and
not an app-development blocker unless runtime billing breaks. The stale staging
auth bundle has been replaced and the core staging sign-in and Elite journey now
pass. The product can continue through device, accessibility, resilience and
private-staging preparation without buying the data upgrade. It must not represent
unavailable data as live, bypass authentication, migrate production, or deploy
publicly.

## Next blocking sequence

1. Finish the authenticated tablet/mobile and sign-out/return-path walkthrough
   (`npm run staging:auth-evidence` once gitignored storage-state is present).
2. Record passwordless-link expiry/reuse evidence without repeated email sends.
3. Confirm transactional-email readiness (sender/domain/suppression) without
   repeated magic-link spam.
4. Obtain written FMP, CME-feed and Cboe/VIX display-rights quotes. Purchase no
   feed until rights and first-cohort economics are confirmed; then run the
   verified symbol, candle, freshness, fail-closed and provider-budget matrix.
5. Complete monitoring, restore, legal and financial-promotion approvals.
6. Run the final private-staging soak and record the explicit public go/no-go.
