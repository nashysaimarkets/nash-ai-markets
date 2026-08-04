# Launch Gate Status

Last evidence review: **4 August 2026**. This record separates repository proof,
private-staging evidence, and work that still requires a paid provider,
third-party configuration, physical-device testing, or business approval.

| Gate | Status | Current evidence / remaining requirement |
|---|---|---|
| Repository tests and type safety | Cleared | 530 unit tests, typecheck, lint, rendered-route tests, artifact validation, production simulation and security scan pass |
| Operations and environment documentation | Cleared | Implemented variable surface matches `ENVIRONMENT_VARIABLES.md`; hosted-only and local-fixture boundaries are documented |
| Isolated private staging | Cleared | Owner-only Sites staging exists at the recorded Bullseye staging origin; production was not changed |
| Isolated staging Supabase project | Settings verified | Sites Settings use project `pxlqvaddvghjjhenqmdh`; coded guard expects the same. **Live browser artifact is stale** (see next row) |
| Staging browser auth artifact | Blocked — Sites redeploy | Live `/login` chunk still inlines `opmgzchnmcgnsfwpmysc`; guard correctly blocks magic links. Local vinext build with `NEXT_PUBLIC_SUPABASE_URL=https://pxlqvaddvghjjhenqmdh.supabase.co` produced login chunks with `pxlqv…` and **zero** `opmgz…`. **No code/Stripe/Supabase/production change required.** Redeploy blocked by ChatGPT Work usage until **8 Aug 2026 23:42**. Follow `docs/STAGING_REDEPLOY_AFTER_USAGE_RESET.md` |
| Staging schema and member-data protection | Cleared for current schema | Critical member tables have RLS enabled and authenticated read policies; server-only operational tables remain deny-by-default |
| Staging authentication URLs | Cleared | Exact staging Site URL and callback are configured; ChatGPT Sites gate can reach Bullseye `/login` |
| Primary desktop customer journey | Provisionally accepted | Owner reports Dashboard, Morning Brief, Trading Desk and related navigation working on private staging; repeat automated signed-in walkthrough was unavailable in this review |
| Authentication expiry, reuse and sign-out matrix | Requires staging evidence | Record one-link expiry/reuse, deliberate sign-out, and return-path results without sending repeated email requests |
| Authenticated tablet/mobile/accessibility matrix | Requires staging evidence | Test protected routes on tablet and mobile widths plus keyboard, VoiceOver and TalkBack where available |
| Market-data failure safety | Cleared | Unavailable, delayed, stale, malformed, timeout and provider-failure states remain explicit and fail closed |
| Populated live/delayed session acceptance | Blocked by provider entitlement | Purchase the appropriate FMP entitlement, then verify ES candles, VIX, DXY, Treasury coverage, freshness and provider-call budget in staging |
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
not an app-development blocker unless runtime billing breaks. Staging magic-link
is blocked only by a **stale browser bundle** vs correct Sites Settings — wait for
Work usage reset, then rebuild/redeploy staging only. The product can continue
through visual, workflow, resilience and private-staging preparation without
buying the data upgrade. It must not represent unavailable data as live, bypass
authentication, migrate production, or deploy publicly.

## Next blocking sequence

1. After **8 Aug 2026 23:42**, rebuild and redeploy staging Sites using
   `docs/STAGING_REDEPLOY_AFTER_USAGE_RESET.md`. Confirm live login chunk has
   `pxlqv…`, no `opmgz…`, and `data-auth-redirect-ready="true"` before any OTP.
2. Finish the authenticated tablet/mobile and sign-out/return-path walkthrough
   (`npm run staging:auth-evidence` once gitignored storage-state is present).
3. Confirm transactional-email readiness (sender/domain/suppression) without
   repeated magic-link spam.
4. Purchase FMP only when ready for populated-session acceptance; then run the
   verified symbol, candle, freshness, fail-closed and provider-budget matrix.
5. Complete monitoring, restore, legal and financial-promotion approvals.
6. Run the final private-staging soak and record the explicit public go/no-go.
