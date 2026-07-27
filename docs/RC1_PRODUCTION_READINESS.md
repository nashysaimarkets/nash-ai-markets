# RC1 Production Readiness

Version: `1.0.0-rc.1`  
Date: 17 July 2026  
Decision: **NO-GO for public billing until all Critical gates have external evidence**

## Audit outcome

Source boundaries, deterministic market safety, membership entitlement,
Founding allocation, annual billing mapping, onboarding ownership, error
sanitization and secret handling are covered by automated regression tests.
RC1 adds atomic Stripe event ordering, removes development metadata, protects
private routes from indexing and applies immutable caching only to fingerprinted
static assets.

## Deployment checklist

1. Confirm a restorable Supabase backup.
2. Apply reviewed migrations `202607170001` through `202607170007` in order.
3. Verify RLS, service-role-only functions and Stripe event-ordering behavior.
4. Configure all mandatory environment variables from `.env.example`.
5. Verify four Stripe Prices in test mode and the customer portal.
6. Deploy an immutable candidate and run `docs/PRODUCTION_SMOKE_TESTS.md`.
7. Record the known-good rollback artifact and named operator.

## Launch checklist

- Authentication email, callback allowlist and onboarding completion pass.
- Free, Pro and Elite monthly/annual access pass.
- Founding award, retry, concurrency, lapse and capacity exhaustion pass.
- Morning Brief verified generation and every fallback category pass.
- Dashboard, profile, admin and commercial totals reconcile.
- Mobile keyboard, screen-reader and risk-message checks pass.
- Monitoring owners and alert thresholds are recorded.

## Incident recovery

Use `docs/INCIDENT_RUNBOOK.md` and `docs/ROLLBACK_CHECKLIST.md`. Fail closed for
market data, disable checkout entry points for billing incidents, preserve
membership and Founding audit rows, and never run destructive rollback SQL
without a verified backup and incident commander approval.

## Known issues

### Critical

- Production migrations, Stripe test-mode evidence and backup restoration have
  not been performed from this repository.

### High

- Transactional email dispatch and monitoring are not connected.
- Deployed OpenAI, market-provider and authentication smoke evidence is pending.

### Medium

- Physical-device accessibility and deployed Core Web Vitals baselines remain
  manual launch gates.
- Final UK legal review is pending.

### Low

- The Help Centre is intentionally concise until real support demand exists.

## Post-launch monitoring

Monitor authentication failures, Stripe checkout creation, webhook latency and
retries, membership/Founding reconciliation, Supabase errors, market freshness,
OpenAI fallback categories, application error rate, p75 Web Vitals and email
delivery. Assign an owner, warning threshold, critical threshold and escalation
window for every signal before launch.

## Go / no-go

Current engineering readiness is **82%**. RC1 is suitable for staging and
controlled test-mode validation. It is a **no-go for public paid launch** until
the Critical items above are evidenced. After they pass, run a 48-hour monitored
soak and perform a documented go/no-go review.
