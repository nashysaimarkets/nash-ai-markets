# Sprint Epsilon Production Launch Readiness Report

Date: 17 July 2026  
Branch: `bullseye-sprint-alpha`  
Scope: local production candidate; no live billing, migration application or
deployment was performed.

## Executive assessment

**Overall production launch readiness: 70%.**

This percentage is a weighted engineering assessment, not a service guarantee.
Application behavior, deterministic safety, build output and offline integration
contracts are ready. The score remains below launch approval because production
Supabase schema state, Stripe lifecycle behavior, OpenAI quota, monitoring,
backups, legal approval and real-device checks require external evidence.

| Area | Status | Evidence |
|---|---|---|
| Application build and regression safety | Complete | Full automated suite, strict types, lint and production artifact validation |
| Market truthfulness and deterministic engines | Complete | Preview/unavailable/fallback fail closed; no fabricated values |
| OpenAI integration safety | Complete | Structured output, actual Responses health probe and deterministic fallback |
| OpenAI live generation | Blocked externally | HTTP 429 `insufficient_quota` from the configured OpenAI project |
| Authentication contract | Complete locally | Passwordless callback and redirect-bound simulation |
| Authentication production delivery | Needs verification | Supabase URL allowlist, sender delivery and live session smoke test |
| Waiting-list and Founding Member contracts | Complete locally | Validation, paid entitlement, RLS and pending-review simulation |
| Supabase production persistence | Blocked externally | Canonical `memberships` migration is absent; repository migrations are unapplied |
| Stripe code safety | Complete locally | Signature verification and configured Price-ID fail-closed mapping |
| Stripe production lifecycle | Blocked externally | Test-mode purchase, renewal, failure, cancellation, replay and ordering evidence required |
| Responsive/loading/error behavior | Complete statically | Mobile/reduced-motion rules and recoverable boundaries validated |
| Physical accessibility and performance | Needs verification | Screen reader, real devices and deployed Web Vitals require production candidate |
| Deployment and rollback documentation | Complete | Playbook, release, smoke, incident and rollback checklists present |
| Monitoring, backup and operations ownership | Blocked externally | Vendors, alert thresholds, owners, retention and restore evidence are not configured |

## Completed features

- Founding 100 Pro and Elite with atomic server-side allocation, permanent award
  history, continuous-subscription price-lock forfeiture, member badges and
  allowlisted operational reporting.
- Passwordless Supabase authentication with safe callback redirects and
  protected member routes.
- Free, Pro and Elite entitlements, expiry enforcement and progressive previews.
- Stripe-signed membership synchronization with unknown Price IDs failing
  closed.
- Server-managed waiting-list and Founding Member onboarding contracts.
- Provider-backed market gateway with timeout, retry, schema and timestamp
  validation.
- Deterministic intelligence, explainability, decision and trade-planning
  engines.
- Premium responsive terminal, daily dashboard, profile, diagnostics and legal
  states.
- OpenAI-powered Morning Brief using strict structured Responses API output.
- Deterministic Morning Brief fallback for missing configuration, exhausted
  quota, request rate limits, timeouts, invalid output and provider failures.
- Sanitized OpenAI diagnostics that validate the actual Responses generation
  path rather than relying on model-list authentication alone.
- Offline production simulation available through
  `npm run simulate:production`.

## OpenAI investigation

The configured key authenticates, and the selected `gpt-5-mini` request reaches
the Responses API. The corrected minimal request returned:

- HTTP status: `429`
- error type: `insufficient_quota`
- error code: `insufficient_quota`

This is not a model-availability, permission, SDK, environment-loading or
ordinary requests-per-minute failure. The OpenAI project has no available API
quota.

Required external action:

1. In the OpenAI platform, identify the project associated with the configured
   server key.
2. Add or restore API billing/credits and confirm the project usage limit is
   non-zero.
3. Do not replace or expose the key unless the project association is wrong.
4. Restart/redeploy the application if the hosting platform snapshots
   environment variables.
5. Call authenticated `/api/openai/health`; require `connected`.
6. Load a verified Pro/Elite dashboard and confirm **AI assisted** appears.
7. Remove quota again in staging or use a mock to confirm deterministic fallback
   remains visible.

Until then the dashboard remains usable through deterministic output.

## Production simulation coverage

The offline simulation makes no external calls and performs no writes. It
validates:

