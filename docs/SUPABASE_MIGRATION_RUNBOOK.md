# Supabase Migration Runbook

Do not apply these migrations through application startup or deployment. Apply
them manually to an isolated staging project first.

## Intended order and effect

| Order | Migration | Effect | Destructive or irreversible concern |
|---:|---|---|---|
| 1 | `202607170000_memberships.sql` | Creates canonical memberships table, unique indexes, RLS and own-email read policy | Unique indexes fail if existing normalized emails/customer/subscription IDs conflict. Revokes existing anon/authenticated grants and replaces the named policy. |
| 2 | `202607170001_progressive_access_previews.sql` | Creates server-only preview-claim table and uniqueness | Dropping it later loses preview-consumption history and could allow previews to be reclaimed. |
| 3 | `202607170002_verified_outcomes.sql` | Creates verified performance-outcome table | Dropping it loses audited outcome history. |
| 4 | `202607170003_operation_launch.sql` | Creates waiting-list and Founding onboarding tables | Dropping loses personal data and onboarding history. |
| 5 | `202607170004_founding_100.sql` | Creates permanent allocation ledger and atomic sync function | Awards and forfeitures are business records. Positions are intentionally never reopened; rollback must not delete awarded rows. |
| 6 | `202607170005_commercial_billing.sql` | Adds nullable billing interval/amount columns and reporting index | Additive. Removing populated columns loses billing/reporting history. |
| 7 | `202607170006_member_onboarding.sql` | Creates member preferences and own-user RLS policy | Dropping loses preferences. Policy replacement changes browser access. |
| 8 | `202607170007_stripe_event_ordering.sql` | Adds event timestamp and server-only membership sync function | Additive schema, but the function performs production entitlement updates. Removing ordering protection risks stale webhook overwrite. |
| 9+ | Later additive migrations (`202607180008` … `202607230011`) | Member onboarding RPC, ideas hub, snapshots/journal, **member_workspace_prefs** | Workspace prefs are additive own-row RLS. **Do not apply `202607230011_member_workspace_prefs.sql` to production automatically** — staging first. App degrades to default desk if missing. |

The SQL contains no `drop table`, `truncate`, mass `delete` or destructive
column conversion. `drop policy if exists` is deliberate policy replacement.
`create or replace function` replaces function definitions. Runtime webhook
calls can irreversibly award or forfeit Founding price locks according to the
documented business rule.

## Backup before staging migration

1. Confirm the project name/reference and environment label in Supabase.
2. If staging is empty, record the project reference and export the pre-migration
   schema as the reproducible baseline.
3. If staging has data, use Supabase **Database → Backups** to confirm a
   restorable backup appropriate to the project plan.
4. Export schema and data using the approved Supabase/Postgres backup method.
5. Store the backup in approved encrypted storage; record only its identifier,
   timestamp and restore owner.
6. Test restoration into a disposable non-production project before treating
   the backup as valid.

## Preflight SQL checks

Run read-only queries in staging and retain sanitized counts only:

```sql
select lower(trim(email)), count(*)
from public.memberships
group by lower(trim(email))
having count(*) > 1;

select stripe_customer_id, count(*)
from public.memberships
where stripe_customer_id is not null
group by stripe_customer_id
having count(*) > 1;

select stripe_subscription_id, count(*)
from public.memberships
where stripe_subscription_id is not null
group by stripe_subscription_id
having count(*) > 1;
```

If `public.memberships` does not exist, record that fact and skip those three
queries. Stop on any duplicate; do not guess which row should survive.

## Exact staging application procedure

1. Open Supabase Dashboard and select the explicitly labelled staging project.
2. Confirm the project reference against the staging release record.
3. Open **Database → Backups** and complete the backup procedure above.
4. Open **SQL Editor → New query**.
5. Copy only `202607170000_memberships.sql`, review the target project again,
   then run it.
6. Inspect the result and Database/Table Editor. Stop on any error.
7. Run the verification checks below.
8. Repeat steps 4–7 for `001`, `002`, `003`, `004`, `005`, `006`, then `007`.
   Never combine all files into one unreviewed batch.
9. Record migration filename, operator, UTC time and sanitized result.
10. Run application staging smoke tests only after all eight verify.

## Verification

- Tables exist with expected constraints and indexes.
- RLS is enabled on every application table.
- Anonymous access to application tables is denied.
- Authenticated users can select only their own membership row.
- Authenticated users can manage only their own `member_onboarding` row.
- Browser roles cannot write memberships or server-managed ledgers.
- Only `service_role` can execute `sync_founding_100` and
  `sync_membership_from_stripe`.
- Concurrent Founding calls serialize per programme and never exceed position
  100.
- Older Stripe event timestamps cannot overwrite newer membership or Founding
  state.

## Rollback and recovery

There is no universal destructive down migration. Choose the safest path:

1. **Before any application traffic:** restore the verified staging backup or
   recreate the disposable staging project.
2. **After test data exists:** stop webhook delivery and staging traffic,
   export current state, identify the failed migration, and prefer a reviewed
   forward-fix migration.
3. **After a Founding award/forfeiture:** never delete or renumber awards to
   “roll back.” Reconcile against Stripe test events and the documented
   permanent-allocation rule.
4. **Production:** do not drop tables, columns, policies or functions during an
   incident. Roll back the application artifact, pause/retry Stripe deliveries,
   and restore or forward-fix only with database-owner approval.

Recovery is complete only after RLS, entitlement, preview uniqueness, Stripe
ordering and Founding concurrency tests pass again.

