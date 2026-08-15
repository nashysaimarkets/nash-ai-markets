# Founding Pro £12 activation audit

**Decision: application implementation complete; paid activation remains
NO-GO pending test-mode operational evidence.** The reservation experience can
remain available. The £12 recurring Checkout path must stay closed until an
explicitly test-mode Price is provisioned, private staging is configured, and
the lifecycle matrix passes.

No Stripe Product, Price, subscription, environment variable or customer record
was changed during this audit.

## Confirmed implementation state

- Public copy offers the first 100 verified successful subscribers Founding Pro
  at £12/month and sends them to `/waitlist?plan=founding-pro`.
- Checkout accepts the four standard offerings plus the distinct allowlisted
  `founding_pro_month` offering.
- `founding_pro_month` maps only to the server-side
  `STRIPE_FOUNDING_PRO_PRICE_ID` variable; it does not reuse the standard
  £14.99 Pro monthly Price.
- Webhook membership mapping is fail-closed for unknown Price IDs.
- Checkout retrieves the configured Price and requires it to be active,
  recurring monthly, GBP and exactly 1200 pence before creating a Session.
- Founding allocation is based on the exact validated Founding Price. Standard
  Pro monthly and annual subscriptions cannot consume a Founding Pro place.
- The allocation ledger permanently caps each programme at 100 and does not
  reopen forfeited positions.
- The environment guide, commercial runbook and Stripe staging matrix describe
  the dedicated Founding Price and fail-closed cases.
- Terms describe both Founding Pro and Founding Elite, while the current public
  launch promotion is Founding Pro only.

## Remaining controlled operational work

1. In Stripe **test mode**, create a separate reusable recurring GBP Price for
   £12/month under the approved Pro Product. Do not alter or archive a Price
   used by an existing subscription.
2. Configure `STRIPE_FOUNDING_PRO_PRICE_ID` in private staging only. Never copy
   a test Price ID into live configuration.
3. Execute the acceptance matrix below with Stripe test identities and test
   payment methods, including duplicate, out-of-order and concurrent events.
4. Open the CTA only when all server configuration is present and verified
   remaining capacity is greater than zero. At zero, route new customers to the
   standard £14.99/month offer.
5. Update customer terms after legal approval and before activation.

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

Run the repository gate, create and verify the £12 Price in an explicitly
test-mode Stripe session, configure private staging, execute the expanded Stripe
matrix, review authenticated evidence, and only then make a separate live-mode
activation decision. Never copy a test Price ID into live configuration.
