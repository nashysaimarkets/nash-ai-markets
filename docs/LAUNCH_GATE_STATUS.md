# Launch Gate Status

Last evidence review: **2 August 2026**. This record separates repository proof,
private-staging evidence, and work that still requires a paid provider,
third-party configuration, physical-device testing, or business approval.

| Gate | Status | Current evidence / remaining requirement |
|---|---|---|
| Repository tests and type safety | Cleared | 530 unit tests, typecheck, lint, rendered-route tests, artifact validation, production simulation and security scan pass |
| Operations and environment documentation | Cleared | Implemented variable surface matches `ENVIRONMENT_VARIABLES.md`; hosted-only and local-fixture boundaries are documented |
| Isolated private staging | Cleared | Owner-only Sites staging exists at the recorded Bullseye staging origin; production was not changed |
| Isolated staging Supabase project | Cleared | Staging project `pxlqvaddvghjjhenqmdh` is connected; production project identity is excluded from the staged browser artifact |
| Staging schema and member-data protection | Cleared for current schema | Critical member tables have RLS enabled and authenticated read policies; server-only operational tables remain deny-by-default |
| Staging authentication URLs | Cleared | Exact staging Site URL and callback are configured; authenticated Supabase user requests return successfully |
| Primary desktop customer journey | Provisionally accepted | Owner reports Dashboard, Morning Brief, Trading Desk and related navigation working on private staging; repeat automated signed-in walkthrough was unavailable in this review |
| Authentication expiry, reuse and sign-out matrix | Requires staging evidence | Record one-link expiry/reuse, deliberate sign-out, and return-path results without sending repeated email requests |
| Authenticated tablet/mobile/accessibility matrix | Requires staging evidence | Test protected routes on tablet and mobile widths plus keyboard, VoiceOver and TalkBack where available |
| Market-data failure safety | Cleared | Unavailable, delayed, stale, malformed, timeout and provider-failure states remain explicit and fail closed |
| Populated live/delayed session acceptance | Blocked by provider entitlement | Purchase the appropriate FMP entitlement, then verify ES candles, VIX, DXY, Treasury coverage, freshness and provider-call budget in staging |
| OpenAI brief fallback | Cleared in repository | Deterministic fallback and invalid/missing/timeout provider paths pass; connected staging evidence remains part of the populated-session run |
| Stripe test-mode lifecycle | Not configured | Create test Prices, portal and signed webhook; prove upgrade, downgrade, cancel, duplicate and out-of-order event behaviour before billing launch |
| Transactional email delivery | Not launch-cleared | Confirm sender/domain, suppression handling, idempotency and delivery monitoring; avoid repeated magic-link requests during testing |
| Performance adviser backlog | Non-blocking before scale | Add selected foreign-key indexes and optimise auth-policy initialisation after measuring production-like workloads |
| Staging backup/restore and incident drill | Requires operational approval | Record backup, disposable restore, RPO/RTO, rollback owner and escalation path |
| Monitoring and alert ownership | Not configured | Define health monitors, thresholds, test alerts and named response ownership |
| Privacy, retention and vendor register | Requires business/legal approval | Approve processor inventory, retention/deletion rules and customer-facing privacy terms |
| Risk disclaimer and financial-promotion review | Requires qualified approval | Approve launch copy and permitted jurisdictions before public promotion |
| Production DNS, secrets and deployment | Not authorized | Complete every public-launch blocker, select immutable artifact and rollback owner, then obtain an explicit go decision |

## Current decision

**Private staging continues. Public production remains NO-GO.** The product can
continue through visual, workflow, resilience and private-staging acceptance
without buying the data upgrade. It must not represent unavailable data as live,
bypass authentication, enable billing, migrate production, or deploy publicly.

## Next blocking sequence

1. Finish the authenticated tablet/mobile and sign-out/return-path walkthrough.
2. Complete Stripe test-mode and transactional-email acceptance.
3. Purchase FMP only when ready for populated-session acceptance; then run the
   verified symbol, candle, freshness, fail-closed and provider-budget matrix.
4. Complete monitoring, restore, legal and financial-promotion approvals.
5. Run the final private-staging soak and record the explicit public go/no-go.
