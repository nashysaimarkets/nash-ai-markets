# Production Deployment Checklist

Copy this checklist into the release record. Record evidence; do not mark an
item complete from assumption.

## Approval and source

- [ ] Release owner and deployment operator identified.
- [ ] Exact branch and full commit SHA recorded.
- [ ] Working tree clean and remote branch synchronized.
- [ ] Change scope reviewed; unrelated changes excluded.
- [ ] Changelog entry and version decision approved.
- [ ] Rollback commit/artifact and operator identified.

## Data and external services

- [ ] Supabase backup/snapshot completed.
- [ ] Required reviewed migrations already applied or scheduled separately.
- [ ] Apply `202607170005_commercial_billing.sql` after the Founding migration;
      verify existing membership rows are unchanged.
- [ ] Production RLS and grants verified.
- [ ] Supabase Site URL and callback allowlist verified.
- [ ] Stripe mode, products, Price IDs, portal and webhook endpoint verified.
- [ ] Monthly prices are exactly Pro £14.99 and Elite £29.99; annual prices are
      exactly Pro £149 and Elite £299 in the intended Stripe currency/account.
- [ ] Test all four server-created checkout offerings and portal plan changes.
- [ ] Stripe endpoint health and pending deliveries checked.
- [ ] OpenAI diagnostic status checked; deterministic fallback verified.
- [ ] Launch email remains disabled unless provider, sender and dispatch
      implementation are separately approved.
- [ ] Market provider entitlement and current symbol mapping verified.
- [ ] DNS/TLS changes documented with previous values.

## Environment

- [ ] `npm run ops:check-env` passes in the target environment.
- [ ] No secret appears in the repository, logs or release record.
- [ ] Public and server-only variables have correct visibility.
- [ ] Build timestamp, release version, commit SHA and test total match this
      release.
- [ ] Secret rotations since the last release are recorded by name/version only.

## Quality gates

- [ ] `npm run ops:validate`
- [ ] `npm test`
- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] `npm run validate:artifact`
- [ ] `npm run security:scan`
- [ ] Dependency advisory report reviewed; accepted risks recorded.
- [ ] Accessibility and mobile impact reviewed.
- [ ] No preview/fallback/unavailable data can be represented as live.

## Deploy

- [ ] Immutable artifact built from the recorded commit.
- [ ] Deployment started by an authorized operator.
- [ ] Deployment ID and start/end time recorded.
- [ ] No database migration was applied implicitly by deployment.
- [ ] Hosting reports a healthy, terminal deployment.

## Post-deployment

- [ ] Complete `PRODUCTION_SMOKE_TESTS.md`.
- [ ] Verify security headers and HTTPS.
- [ ] Verify diagnostics show the expected commit, version and test total.
- [ ] Verify live provider data only if fresh and authenticated.
- [ ] Verify Stripe webhook deliveries remain successful.
- [ ] Check application, Supabase and provider error rates.
- [ ] Observe at least one normal refresh interval.
- [ ] Release owner declares success or initiates rollback.
