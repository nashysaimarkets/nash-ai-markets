# Staging Deployment Checklist

Use this checklist for release candidate `1.0.0-rc.2`. Staging must use separate
Supabase and Stripe test-mode resources. Never copy production member data,
service-role keys, webhook secrets or API credentials into evidence.

## 1. Ownership and isolation

- [ ] Name the release owner, staging operator, incident lead and rollback
      operator.
- [ ] Record the exact commit SHA and retain the previous known-good artifact.
- [ ] Confirm the staging hostname is HTTPS and is not a production hostname.
- [ ] Identify the target hosting account/project. The repository builds a
      vinext Cloudflare Worker-style artifact and `.openai/hosting.json`
      declares no D1 or R2 binding; no external hosting account ID is committed.
- [ ] Confirm the Supabase project is staging-only.
- [ ] Confirm Stripe displays **Test mode** before creating or inspecting data.
- [ ] Confirm all credentials are stored in the hosting environment manager,
      not repository files or build logs.

## 2. Supabase preparation

- [ ] Follow `SUPABASE_MIGRATION_RUNBOOK.md` without skipping the schema and
      duplicate-email preflight.
- [ ] Capture a staging backup or a reproducible empty-project baseline.
- [ ] Apply `202607170000` through `202607170007` in order.
- [ ] Verify tables, indexes, constraints, RLS, policies and service-role-only
      functions.
- [ ] Prove anonymous users cannot read or write protected data.
- [ ] Prove an authenticated user can read only the membership row matching the
      verified JWT email.
- [ ] Prove browser roles cannot write memberships, preview claims, verified
      outcomes, waiting-list records, Founding onboarding or Founding awards.

## 3. Environment

- [ ] Enter every **Both / Required** value from
      `PRODUCTION_ENVIRONMENT_MATRIX.md` in the staging environment.
- [ ] Use staging Supabase values, Stripe test-mode values and staging callback
      URLs only.
- [ ] Set build provenance to the exact candidate version, timestamp, commit
      and verified test total.
- [ ] Run `npm run ops:check-env` inside the target build environment.
- [ ] Verify no value is printed while recording the pass/fail result.
- [ ] Leave launch-email configuration empty unless an actual staging delivery
      provider is approved; configuration alone does not send email.

## 4. Authentication and domains

- [ ] Complete `AUTH_DOMAIN_VALIDATION.md`.
- [ ] Configure the staging Site URL and exact staging `/auth/callback` URL.
- [ ] Request and consume a magic link on the staging hostname.
- [ ] Verify expired and reused links fail safely.
- [ ] Verify sign-out ends the session and protected routes return to login.

## 5. Stripe test mode

- [ ] Complete every applicable row in `STRIPE_STAGING_TEST_MATRIX.md`.
- [ ] Verify four GBP recurring Prices: £14.99/month, £29.99/month, £149/year
      and £299/year.
- [ ] Configure a staging webhook endpoint and its test-mode signing secret.
- [ ] Verify checkout, portal, upgrades, downgrades, failure, cancellation,
      duplicate delivery and out-of-order delivery.
- [ ] Verify no Founding programme exceeds 100 permanent positions and
      forfeited positions are never reopened.

## 6. Provider and OpenAI safe states

- [ ] Verify the staging market-provider account is licensed for the required
      data.
- [ ] Verify fresh valid data may be Live and stale/future/malformed data fails
      closed.
- [ ] Verify missing credentials produce Preview/Unavailable, never Live.
- [ ] Verify OpenAI connected and unavailable paths both preserve deterministic
      output; do not record raw provider errors.

## 7. PWA, accessibility and customer journeys

- [ ] Complete `PWA_DEVICE_TEST_CHECKLIST.md` on physical devices.
- [ ] Complete Free, Pro and Elite login-to-output journeys.
- [ ] Verify locked premium output is absent from the DOM.
- [ ] Verify loading, error, empty, delayed, cached, offline and reconnect
      states.
- [ ] Verify keyboard, VoiceOver, TalkBack, 200% zoom and reduced motion.

## 8. Monitoring and observation

- [ ] Select the production monitoring service; the repository currently
      exposes safe diagnostics and a `membership_sync_failure` log category but
      contains no monitoring SDK.
- [ ] Configure uptime, 5xx, latency, Stripe webhook, Supabase, provider
      freshness and OpenAI-degradation alerts.
- [ ] Record alert owners, thresholds and escalation timings.
- [ ] Perform a 48-hour monitored Stripe test-mode soak.

## 9. Release evidence

- [ ] Run tests, TypeScript, ESLint, production build, rendered-output test,
      artifact validation, operations validation and secret scan.
- [ ] Complete the production smoke-test checklist against staging.
- [ ] Attach only sanitized evidence: timestamps, status, test event IDs and
      redacted screenshots.
- [ ] Update `LAUNCH_GATE_STATUS.md`.
- [ ] Hold a documented go/no-go review. Staging success does not authorize
      production deployment.
