# Production Incident Runbook

## Common incident protocol

1. **Acknowledge:** assign incident lead, severity and timestamp.
2. **Protect:** preserve fail-closed behavior and stop unsafe deployments.
3. **Scope:** identify affected routes, tiers, regions and start time.
4. **Observe:** use sanitized application logs, hosting health, Supabase, Stripe
   and `/terminal/diagnostics`. Never share secrets or member payment details.
5. **Mitigate:** choose the least destructive reversible action.
6. **Verify:** run relevant production smoke tests.
7. **Communicate:** state confirmed impact and next update time; do not guess.
8. **Review:** document cause, timeline and preventive action.

Suggested severity:

- **SEV-1:** security exposure, unsafe live-data representation, widespread
  billing corruption or total service loss.
- **SEV-2:** widespread login/access failure, sustained provider outage without
  correct safe state, or high error rate.
- **SEV-3:** limited member impact, degraded optional feature, isolated support
  issue.

## Stripe failures

### Detection

- non-2xx webhook deliveries or retry backlog;
- paid user remains Free or retains access after cancellation/expiry;
- `membership_sync_failure` log category;
- checkout or customer portal unavailable.

### Response

1. Confirm whether checkout, Stripe API or webhook delivery is affected.
2. Verify the webhook endpoint and signing-secret version without displaying
   the secret.
3. Inspect Stripe event IDs and delivery status.
4. Compare the subscription's email, price, status and period end with the
   sanitized Supabase membership record.
5. Correct configuration if wrong, deploy if necessary, then replay failed
   Stripe events from Stripe.
6. Do not manually grant access without an auditable Stripe subscription and an
   approved support procedure.
7. Confirm `last_stripe_event_created_at` rejected any older replay; do not
   bypass the signed webhook synchronization function.

### Recovery checks

- webhook returns 2xx for a signed replay;
- membership tier/status/period end matches Stripe;
- dashboard and terminal show the correct entitlement;
- no raw Stripe or database error is exposed.

## Supabase outage

### Detection

- login, membership, preview or verified-history queries fail;
- dashboard redirects to temporary access-unavailable state;
- elevated Supabase latency or provider incident notice.

### Response

1. Confirm Supabase project and regional status.
2. Separate Auth failure from database/API failure.
3. Do not replace membership checks with permissive access.
4. Preserve current Stripe events; Stripe will retry non-2xx webhook delivery.
5. Pause migrations and schema changes.
6. If a release caused the issue, roll back application/configuration.
7. When service returns, reconcile Stripe subscriptions against memberships and
   review preview claims for the outage window.

### Recovery checks

- magic-link login and session refresh work;
- Free/Pro/Elite resolution and period expiry are correct;
- preview claim uniqueness is intact;
- verified history shows data or a truthful insufficient/unavailable state.

## Market data provider outage

### Detection

- diagnostics show offline/not configured, fallback active, failures, stale
  data, rate limiting or authentication rejection;
- dashboard or terminal displays unavailable/no-trade state.

### Response

1. Open `/terminal/diagnostics` as an entitled Elite operator and record only
   sanitized status fields.
2. Use this fault-isolation order:

   | Signal | Likely fault | Safe next check |
   |---|---|---|
   | Provider/key configuration missing | Deployment configuration | Compare variable names and target environment; never print values |
   | Authentication rejected or plan restricted | Credential/account entitlement | Provider console, key status and subscribed endpoint access |
   | No response, timeout, rate limit or network interruption | Provider/transport | Provider status, quota, latency and approved egress |
   | Response received, schema unrecognised | Provider schema drift | Redacted response shape against adapter contract |
   | HTTP 200, one quote, requested symbol differs | Provider canonical alias | Confirm the request was symbol-scoped; the adapter accepts only a single structurally valid alias |
   | HTTP 402 for one instrument | Provider access restriction | Confirm the endpoint, symbol, account entitlement, and applicable display licence with the provider; 402 alone does not identify a required plan |
   | Schema recognised, instruments missing | Symbols/plan/partial response | Required instrument list and configured symbol mappings |
   | Valid timestamp but stale/future | Provider clock/feed freshness | Provider timestamp, UTC conversion and market-hours context |
   | Provider healthy, cache status hit/coalesced | Normal request reuse | Wait for the 15-second window; do not trigger refresh storms |
   | Server diagnostics healthy, UI unavailable | Rendering/deployment mismatch | Deployed commit, browser console and server-rendered response |

