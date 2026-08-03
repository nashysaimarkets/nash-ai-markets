# Stripe Staging Test Matrix

Run only in Stripe **Test mode** with dedicated test identities and Stripe test
payment methods. Never enter a real card or switch to live mode.

## Required configuration

Create or verify four standard recurring GBP Prices plus the isolated launch
Price:

| Offering | Expected amount | Interval | Application variable |
|---|---:|---|---|
| Pro monthly | £14.99 | month | `STRIPE_PRO_PRICE_ID` |
| Elite monthly | £29.99 | month | `STRIPE_ELITE_PRICE_ID` |
| Pro annual | £149.00 | year | `STRIPE_PRO_ANNUAL_PRICE_ID` |
| Elite annual | £299.00 | year | `STRIPE_ELITE_ANNUAL_PRICE_ID` |
| Founding Pro monthly | £12.00 | month | `STRIPE_FOUNDING_PRO_PRICE_ID` |

Configure the customer portal with only approved upgrade, downgrade and
cancellation behavior. Configure the staging webhook endpoint
`https://<staging-host>/api/stripe/webhook` for:

- `checkout.session.completed`;
- `customer.subscription.created`;
- `customer.subscription.updated`;
- `customer.subscription.deleted`;
- `invoice.payment_failed`.

Store that endpoint’s test signing secret as `STRIPE_WEBHOOK_SECRET`.

## Test matrix

| ID | Test action | Expected Stripe result | Expected application/database result |
|---|---|---|---|
| S01 | From staging pricing, select Pro monthly and complete with a dedicated test email | Subscription is active/trialing at GBP 14.99 monthly; signed events deliver 2xx | One normalized membership row: `pro`, `month`, 1499, current period end; dashboard grants current Pro only |
| S02 | Repeat S01 for Elite monthly | GBP 29.99 monthly | `elite`, `month`, 2999; current Elite access |
| S03 | Repeat for Pro annual | GBP 149 yearly | `pro`, `year`, 14900 |
| S04 | Repeat for Elite annual | GBP 299 yearly | `elite`, `year`, 29900 |
| S05 | Submit an unknown offering value directly | No Checkout Session | Redirect to `/pricing?checkout=unavailable`; no membership change |
| S06 | Deliver a valid webhook with an unconfigured Price ID | Stripe retries the endpoint after 500 | No tier is granted; sanitized `membership_sync_failure` only |
| S07 | POST without a valid Stripe signature | Delivery rejected | HTTP 400; no database change or raw error |
| S08 | Replay the same successful event | Stripe records another delivery attempt | Membership remains one row; Founding award remains one position |
| S09 | Deliver a newer subscription update, then replay an older update | Both signed requests are accepted if processing succeeds | `last_stripe_event_created_at` prevents older state overwriting newer state |
| S10 | Upgrade Pro to Elite in portal | Subscription Price becomes configured Elite Price; update event emitted | Membership becomes Elite; active Pro Founding lock is forfeited and any eligible Elite award follows permanent-allocation rules |
| S11 | Downgrade Elite to Pro using configured portal timing | Stripe records immediate or period-end behavior exactly as portal policy | Access follows the actual webhook subscription state; no early inferred downgrade |
| S12 | Change monthly to annual within the same tier | Stripe updates cadence/Price | Same tier, `billing_interval=year`, correct unit amount and period end |
| S13 | Simulate `invoice.payment_failed` | Invoice is failed and event delivered | Membership becomes `past_due`; terminal entitlement fails closed; active Founding price lock is forfeited |
| S14 | Cancel immediately/delete subscription | Deleted/inactive subscription event delivered | Membership status becomes non-entitled; Founding award remains recorded but `forfeited`, lock false |
| S15 | Cancel at period end | Stripe subscription remains active until configured end, then updates/deletes | Access and price lock follow actual active/trialing webhook state; verify exact portal policy |
| S16 | Resubscribe after Founding lapse | New subscription is active | Prior position is not reopened; lapsed member is ineligible for that programme’s lifetime lock |
| S17 | Fill a programme to 100 using isolated staging fixtures, then attempt 101 | All calls are server-side test events | Positions 1–100 only; attempt 101 returns capacity reached and receives standard subscription without price lock |
| S18 | Send concurrent eligible Pro subscription events from separate workers | Signed events may overlap | Advisory transaction lock serializes awards; positions are unique and count never exceeds 100 |
| S19 | Repeat S18 for Elite | Same | Elite allocation independently never exceeds 100 |
| S20 | Forfeit an awarded position, then create a new eligible subscription | New active subscription succeeds | Remaining count does not increase; next position uses permanent allocation history |
| S21 | Open customer portal from dashboard/profile | Correct test customer portal opens | No Stripe IDs or secret-bearing URL is rendered as application data |
| S22 | Return from successful Checkout to `/welcome` | Browser reaches staging origin | Page states verification is pending and does not grant access before webhook synchronization |
| S23 | Cancel Checkout | Browser reaches `/cancelled` | No payment/subscription and no membership change |
| S24 | Complete Founding Pro checkout with its dedicated valid Price | GBP 12 monthly; signed events deliver 2xx | Membership is `pro`, `month`, 1200 and exactly one Founding Pro position is awarded |
| S25 | Complete standard Pro monthly and annual checkouts while Founding capacity remains | Standard subscriptions activate | Pro access is granted but neither purchase consumes a Founding position |
| S26 | Configure the Founding variable to the standard Pro Price ID | No Founding Checkout Session | Ambiguous Price mapping fails closed; no membership or allocation change |
| S27 | In separate test fixtures, use an inactive, non-GBP, non-monthly or non-1200 Price as the Founding variable | No Founding Checkout Session | Price validation fails closed; no membership or allocation change |

## Evidence

Record test ID, UTC time, sanitized Stripe event ID, HTTP result, membership
plan/status/cadence, Founding outcome and operator. Do not record email,
customer/subscription IDs, payment data, secrets or full webhook payloads.

## Acceptance

- Every configured Price maps to exactly one plan and interval.
- Unknown or ambiguous Prices fail closed.
- Signed duplicates are idempotent.
- Older events cannot overwrite newer state.
- Payment failure, cancellation and lapse remove entitlement.
- Founding positions are permanent, concurrency-safe and capped at 100 per
  programme.
- Only the exact active GBP £12 monthly Founding Pro Price can create a new Pro
  founding position; standard Pro Prices never consume capacity.
