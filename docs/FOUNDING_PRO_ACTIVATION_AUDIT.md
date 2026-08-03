# Founding Pro £12 activation audit

**Decision: NO-GO for paid checkout activation.** The reservation experience
can remain available, but the £12 recurring Checkout path must stay closed until
the eligibility and lifecycle controls below are implemented and verified in
Stripe test mode.

No Stripe Product, Price, subscription, environment variable or customer record
was changed during this audit.

## Confirmed current state

- Public copy offers the first 100 verified successful subscribers Founding Pro
  at £12/month and sends them to `/waitlist?plan=founding-pro`.
- Checkout accepts only `pro_month`, `pro_year`, `elite_month` and `elite_year`.
- `pro_month` maps to the existing £14.99 server-side Price variable. There is
  no dedicated £12 Price variable or Checkout offering.
- Webhook membership mapping is fail-closed for unknown Price IDs.
- Founding allocation is currently based on the mapped plan and active status,
  not the exact qualifying Price ID. Consequently, any configured active Pro
  subscription—including Pro annual at £149—can consume a Founding Pro place.
- The allocation ledger permanently caps each programme at 100 and does not
  reopen forfeited positions.
- The approved catalogue, environment guide, production check and Stripe test
  matrix currently describe four standard Prices only.
- Terms describe both Founding Pro and Founding Elite, while the current public
  launch promotion is Founding Pro only.

## Required controlled change

1. In Stripe **test mode**, create a separate reusable recurring GBP Price for
   £12/month under the approved Pro Product. Do not alter or archive a Price
   used by an existing subscription.
2. Add a server-only variable such as `STRIPE_FOUNDING_PRO_PRICE_ID` and a
   distinct allowlisted Checkout offering such as `founding_pro_month`.
3. Preserve the membership result as `pro` / `month` / `1200`, but carry an
   explicit founding-eligible result from the exact matched Price.
4. Change Founding allocation so only an active subscription using the exact
   configured Founding Pro Price can receive a new Pro position. Standard Pro
   monthly and annual subscriptions must never consume the offer.
   Preserve an existing same-plan award created before exact-price eligibility
   was introduced; do not silently revoke legacy member records.
5. Keep allocation fail-closed when the Price is absent, ambiguous, inactive,
   the reported amount or currency is unexpected, or capacity cannot be
   verified.
6. Open the CTA only when all server configuration is present and verified
   remaining capacity is greater than zero. At zero, route new customers to the
   standard £14.99/month offer.
7. Update the environment guide, production check, commercial runbook, Stripe
   test matrix and customer terms before activation.

## Test-mode acceptance gates

- The Founding Pro Checkout Session contains exactly one active recurring GBP
  Price at 1200 pence per month.
- A successful £12 subscription grants Pro and exactly one permanent Founding
  Pro position.
- £14.99 monthly and £149 annual Pro subscriptions grant Pro but no new
  Founding position.
- Unknown, mismatched and ambiguous Prices grant neither access nor a founding
  position.
- Duplicate and out-of-order webhook events remain idempotent.
- Concurrent qualifying purchases never award duplicate positions or exceed
  100.
- Purchase 101 receives the standard offer and no price lock.
- Payment failure, cancellation and lapse remove entitlement and permanently
  forfeit the founding price lock; resubscription does not restore it.
- Upgrade, downgrade, renewal, portal and return-page paths pass the staging
  matrix using test identities and test payment methods only.
- The operator report agrees with the Stripe test catalogue and database ledger
  without exposing customer details in evidence.

## External approvals still required

- Review the existing Stripe Products, Prices and subscriptions before creating
  the test Price, and repeat the audit before any live-mode creation.
- Approve the final meaning of “for life”: the current implementation means
  while the same subscription remains continuously active, not the customer’s
  lifetime after cancellation.
- Legal review must reconcile the Founding Pro-only launch copy with the terms
  that still describe a Founding Elite programme.
- Live activation requires the wider launch gates for authenticated runtime QA,
  billing operations, monitoring, market data, legal and support readiness.

## Activation sequence after approval

Implement the exact-price eligibility change, run the repository gate, create
and verify the £12 Price in Stripe test mode, configure private staging, execute
the expanded Stripe matrix, review authenticated evidence, and only then make a
separate live-mode activation decision. Never copy a test Price ID into live
configuration.