3. Verify provider status, account entitlement and rate-limit state.
4. Confirm key presence without logging it and confirm the base URL contains no
   credential.
5. Inspect sanitized failure category, last successful timestamp and cache
   counters. Counters are per warm server instance and reset on restart.
6. Do not relabel preview, cached, stale or fallback data as live.
7. Do not invent prices, candles, events, levels or guidance.
8. Allow configured retry/backoff; avoid manual refresh storms.
9. Communicate that market intelligence is unavailable and trading output is
   intentionally disabled.

### Recovery checks

- authentication accepted;
- timestamp valid, not future-dated and within the freshness window;
- all five required quotes validate;
- OHLCV remains empty unless a separately validated candle provider is
  implemented; quote success does not satisfy the candle release gate;
- fallback inactive and diagnostics match the snapshot;
- a cache miss performs one provider load and subsequent requests inside the
  15-second window report hit or coalesced without changing the snapshot;
- engines recalculate from the recovered snapshot.

## Authentication failures

### Detection

- magic links not delivered, expired or redirect incorrectly;
- callback exchange fails;
- authenticated routes repeatedly redirect to login;
- sign-out or session refresh fails.

### Response

1. Check Supabase Auth status and configured Site URL/redirect allowlist.
2. Inspect a redacted delivered link's origin and callback path.
3. Check sender-domain SPF/DKIM/DMARC and delivery-provider status.
4. Confirm public Supabase values are present and service-role value was not
   exposed.
5. Never ask a member to forward a live magic link.
6. If configuration changed with the release, restore the previous version and
   redeploy.

### Recovery checks

- new Free user login;
- existing paid user login;
- callback lands on `/dashboard`;
- session persists across dashboard/terminal;
- sign-out ends access.

## High error rates

### Detection

- hosting 5xx rate, client exception rate or latency exceeds the agreed
  threshold;
- repeated dashboard/terminal error boundaries;
- correlated Supabase, Stripe or provider failures.

### Response

1. Identify affected release, route, status code and dependency.
2. Compare with deployment and configuration change times.
3. Protect provider limits by reducing synthetic/manual refresh traffic.
4. Roll back when the current release is the likely cause and mitigation is not
   immediate.
5. If the dependency is external, preserve truthful unavailable states and
   communicate degraded service.
6. Do not include request bodies, credentials or member identifiers in shared
   incident material.

### Recovery checks

- error and latency metrics return to the documented baseline;
- critical smoke tests pass;
- no billing webhook backlog remains;
- diagnostics show correct release and provider state.

## OpenAI degradation

### Detection

- diagnostics report authentication rejected, quota exhausted, rate limited,
  model unavailable, permission denied, timeout or provider unavailable;
- AI Market Brief reports deterministic fallback active.
- dashboard Morning Brief reports deterministic fallback active.

### Response

1. Confirm only that the key and approved model variables are present; never
   print either value.
2. Check the provider status page and account quota through approved operator
   access.
3. Treat `quota_exhausted` as an account billing/credit action, not a request
   retry condition.
4. Do not retry aggressively or disable deterministic market safeguards.
5. Preserve the deterministic brief and communicate that optional evidence
   prioritisation is inactive.
6. Rotate a credential only through the secret manager if exposure or
   revocation is confirmed.

### Recovery checks

- diagnostics report connected without exposing model/account details;
- AI-assisted selection uses only supplied deterministic evidence;
- Morning Brief text contains no invented prices, levels, instructions or
  priorities;
- disabling OpenAI still produces the deterministic brief.

## Launch email failure

Email dispatch is not implemented in the current candidate. If introduced,
failures must not affect waiting-list storage, authentication, billing or
entitlement. Confirm provider status, verified sender, suppression state and
idempotency without logging message bodies or recipient addresses. Do not claim
that a confirmation was sent until the provider has accepted it.
