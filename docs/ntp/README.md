# NTP: Nash Trading Platform — isolated broker groundwork (2026-10-18)

## Identity and rollout
NTP is the owner's **internal successor brand direction** for Pocket Bullseye. Public App Store listing, prices, user entitlements, bundle IDs, route names and release candidate remain unchanged until brand legal clearance and signed device/commerce/scanner acceptance. NTP Intelligence → NTP Terminal → NTP Trade, with the line **Intelligence Before Execution**. Restrained charcoal/deep-navy, ivory, minimal champagne-gold, precise high-contrast typography.

## What this prototype DOES
`app/lib/server/ntp-ig-demo-read-only.ts` creates a minimal **server-side only, demo-host-pinned** IG read-only request layer. It can request account and position JSON via GET, with credentials passed by a separate authorised caller (not implemented). It does not run unless explicitly called, stores no credentials, provides no endpoints to app users, and issues **zero API requests by itself**. Its tests use an injected network mock, never IG.

**No IG login, account connection, balances, real trading, demo dealing, payment, deployment, market data redistribution or broker approval is claimed.** The returned API payload deliberately remains `unknown` pending actual contract validation.

## Mandatory future acceptance before connecting IG
1. Obtain IG's written terms for a third-party multi-user application; personal API access does not imply commercial approval. Obtain lawful live-account-linked DEMO API access via authorised route and secure server-side secret manager (never client JS, repository, screenshots or logs). Review FCA activities/permissions and data redistribution licences.
2. Verify token/session lifecycle, endpoint versions/rate limits, exact account ownership and cross-user isolation with a real authorised demo account. Reject live credentials and LIVE host; implement token rotation/revocation. Credentials in browser or error content = FAIL.
3. Only then add a separately reviewed read-only account dashboard behind opt-in; no portfolio claims without broker response and user authorisation.
4. Optional demo order facility requires a separate module, explicit user confirmation and exhaustive exact EPIC/instrument/quantity/stop/margin/spread/stale-price/timeout/duplicate-order/reconciliation tests, followed by legal approval. **LIVE order execution remains prohibited** without formal partner and regulatory arrangements.
5. Preserve PR #112 exclusive writer and release HOLD; all new work resides on an isolated draft PR. No merge, main edit, deployments, production customer changes, API expense or price changes.

## Tests
`node --test tests/ntp-ig-demo-read-only.test.ts` (Node ≥22). Assertions: no order methods, IG demo origin, GET only, no cache/redirect, header isolation, malformed credential rejection, safe HTTP/network/JSON failures, cancellation.

Sources:
- IG UK API: https://www.ig.com/uk/trading-platforms/trading-apis/how-to-use-ig-api
- IG Labs REST: https://labs.ig.com/rest-trading-api-guide.html
- UK FCA authorisation: https://www.fca.org.uk/firms/authorisation
- Competitor engineering intake: https://github.com/nashysaimarkets/nash-ai-markets/issues/113
- NTP brand control: https://github.com/nashysaimarkets/nash-ai-markets/issues/115
- IG work register: https://github.com/nashysaimarkets/nash-ai-markets/issues/116
