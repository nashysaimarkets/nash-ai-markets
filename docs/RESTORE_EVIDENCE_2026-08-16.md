# Staging Restore Evidence — 16 August 2026

## Decision

**RESTORE READINESS: PASS. FULL DISPOSABLE RESTORE: PENDING.**

This is a read-only and session-temporary assessment of the isolated Bullseye
staging database. It is not evidence that a complete backup has been restored
into a separate project. No production project, persistent staging row,
configuration value, secret, authentication setting or safety control was
changed.

## Target and exclusions

| Item | Recorded value |
|---|---|
| Environment assessed | Supabase staging only |
| Project | `nashaimarkets-staging` |
| Project reference | `pxlqvaddvghjjhenqmdh` |
| Region | `eu-west-2` |
| Health at assessment | `ACTIVE_HEALTHY` |
| PostgreSQL engine | 17; reported version `17.6.1.155` |
| Organisation plan | Free |
| Production-linked project | `opmgzchnmcgnsfwpmysc` — identified and explicitly excluded |
| Supabase branches | None present |
| Persistent writes | None |

## Evidence captured

### Protected application tables

The following 13 application tables existed, had row-level security enabled and
contained zero rows at the time of the assessment:

- `memberships`
- `membership_previews`
- `bullseye_verified_outcomes`
- `launch_waitlist`
- `founding_member_onboarding`
- `founding_100_members`
- `member_onboarding`
- `member_ideas`
- `member_idea_votes`
- `member_idea_comments`
- `member_monthly_votes`
- `market_analysis_snapshots`
- `member_trade_journal`

The empty counts make this a schema-and-controls rehearsal, not a test of
recovering customer records.

### Critical function boundary

Read-only inspection confirmed the deployed function properties below:

| Function | Security mode | Expected executable role | Serialization evidence |
|---|---|---|---|
| `sync_membership_from_stripe` | Definer | `service_role` only | Present |
| `sync_membership_cancellation_from_stripe` | Definer | `service_role` only | Present |
| `sync_founding_100` | Definer | `service_role` only | Present |
| `save_member_onboarding` | Invoker | `authenticated` only | Not applicable |

This confirms the live staging boundary required by the repository: browser
roles cannot execute the Stripe/Founding synchronization functions, while the
signed-in onboarding RPC remains an invoker-scoped member action.

### Migration reconciliation

Supabase reported 15 applied migration-history entries. The repository contains
16 migration files. The repository-only filename is:

`20260804083833_serialize_stripe_membership_sync.sql`

The deployed Stripe and Founding function definitions already contain the
serialization behaviour and restricted grants required by that file. This is
therefore a **history-label reconciliation item**, not evidence that the safety
behaviour is missing. Before any later schema migration, compare the remote
history table and repository filenames through the approved Supabase CLI
workflow; do not re-run the file blindly.

### Temporary restore probe

A transaction-scoped table was created with `ON COMMIT DROP`, populated with one
deterministic row and read back successfully. The returned evidence was:

| Field | Result |
|---|---|
| Restored rows | `1` |
| Label | `schema-and-data-roundtrip` |
| Deterministic hash | `c38346f2f3411a87b39979ed7170c694` |

A separate read-only follow-up confirmed that the probe no longer existed and
the 13 application-table counts were unchanged. This proves that the staging
engine can create, populate, read and clean up a restored object in one safe
session. It does not prove a project backup can be restored.

### Adviser findings

- Supabase security advice reported informational `RLS enabled, no policy`
  findings on intentionally server-only tables. In this design, the absence of
  browser policies is the deny-by-default control.
- Leaked-password protection was reported disabled. Bullseye's current customer
  flow is passwordless. Record the finding for any future password feature; no
  authentication configuration was changed during this assessment.
- Performance advice reported selected unindexed foreign keys, auth-policy
  initialisation opportunities and unused indexes. These are measured-scale
  backlog items, not restore or access-control failures on the empty staging
  dataset.

## Adopted free-plan recovery policy

Until a paid backup feature is justified, Bullseye's minimum launch policy is:

| Control | Launch default | Owner |
|---|---|---|
| Logical backup | Encrypted Supabase CLI/Postgres schema-and-data dump after every approved schema change and at least daily while customer data changes | Chris Nash |
| Backup location | Approved encrypted storage outside the Supabase project; identifiers only in the operations record | Chris Nash |
| Recovery point objective | 24 hours | Chris Nash |
| Database recovery time objective | 8 business hours | Chris Nash |
| Application rollback target | 1 hour when no database restoration is required | Chris Nash |
| Backup operator backup | Richard Nash — accepted and safety handover confirmed | — |

These are conservative operating targets, not a customer SLA. A one-person
operation cannot promise 24/7 restoration.

Supabase's official backup guidance says Free-plan projects should make regular
logical exports with `supabase db dump`; paid daily backups and point-in-time
recovery are separate plan features. Storage objects also need a separate
recovery plan because database backups do not restore the stored files
themselves.

## Exact remaining full-restore gate

A complete proof requires an approved disposable **non-production** target:

1. Install/use the approved Supabase CLI and compatible Postgres tools without
   exposing a database password in Git, chat or logs.
2. Create a logical schema-and-data dump of `nashaimarkets-staging` and store it
   encrypted outside the source project.
3. Restore it into a new disposable project or isolated branch. Never restore
   over staging or production.
4. Verify all 13 tables, RLS state, policies, indexes, function security modes,
   grants, migration history and row counts.
5. Repeat the deterministic round-trip and application authentication/
   entitlement smoke checks against the disposable target.
6. Record start/end time, sanitized backup identifier, operator and result.
7. Remove the disposable target only after evidence is retained and the owner
   confirms it contains no needed data.

No disposable branch/project existed during this assessment, the organisation
was on the Free plan, and the two known projects were staging and the
production-linked project. Creating a possibly chargeable target or overwriting
either known project was outside scope. Consequently the public launch gate
remains closed until this exact rehearsal is completed.

## References

- Supabase, [Database Backups](https://supabase.com/docs/guides/platform/backups)
- Supabase, [Manage database backups](https://supabase.com/docs/guides/platform/upgrading)
- [Supabase migration runbook](SUPABASE_MIGRATION_RUNBOOK.md)
- [Operational ownership](OPERATIONAL_OWNERSHIP.md)
- [Rollback checklist](ROLLBACK_CHECKLIST.md)
