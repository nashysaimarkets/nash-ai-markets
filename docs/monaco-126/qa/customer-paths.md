# Customer path contracts — Monaco126

Source: core614371532b19814f8c1ac8bc8e8aed9b10f5ae0f. These describe implemented guarded code, not completed live or signed-device acceptance. Existing owner Sitesv179 paid admission is retained historical evidence. Source/mock contract tests and actual store transactions are separate.

## Web account and billing

```mermaid
flowchart TD
  A[Verified Pocket UUID] --> B[Server customer binding]
  B --> C{Current subscription}
  C -->|Active| D[Return to Pocket]
  C -->|Inactive| E[Stripe Checkout]
  E --> F[Signed webhook]
  F --> G[Identity and event-order checks]
  G --> H[UUID subscription ledger]
  H --> I[Server scan admission]
  B --> J[Same-origin POST portal]
```

Customer selection comes from the durable UUID mapping, never a client ID or email discovery. An active/unknown membership cannot begin a new candidate checkout; this is not a global concurrent-checkout uniqueness claim. The portal permits expired customers to manage billing and redirects only to billing.stripe.com. A metadata-less legacy renewal uses the existing exact subscription/customer pair; malformed asserted ownership is rejected. The proposed SQL successor fixes a reproduced mutable-FOUND guard defect but remains uninstalled.

## Apple proof and account ownership

```mermaid
flowchart TD
  A[Verified Pocket account] --> B[Read-only Apple account check]
  B --> C[Account token for purchase]
  C --> D[StoreKit transaction or restore]
  D --> E[Server signature and status checks]
  E --> F{Proof matches current UUID}
  F -->|Yes| G[Guarded scan route]
  F -->|No or unavailable| H[Hold and recovery]
  D --> I[Local update clears UI access]
  I --> E
```

The native UI shows Restore/Retry when initialization or server verification fails. Pending/unmarked/error events cannot show a purchase offer. Every billed route rechecks verified identity and server entitlement; local StoreKit flags and first-free preferences cannot grant it. A valid independent Apple proof can admit during web-ledger outage; no first-free fallback follows an outage. First-free remains OFF.

Source contracts: tests/pocket-billing-portal.test.ts, pocket-checkout-customer.test.ts, pocket-legacy-renewal.test.ts, pocket-native-subscription-recovery.test.ts and the existing Apple/access suites. No Stripe session, StoreKit purchase, refund or customer mutation occurred in this programme. The new Node/native pin and Sites runtime require separate exact-source/environment acceptance.
