# NASH AI Markets Production Operations Pack

This directory is the operator source of truth for taking Project Bullseye from
the approved release candidate into a controlled public launch and operating it
afterwards.

## Documents

- [Architecture](ARCHITECTURE.md) — application boundaries, services, data flow,
  routes, dependencies and deployment shape.
- [Personal trading workspace (BULLSEYE)](BULLSEYE_PERSONAL_TRADING_WORKSPACE.md) —
  market selection → personal desk architecture, prefs migration, widget registry
  and release gate (preview only; no production auto-deploy).
- [Launch playbook](LAUNCH_PLAYBOOK.md) — ordered path from the current state to
  public launch.
- [RC2 final launch report](RC2_FINAL_LAUNCH_REPORT.md) — current evidence,
  remaining gates and the go/no-go recommendation.
- [Public beta launch readiness — 18 July 2026](PUBLIC_BETA_LAUNCH_READINESS_2026-07-18.md)
  — current branch evidence, live-deployment mismatch and remaining external
  gates.
- [Launch readiness checklist](LAUNCH_READINESS_CHECKLIST.md) — final
  application, integration, data, billing, email and monitoring gates.
- [Sprint Epsilon launch report](SPRINT_EPSILON_LAUNCH_READINESS_REPORT.md) —
  evidence, production simulation, blockers, deployment, rollback and
  monitoring recommendations.
- [Deployment checklist](DEPLOYMENT_CHECKLIST.md) — production deployment gate.
- [Staging deployment checklist](STAGING_DEPLOYMENT_CHECKLIST.md) — isolated
  staging configuration, evidence and acceptance sequence.
- [Production environment matrix](PRODUCTION_ENVIRONMENT_MATRIX.md) — exact
  staging/production variable contract, sources and safe validation.
- [Supabase migration runbook](SUPABASE_MIGRATION_RUNBOOK.md) — ordered
  `202607170000`–`202607170007` backup, staging application and recovery.
- [Stripe staging matrix](STRIPE_STAGING_TEST_MATRIX.md) — test-mode commercial,
  lifecycle, replay and Founding concurrency verification.
- [Authentication domain validation](AUTH_DOMAIN_VALIDATION.md) — Supabase Site
  URL, callback, magic-link and environment-separation checks.
- [PWA device checklist](PWA_DEVICE_TEST_CHECKLIST.md) — physical Apple,
  Android, installation, session, update and accessibility validation.
- [Launch gate status](LAUNCH_GATE_STATUS.md) — current classification and the
  safest next operator action.
- [Rollback checklist](ROLLBACK_CHECKLIST.md) — application, configuration,
  database and DNS rollback.
- [Incident runbook](INCIDENT_RUNBOOK.md) — response procedures for Stripe,
  Supabase, provider, authentication and high-error-rate incidents.
- [Environment variables](ENVIRONMENT_VARIABLES.md) — complete implemented
  variable inventory and required/optional status.
- [Production smoke tests](PRODUCTION_SMOKE_TESTS.md) — post-deployment user and
  operations checks.
- [Release checklist](RELEASE_CHECKLIST.md) — repeatable future-release process.
- [Versioning and changelog](VERSIONING.md) — release numbering and changelog
  policy.
- [Known documentation gaps](MISSING_DOCUMENTATION.md) — documents that still
  require business, legal or infrastructure decisions.

## Safety principles

1. Never paste a secret, authenticated provider URL, member email or payment
   detail into Git, screenshots, tickets or incident chat.
2. Market output must remain fail closed when data is preview, unavailable,
   stale, malformed, future-dated or using fallback.
3. A successful checkout return is not proof of entitlement. Stripe webhook
   synchronization and the stored membership record are authoritative.
4. Database migrations and production data changes always require a backup,
   review and explicit operator action. They are never performed by application
   deployment scripts.
5. Roll back application code before attempting an irreversible database
   rollback. Preserve evidence and Stripe webhook delivery.

## Operator commands

Validate that the operations pack covers the implementation:

```sh
npm run ops:validate
```

Check production environment variable presence without displaying values:

```sh
npm run ops:check-env
```

The environment check requires the private-beta Supabase, Stripe, provider and
build-provenance variables. It does not make network calls and does not prove
that credentials are valid.
