# Version 1.0 Public Launch Readiness Checklist

This checklist covers the final public-launch gate. Record evidence against the
exact candidate commit. Do not paste credentials, authenticated URLs, member
emails, payment details or raw provider errors into the release record.

## Application and artifact

- [ ] Working tree is clean and the approved branch/commit is recorded.
- [ ] Tests, strict TypeScript, ESLint, production build, artifact validation,
      operations validation and secret-pattern scan all pass.
- [ ] Build metadata reports the expected version, timestamp, commit and test
      total.
- [ ] Homepage contains no current-looking demonstration prices and checkout
      calls to action use verified deployment configuration.
- [ ] Mobile keyboard, screen-reader, reduced-motion, loading, empty and
      recoverable-error journeys have been checked on the deployed candidate.

## Environment and integrations

- [ ] `npm run ops:check-env` passes in the production build environment.
- [ ] Supabase, Stripe, OpenAI, market-provider and email variables are stored
      in the platform configuration with correct public/server visibility.
- [ ] OpenAI diagnostics report a safe state: connected, not configured,
      authentication rejected, quota exhausted, rate limited, model
      unavailable, permission denied, timeout or provider unavailable.
- [ ] The deterministic market brief remains usable when OpenAI is disabled or
      unavailable.
- [ ] Verified Pro/Elite Morning Brief output is AI-assisted only after strict
      structured validation; Free and unavailable states make no AI request.
- [ ] Rate-limit, timeout, malformed response and provider-error simulations
      preserve the deterministic Morning Brief.
- [ ] Launch email diagnostics remain **Not configured** until both an approved
      transactional provider and sender identity are configured.

## Supabase

- [ ] A restorable backup or snapshot exists.
- [ ] `202607170000_memberships.sql` has been reviewed against the target
      schema and duplicate normalized emails have been checked.
- [ ] Migrations `202607170000` through `202607170007` have been reviewed and
      applied manually in the intended order.
- [ ] RLS is enabled and anonymous/authenticated browser roles cannot read or
      write server-managed preview, outcome, waiting-list or onboarding data.
- [ ] Waiting-list duplicate submission is enumeration-safe.
- [ ] Founding Member onboarding creates only a pending review record and never
      changes membership or billing.

## Stripe and entitlement

- [ ] All four Price IDs match the intended Pro/Elite products and monthly or
      annual billing intervals; server-created checkout is the purchase path.
- [ ] The webhook endpoint has the production signing secret and required event
      subscriptions.
- [ ] Unknown or ambiguous Price IDs fail closed and subscription metadata
      cannot grant a tier.
- [ ] Checkout, renewal, upgrade, failed payment, cancellation and signed replay
      have been tested in Stripe test mode.
- [ ] Stored status and `current_period_end` produce the expected Free, Pro and
      Elite access.
- [ ] Newer then older signed webhook events have been replayed to verify the
      implemented out-of-order event rejection.
- [ ] Apply and verify `202607170004_founding_100.sql`; confirm RLS exposes no
      client policy and only the service role can execute award synchronization.
- [ ] Configure `BULLSEYE_ADMIN_EMAILS`, then verify an ordinary member cannot
      access `/admin/founding-100`.
- [ ] Replay active, duplicate, cancellation, lapse and out-of-order Stripe
      test-mode events; confirm neither programme exceeds 100 positions.
- [ ] Compare public Pro and Elite counts with the administrator register, test
      neutral database-unavailable wording, and verify a full tier continues as
      a standard subscription without Founding price protection.

## Email and onboarding

- [ ] A transactional email provider, verified sender, privacy terms,
      suppression handling and delivery monitoring have been approved.
- [ ] Waiting-list confirmation wording has been reviewed.
- [ ] No confirmation is promised by the UI while delivery is unconfigured.
- [ ] Founding Member welcome is sent only after an accepted review.
- [ ] Email dispatch is idempotent and records provider message status without
      storing secrets in application logs.

## Deployment, rollback and monitoring

- [ ] The immutable candidate artifact and previous known-good artifact exist.
- [ ] Deployment and rollback operators are named.
- [ ] Production smoke tests pass after deployment.
- [ ] Uptime, application errors, Supabase, Stripe webhook failures, provider
      freshness, OpenAI degradation and email delivery failures are monitored.
- [ ] Alert owners, thresholds and escalation timing are recorded.
- [ ] The rollback checklist has been rehearsed without destructive SQL.
- [ ] The first invitation cohort, support hours and post-launch observation
      window are recorded.
