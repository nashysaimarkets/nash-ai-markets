# Founding 100 operations

## Contract

Founding 100 Pro and Founding 100 Elite each allocate at most 100 positions.
Allocation occurs only from verified Stripe webhook events after a subscription
becomes `active` or `trialing`. The browser cannot award or alter a position.

The checkout subscription price remains locked while the same Stripe
subscription remains continuously active. Cancellation, lapse, or loss of paid
status permanently forfeits the price lock. The earned badge and position remain
in programme history, and a later subscription uses the then-current standard
price. Forfeited positions are never reused.

## Live availability

The public pricing page reads only `programme` and `position` from the
server-side award register. Active and forfeited records both consume their
original position. Counts are therefore `100 - permanently allocated
positions`, independently for Pro and Elite.

No count is calculated in the browser or inferred from Stripe checkout
activity. If the database query fails or returns invalid rows, the public page
shows “Founding places available” without a number. At zero it shows “Founding
allocation full”; the ordinary subscription remains available without the
Founding lifetime price lock.

## Database migration

Apply `supabase/migrations/202607170004_founding_100.sql` after migrations
`202607170001` through `202607170003`:

1. Back up the production database.
2. Open the Supabase SQL editor for the intended production project.
3. Confirm the project identity and paste the migration without modification.
4. Run it once in a transaction.
5. Verify `founding_100_members` has RLS enabled and no client policies.
6. Verify only `service_role` can execute `sync_founding_100`.
7. Send signed Stripe test-mode lifecycle events and confirm award, idempotent
   replay, lapse, and stale-event behaviour before enabling live mode.
8. Compare both pricing-page counts with the restricted administrator register.

The migration is repeatable for the table, indexes, and function. Existing
constraints are created with the table and are not duplicated. It does not
delete or rewrite existing awards.

## Administration

Set `BULLSEYE_ADMIN_EMAILS` to a comma-separated allowlist of authenticated
operator email addresses. The server-only `/admin/founding-100` page reports
remaining positions and the permanent award register. Never expose this
variable with a `NEXT_PUBLIC_` prefix.

## Rollback

Prefer disabling Founding marketing and webhook RPC invocation in a reviewed
release while retaining the award register. Destructive rollback requires a
database backup, removal of the function, and removal of the table; it erases
earned status and must not be performed after awards without a migration and
member communication plan.

## Production risks

- Stripe webhook delivery must be configured and monitored; missed events delay
  assignment.
- Existing paid subscribers are not backfilled automatically.
- Stripe controls the actual subscription price. Changing or replacing a Stripe
  subscription can invalidate commercial price-lock expectations.
- Administrator email allowlists require operational maintenance.
- Concurrent awards are serialized per programme in PostgreSQL to prevent
  oversubscription.
- Public counts are a point-in-time view, not a reservation. Only the atomic
  webhook transaction awards a position.
