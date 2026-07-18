# NASH AI Markets — Public Beta Launch Readiness

Date: 18 July 2026  
Branch: `agent/fix-free-plan-email-link`  
Decision: **Source candidate ready; public beta remains NO-GO until external gates are evidenced**

## Executive summary

The current branch is a production-quality source candidate for a controlled
staging deployment. The authenticated member experience, premium entitlement
presentation, billing handoff, onboarding, market-safety behavior, SEO, PWA and
operations contracts are implemented and pass the complete local release suite.

The public domain is not yet running this candidate. A live inspection on
18 July 2026 returned the earlier homepage title, `NASH AI Markets | S&P 500
Pre-Market Intelligence`, rather than the current Mission Control metadata.
Production must therefore not be described as updated until an immutable build
from this branch is deployed and verified.

## Completed in the current candidate

- Premium Mission Control homepage, responsive member dashboard and account hub.
- Profile identity, subscription status, security guidance and editable
  workspace preferences with existing choices preloaded.
- Free, Pro and Elite capability map with fail-closed server-side entitlement
  enforcement and bounded previews.
- Authenticated Stripe Checkout prefilled from the verified member email.
- Checkout return URLs no longer expose unused Stripe session identifiers.
- Account-specific Stripe customer portal sessions created only for an
  authenticated member with a matching stored customer identifier.
- Signed Stripe webhook processing, strict Price mapping, event ordering,
  lifecycle synchronization and permanent Founding 100 allocation rules.
- Provider-backed market presentation with freshness, provenance, fallback and
  no-trade safety controls.
- Passwordless cross-device authentication, onboarding persistence and
  same-origin protection for browser writes.
- Search metadata, canonical URLs, Open Graph data, sitemap, robots exclusions,
  PWA installation/offline behavior and security headers.
- Secret-pattern scanning and deployment/operations contract validation.

## Verified release evidence

- 234 unit tests passed.
- Production build passed and generated the expected Worker artifact.
- Rendered production HTML metadata test passed.
- Eight production-launch simulations passed.
- Strict TypeScript and ESLint passed.
- Deployment artifact validation passed.
- Operations documentation validation passed.
- Secret-pattern scan passed across 230 version-control candidates.
- Physical phone PWA install and offline behavior were previously confirmed by
  the operator; this does not replace a full device/accessibility matrix.

## Critical blockers before public beta

1. **Deploy the approved candidate**
   - Merge or explicitly promote this branch.
   - Build from the recorded commit and deploy that immutable artifact.
   - Confirm the production domain reports the approved commit and current
     Mission Control metadata.

2. **Production Supabase evidence**
   - Verify a restorable backup.
   - Confirm migrations `202607170000` through `202607170007` are applied in
     order.
   - Verify RLS, service-role functions, membership reads, preview claims,
     onboarding writes, Stripe ordering and Founding concurrency.

3. **Stripe lifecycle evidence**
   - Confirm the four configured Prices, billing portal policy and signed
     webhook endpoint in the intended Stripe mode.
   - Complete checkout, renewal, upgrade, downgrade, failed payment,
     cancellation, duplicate delivery and out-of-order delivery tests.
   - Confirm each resulting membership and Founding record in Supabase.

4. **Authentication and email evidence**
   - Confirm the Resend sending domain is verified and Supabase SMTP uses the
     approved credentials without exposing them.
   - Verify sign-in delivery, callback allowlists, expiry, one-time use and
     sign-out on phone and laptop.

5. **Market-data approval**
   - Confirm the FMP account plan permits the intended commercial display,
     symbols and refresh behavior.
   - Run live, delayed, stale, future-dated, rate-limit and outage smoke tests
     against the deployed candidate.

## Business and operational decisions still required

- Approve the launch jurisdictions, Terms, Privacy, Risk Disclaimer, financial
  promotion wording and vendor/processor register.
- Choose an error-monitoring service, alert thresholds, on-call owner and
  incident escalation timing.
- Decide whether privacy-respecting product analytics are required for beta,
  and approve the consent/retention policy before adding any tracker.
- Approve RPO/RTO, backup owner and rollback decision owner.
- Confirm support ownership and response expectations for billing and access
  incidents.

## Recommended launch sequence

1. Merge/promote the current branch and record its commit.
2. Deploy to a staging environment with production-equivalent configuration.
3. Complete the Supabase, Stripe, authentication, market-data and device test
   matrices without sharing credentials in tickets or chat.
4. Run a monitored 48-hour test-mode soak and resolve all severity-one and
   severity-two findings.
5. Record the immutable production artifact, rollback artifact and named
   operators.
6. Hold a final go/no-go review, deploy, then execute the production smoke and
   rollback checklists.

Until those external gates are recorded, the accurate status is:
**engineering candidate ready; public beta not yet authorized**.
