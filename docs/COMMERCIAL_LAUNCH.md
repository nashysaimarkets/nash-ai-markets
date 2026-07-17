# Commercial launch operations

## Approved catalogue

| Tier | Monthly | Annual |
|---|---:|---:|
| Pro | £14.99 | £149 |
| Elite | £29.99 | £299 |

Create four recurring GBP Prices in the intended Stripe account. Do not replace
or archive a Price used by an existing subscription. Configure their IDs in the
four server-only variables documented in `ENVIRONMENT_VARIABLES.md`.

## Deployment order

1. Back up Supabase and apply `202607170004_founding_100.sql`.
2. Apply `202607170005_commercial_billing.sql`; verify it only adds nullable
   reporting fields and an index.
3. Create and verify all four Stripe Prices in test mode.
4. Set the four server-only Price ID variables, Stripe secret, webhook secret,
   portal link and administrator allowlist.
5. Deploy the candidate and test all four checkout paths without live billing.
6. Verify webhook synchronization of plan, interval, amount, period end and
   Founding award.
7. Verify upgrade, downgrade, renewal, payment failure and cancellation in the
   Stripe test clock or test mode.
8. Compare `/admin/commercial` with Stripe and `/admin/founding-100`.

## Revenue definitions

MRR equals active monthly recurring amounts plus active annual amounts divided
by 12. ARR equals active monthly amounts multiplied by 12 plus active annual
amounts. Conversion is active Pro/Elite divided by registered Supabase accounts;
Free is registered accounts without active paid access. These are operational run-rate figures, not
recognized accounting revenue. Missing commercial schema produces an
unavailable state rather than an estimate.

## Emails

Branded templates exist for membership welcome, payment confirmation, Founding
100 confirmation, annual renewal reminder and cancellation. Dispatch remains
disabled until an approved provider, verified sender, event idempotency and
delivery monitoring are configured.
