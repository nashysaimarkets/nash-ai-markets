# NASH AI Markets Production Operations Pack

This directory is the operator source of truth for taking Project Bullseye from
the current `bullseye-sprint-alpha` state into a controlled private beta and
operating it afterwards.

## Documents

- [Architecture](ARCHITECTURE.md) — application boundaries, services, data flow,
  routes, dependencies and deployment shape.
- [Launch playbook](LAUNCH_PLAYBOOK.md) — ordered path from the current state to
  private beta.
- [Launch readiness checklist](LAUNCH_READINESS_CHECKLIST.md) — final
  application, integration, data, billing, email and monitoring gates.
- [Sprint Epsilon launch report](SPRINT_EPSILON_LAUNCH_READINESS_REPORT.md) —
  evidence, production simulation, blockers, deployment, rollback and
  monitoring recommendations.
- [Deployment checklist](DEPLOYMENT_CHECKLIST.md) — production deployment gate.
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
