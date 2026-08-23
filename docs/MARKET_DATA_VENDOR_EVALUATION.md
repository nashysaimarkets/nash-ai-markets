# Market-Data Vendor Evaluation — Bullseye

Use this sheet only after a vendor answers in writing. It prevents a low headline
API price from hiding exchange, display, per-user, redistribution, derived-use or
minimum-term costs. No provider is approved until every mandatory right is
unambiguous.

## Required product scope

The smallest useful Bullseye launch package is:

- CME E-mini S&P 500 futures (ES) verified 5-minute OHLCV history and a current
  delayed or real-time quote;
- the official Cboe Volatility Index (VIX) value, not an unrelated proxy;
- explicit observation timestamps and instrument identity;
- customer-facing web display behind authenticated membership;
- sufficient history to render the declared chart windows;
- predictable request/concurrent-connection limits for a small first cohort.

DXY, US Treasury yields and economic-event context may continue through the
existing verified official macro paths where coverage and terms allow. Do not
buy duplicate feeds merely to make a vendor bundle look fuller.

## Mandatory written rights

Require a clear **yes/no** plus the applicable contract clause or product name
for each item:

1. Display ES prices and 5-minute candles to paying end users in a browser.
2. Display the official VIX index value to those users.
3. Use the displayed inputs in Bullseye's deterministic derived commentary,
   freshness labels, levels and evidence summaries.
4. Cache/coalesce requests server-side for the documented short operational
   window and retain only the history the product is licensed to show.
5. Show delayed/archived values in member reports and session replay.
6. Use clearly labelled screenshots or short recordings in product marketing;
   if not allowed, confirm that all promotional assets must remain deterministic
   example-only.
7. Serve users in the intended jurisdictions and under the expected B2C SaaS
   model.
8. Apply the required attribution, exchange agreements and end-user reporting.

Any ambiguity on ES/CME or VIX/Cboe display rights is an automatic **NO-GO**,
regardless of API access.

## Total-cost questions

Record every amount separately:

- platform/API fee;
- CME and Cboe exchange/licensing fee;
- professional/non-professional end-user fee or declaration requirement;
- per-user, concurrent-display or device fee;
- historical-data fee;
- bandwidth, message, request or WebSocket overage;
- onboarding, legal, audit or minimum-commit fee;
- VAT/tax treatment;
- trial/startup discount and its expiry;
- initial term, renewal, notice period and termination cost.

Never compare vendors using only the advertised developer-plan price.

## Technical acceptance

After contractual clearance, verify in isolated staging:

| Check | Pass condition |
|---|---|
| Instrument identity | Vendor catalogue and response identify the intended ES contract/continuous series and official VIX index |
| Timestamp | Observation timestamp is present, UTC-normalized and never materially future-dated |
| Candle integrity | 5-minute OHLCV is ordered, deduplicated, structurally valid and limited to the licensed window |
| Freshness | Declared delay matches measured age and the UI never labels delayed data live |
| Failure safety | 401/402/403/429, timeout, malformed, stale and partial responses keep the decision engine closed |
| Budget | One app refresh uses the documented gateway/cache path; repeated clients do not create a provider refresh storm |
| Attribution | Required provider/exchange wording is present exactly where the contract requires it |
| Exit | Removing the key/provider returns Bullseye to truthful unavailable states without breaking the free workflow |

## Credit-saving scorecard

Score only vendors that pass every mandatory right. Use 0–5 for each weighted
category:

| Category | Weight |
|---|---:|
| Total first-year cost for the first realistic cohort | 35% |
| ES and VIX rights clarity/coverage | 30% |
| Predictable request and connection budget | 15% |
| Integration fit with the existing normalized gateway | 10% |
| Support, incident terms and clean exit | 10% |

Prefer delayed data if it materially lowers cost and the exact delay is licensed
and disclosed. Do not pay for tick/depth data, hundreds of markets or a second AI
service that Bullseye does not need for the S&P 500 decision workflow.

## Current enquiry state — 16 August 2026

| Vendor/route | Current response | Launch decision |
|---|---|---|
| Financial Modeling Prep | Enquiry sent; required commercial display rights and total price not confirmed | HOLD |
| CME | Enquiry sent; no usable written quote recorded | HOLD |
| Cboe | Enquiry sent; no usable written quote recorded | HOLD |
| Intrinio | Preliminary general plan information received; ES/VIX products, display/derived/caching/promotional rights and total fees remain unconfirmed | HOLD |
| Barchart | Enquiry sent; no usable written quote recorded | HOLD |
| Databento | Automated availability message only | HOLD |
| dxFeed | Guessed sales mailbox bounced; official business quote form identified at `https://dxfeed.com/contact-sales/`, not yet resubmitted | HOLD |

Do not submit the dxFeed form or any follow-up automatically. Use the mandatory
rights and total-cost questions above, then obtain owner approval before sending.
