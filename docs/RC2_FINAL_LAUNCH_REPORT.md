# NASH AI Markets — RC2 Final Launch Report

Date: 17 July 2026  
Candidate: `1.0.0-rc.2`  
Branch: `bullseye-sprint-alpha`  
Deployment: Not performed

## Executive decision

**Recommendation: NO-GO for public paid launch until the external Critical
gates below have recorded evidence.**

The repository is suitable for an immutable staging candidate. Application,
market-safety, entitlement and PWA controls are mature, but a public paid launch
cannot be approved from source-code evidence alone. Production Supabase,
Stripe, backup, environment and deployed smoke checks remain operator actions.

## Launch readiness

- **Repository and engineering readiness: 96%.**
- **Overall public-launch readiness: 84%.**

The overall score is intentionally capped by unverified production
infrastructure and commercial operations. It must not be increased merely
because automated tests pass.

## RC2 completed

### PWA and launch assets

- Standard Precision Ring production icon in 192 px, 512 px, Apple touch and
  Android maskable forms.
- Static launch artwork for current representative iPhone and iPad dimensions.
- Standalone manifest, iOS metadata and platform installation guidance.
- Secure application-shell service worker that excludes authentication,
  account, billing, administration, live-market and personalised Brief routes.
- Fail-closed offline screen with no cached trading guidance.
- Explicit service-worker update lifecycle; a new worker no longer activates
  itself ahead of the user-approved update action.
- Install/update prompt recovery, dismissal, reduced-motion and mobile layout.
- Physical-device install checklist added to the production smoke tests.

### Premium experience

- One reusable black/gold/electric-blue loading mark across all existing
  asynchronous route loading states.
- Existing skeleton hierarchy, error recovery and safety wording preserved.
- Public Help, waiting-list and Founding onboarding copy no longer describes
  the product as unfinished or private beta.
- Version provenance updated to `1.0.0-rc.2`; environment test totals remain
  deployment-supplied rather than hard-coded in `.env.example`.

### Frozen systems preserved

No changes were made to market engines, provider contracts, FMP integration,
OpenAI grounding, membership logic, Progressive Access, Founding allocation,
Stripe behavior, Supabase persistence, authentication or provenance.

## Remaining issues

### Critical — must pass before public billing

1. **Production Supabase evidence**
   - Confirm and test a restorable backup.
   - Apply reviewed migrations `202607170001` through `202607170007` in order.
   - Verify RLS, service-role-only functions, Founding allocation concurrency
     and Stripe event ordering in the target project.

2. **Stripe production-candidate evidence**
   - Verify all four approved Prices, product mapping, portal configuration and
     signed webhook endpoint in Stripe test mode.
   - Exercise checkout, renewal, upgrade, downgrade, failed payment,
     cancellation, duplicate delivery and out-of-order delivery.
   - Reconcile stored membership and Founding records after every lifecycle.

3. **Target environment and deployed smoke evidence**
   - Configure every mandatory variable using the production secret store.
   - Run `npm run ops:check-env` in the target environment.
   - Build an immutable candidate with exact version, timestamp, commit and test
     total.
   - Deploy to staging only and complete `PRODUCTION_SMOKE_TESTS.md`.

### High — required before broad public access

- Connect production monitoring, alert thresholds, named owners and escalation.
- Validate authentication email delivery and callback allowlists on the final
  hostname.
- Record staging OpenAI and market-provider health/fallback evidence without
  exposing credentials.
- Complete physical iPhone Safari and Android Chrome install/update/offline
  tests plus VoiceOver/TalkBack and keyboard checks.
- Complete final UK legal review of Terms, Privacy, Risk Disclaimer, Founding
  allocation and continuous price-lock wording.

### Medium

- Connect transactional lifecycle email delivery and an idempotent delivery
  ledger before promising automated lifecycle messages.
- Capture deployed Core Web Vitals, error-rate and provider-latency baselines.
- Add automated visual regression coverage for representative phone, tablet
  and laptop breakpoints.
- Confirm the canonical creation history for the legacy `memberships` table in
  production operations documentation.

### Low / post-launch

- Expand Help Centre content from real support demand.
- Add validated provider-backed OHLCV history when available.
- Implement Version 1.1 Founding Edition native icon work only after native
  application foundations exist.

## Validation standard

RC2 is accepted locally only if all of the following pass from the final source
state:

- 226 unit tests.
- Rendered production HTML test.
- Production launch simulation.
- Strict TypeScript.
- ESLint.
- Verified production build.
- Deployment artifact validation.
- Operations-document validation.
- Secret-pattern scan.
- PWA manifest, icon-dimension, worker-cache and install-contract checks.

`ops:check-env` is expected to remain an external target-environment gate. It
must not be made to pass locally with invented production values.

## Go / no-go sequence

1. Approve this RC2 source and record its commit.
2. Complete the three Critical evidence groups.
3. Run a staging smoke test and physical-device PWA pass.
4. Complete at least a 48-hour monitored test-mode soak.
5. Record rollback artifact, operator and decision owner.
6. Hold a final go/no-go review; deploy only after explicit approval.

If any market, entitlement, billing or provenance state is ambiguous, preserve
the current fail-closed behavior and stop the launch.