1. passwordless login, callback exchange, safe redirects and protected routes;
2. structured Morning Brief success and exhausted-quota fallback;
3. waiting-list normalization, duplicate safety and service-role persistence;
4. active paid Founding Member access and expired-membership rejection;
5. Stripe signature verification, configured Price mapping and safe failures;
6. Supabase migration RLS and service-role-only boundaries;
7. dashboard, brief, terminal and onboarding error/loading behavior;
8. mobile, reduced-motion, timeouts, parallel loading, headers and artifact
   validation.

It does not prove external account configuration, email delivery, Stripe
settlement, database schema state, DNS/TLS, real provider licensing or
production performance.

## Remaining blockers

### Must resolve before private beta

1. Create and review the canonical `public.memberships` schema migration.
2. Back up Supabase, then manually review/apply migrations `202607170001`,
   `202607170002` and `202607170003`; verify RLS with browser and service roles.
3. Complete Stripe test-mode checkout, upgrade, failed payment, cancellation,
   duplicate replay and out-of-order delivery validation.
4. Implement durable Stripe event-order protection or formally risk-accept it
   for a tightly controlled beta.
5. Restore OpenAI project quota if AI-assisted summaries are a launch promise.
6. Verify FMP account licensing, symbols and live freshness in the deployed
   environment.
7. Configure backups, a restore drill, uptime/error/provider/webhook alerts,
   named owners and escalation contacts.
8. Obtain legal approval for terms, privacy, refund/cancellation and
   financial-promotion wording.

### May remain unavailable if disclosed

- Transactional waiting-list and Founding Member email delivery is not
  connected; storage and templates are ready, and the UI does not claim an email
  was sent.
- Economic calendar remains unavailable until a verified provider is connected.
- OpenAI may remain unavailable if deterministic fallback is explicitly
  accepted as the beta behavior.

## Deployment steps

1. Name release, deployment, incident and rollback owners.
2. Record the exact candidate commit and previous known-good artifact.
3. Complete the Supabase backup, schema review and manual migration procedure.
4. Configure production Supabase URLs/callbacks and verify magic-link delivery.
5. Configure Stripe products, Price IDs, checkout links, portal and signed
   webhook events in test mode, then production mode only after approval.
6. Configure market-provider credentials and confirm licensing.
7. Restore OpenAI project quota and configure the server-only key; optionally
   set approved model overrides.
8. Set version, build timestamp, commit and verified test total.
9. Run `npm run ops:check-env`, `npm run simulate:production` and the complete
   validation suite in the release environment.
10. Build one immutable artifact, deploy it to a non-public candidate and run
    every production smoke test.
11. Complete keyboard, screen-reader, mobile, Web Vitals, security-header,
    DNS/TLS and external-service checks.
12. Invite the smallest controlled cohort and monitor through the observation
    window before expanding.

## Rollback plan

1. Stop invitations and configuration changes; assign the incident lead.
2. Preserve sanitized logs, deployment ID, Stripe event IDs and diagnostics.
3. Keep market output fail closed when truthfulness is uncertain.
4. Deploy the previous immutable artifact with its compatible environment
   contract.
5. Do not disable the Stripe webhook; allow retry and reconcile after recovery.
6. Prefer forward database repair. Do not drop launch, preview or outcome tables
   without backup, explicit data-owner approval and a reviewed change record.
7. Run critical smoke tests for homepage, login, entitlement, dashboard,
   terminal safe state, webhook and sign-out.
8. Restore recorded DNS/configuration only when application rollback is
   insufficient.

## Post-launch monitoring

- Availability and latency for `/`, `/login`, `/dashboard` and `/terminal`.
- Authentication request, callback and session-refresh failure rates.
- Supabase query failures, latency and connection saturation.
- Stripe webhook 4xx/5xx responses, retry backlog, stale events and membership
  reconciliation drift.
- Market-provider authentication, rate limit, latency, data age, fallback and
  future/stale timestamp rejection.
- OpenAI `quota_exhausted`, `rate_limited`, `permission_denied`,
  `model_unavailable`, timeout and invalid-response categories.
- Dashboard error-boundary activation and deterministic-fallback frequency.
- Waiting-list and onboarding write failures without logging member identities.
- Deployed Web Vitals, client exceptions, mobile overflow and accessibility
  regressions.
- Backup completion, retention and scheduled restore-drill evidence.
