# NASH AI Markets Production Operations Pack

This directory is the operator source of truth for taking Project Bullseye from
the approved release candidate into a controlled public launch and operating it
afterwards.

## Documents

- [Current Project Bullseye handoff](PROJECT_BULLSEYE_HANDOFF.md) — exact
  canonical checkpoint, protected-staging evidence, safety boundaries and a
  copy-ready prompt for continuing on another device.
- [Architecture](ARCHITECTURE.md) — application boundaries, services, data flow,
  routes, dependencies and deployment shape.
- [Easy YouTube setup (5 steps)](video-automation/CONSOLE_CHECKLIST.md) —
  grandma-simple Google Cloud Console guide for Project BULLSEYE video upload
  (operator-only; separate from customer auth). See also
  `tools/youtube-upload/README.md` and
  [technical handoff](video-automation/CHATGPT_HANDOFF.md).
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
- [Monitoring and alerting plan](MONITORING_AND_ALERTING_PLAN.md) — the
  credit-conscious launch thresholds, ownership record and safe alert-test
  evidence required before public release.
- [Operational ownership](OPERATIONAL_OWNERSHIP.md) — named one-person primary
  responsibilities, authority boundaries and the confirmed Richard Nash backup
  safety handover.
- [Staging restore evidence — 16 August 2026](RESTORE_EVIDENCE_2026-08-16.md) —
  non-destructive staging baseline, RLS/function evidence, temporary round-trip,
  free-plan recovery targets and the remaining disposable full-restore gate.
- [Physical screen-reader acceptance](ACCESSIBILITY_PHYSICAL_ACCEPTANCE.md) —
  existing phone/keyboard evidence and five-check VoiceOver/TalkBack protocols.
- [UK legal and privacy approval pack](UK_LEGAL_PRIVACY_APPROVAL_PACK.md) —
  conservative launch decisions, ICO/FCA review questions, low-cost escalation
  route and the qualified approvals still required.
- [Cookie and device-storage inventory](COOKIE_AND_DEVICE_STORAGE_INVENTORY.md) —
  exact first-party source keys/caches, preliminary classifications and the
  clean-profile deployment audit still required.
- [Data retention and rights schedule](DATA_RETENTION_AND_RIGHTS_SCHEDULE.md) —
  owner-approved short-period schedule, 28-day rights target and exercise state.
- [Staging retention and rights exercise — 16 August 2026](RETENTION_RIGHTS_EXERCISE_2026-08-16.md)
  — synthetic export/correction/deletion evidence and remaining token/provider
  boundary.
- [ICO fee self-assessment — 16 August 2026](ICO_FEE_SELF_ASSESSMENT_2026-08-16.md)
  — official no-fee-yet pre-trading result and mandatory reassessment trigger.
- [Processor and vendor register](PROCESSOR_AND_VENDOR_REGISTER.md) — a
  repository-backed operational register reflecting the completed official-source
  audit, paid-launch blockers and account evidence still required, without
  recording credentials or member identifiers.
- [Vendor privacy evidence — 16 August 2026](VENDOR_PRIVACY_EVIDENCE_2026-08-16.md)
  — official DPA, subprocessor, transfer, location and retention findings plus
  the lowest-cost safe path; account acceptance and qualified approval remain
  pending.
- [Customer support playbook](CUSTOMER_SUPPORT_PLAYBOOK.md) — safe identity,
  triage and escalation guidance plus realistic one-person launch response
  targets awaiting owner approval.
- [Market-data vendor evaluation](MARKET_DATA_VENDOR_EVALUATION.md) — mandatory
  ES/VIX rights, total-cost questions, staging acceptance and a weighted
  credit-saving comparison method.
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
