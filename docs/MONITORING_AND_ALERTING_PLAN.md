# Monitoring and Alerting Plan

This is the minimum credit-conscious monitoring contract for Bullseye. It is a
launch plan, not proof that external monitors or alert recipients are already
configured. Record the actual monitor IDs, recipients and test evidence before
public launch.

## Lowest-cost launch shape

1. Use Vercel's existing deployment state and sanitized runtime logs for release
   health. Do not add a client monitoring SDK before consent, retention and cost
   have been approved.
2. Configure one HTTPS uptime service to request `/` and `/login` no more often
   than every five minutes. Expect the canonical HTTPS origin and a successful
   HTML response. Do not include cookies, member details or authentication
   tokens.
3. Keep authenticated journey checks manual on isolated staging at release time.
   Never schedule magic-link generation; it adds mail traffic and can damage
   sender reputation without proving customer availability.
4. Use the existing protected `/terminal/diagnostics` view for operator checks.
   Do not create a second synthetic market-data poller. The application gateway,
   cache and fail-closed states remain the authoritative provider path.
5. Use Stripe, Supabase and Resend's own delivery/health dashboards for their
   respective events. Do not copy raw payloads, member emails, payment details,
   API keys or live authentication links into an alert.
6. Probe `/api/openai/health` only during an authenticated staging acceptance or
   incident investigation. OpenAI enhancement is optional and already falls
   back deterministically, so continuous paid probing is unnecessary.

## Proposed thresholds

| Signal | Trigger | Severity | First action |
|---|---|---|---|
| Public availability | Two consecutive five-minute checks fail on `/` or `/login` | SEV-2 | Confirm the active Vercel deployment and runtime logs; roll back only when the release is implicated |
| Unsafe market presentation | Any preview, stale, unavailable or unlicensed value appears as actionable/live | SEV-1 | Stop invitations and preserve the existing fail-closed state |
| Application errors | 5xx responses exceed 2% for five minutes, or a critical member route fails twice in a controlled check | SEV-2 | Scope route, release and dependency; use sanitized logs |
| Authentication | Two controlled isolated-staging login failures with a known-good address | SEV-2 | Check staging Supabase URL/allowlist and sender delivery; do not generate repeated links |
| Stripe webhook | Any failed or repeatedly retried subscription event | SEV-2; SEV-1 if access or billing is materially wrong | Pause commercial expansion and reconcile signed events against membership state |
| Provider freshness | Required ES/VIX evidence is stale, restricted or unavailable beyond its declared window | Product degraded; SEV-2 only if the UI does not fail closed | Keep decisions unavailable and inspect entitlement/provider status |
| Transactional email | A controlled staging send is rejected, suppressed or not accepted by the provider | SEV-2 before invitations | Keep confirmation promises disabled and inspect sender/suppression state |
| OpenAI enhancement | Health reports quota, provider or model failure | SEV-3 | Preserve deterministic fallback; do not retry aggressively |

These thresholds are deliberately conservative launch defaults. Change them
only after the first cohort establishes a measured baseline.

## Ownership record

The primary and backup owners are named and the safety handover is confirmed.
Keep their offline contact route private; see `OPERATIONAL_OWNERSHIP.md`.

| Responsibility | Named owner | Backup | Acknowledgement target |
|---|---|---|---|
| Release/deployment | Chris Nash | Richard Nash — accepted and briefed | 15 minutes |
| Incident lead | Chris Nash | Richard Nash — accepted and briefed | 15 minutes |
| Authentication/Supabase | Chris Nash | Richard Nash — accepted and briefed | 30 minutes |
| Billing/Stripe | Chris Nash | Richard Nash — accepted and briefed | 15 minutes |
| Market-data provider | Chris Nash | Richard Nash — accepted and briefed | 15 minutes during supported market hours |
| Email/support | Chris Nash | Richard Nash — accepted and briefed | 30 minutes |

If Bullseye launches as a one-person operation, the same named owner may fill
multiple rows, but a backup and an offline contact route are still required for
SEV-1 incidents.

## Alert test evidence

Before the final go/no-go, record:

- uptime monitor ID and one controlled failure/recovery notification;
- Vercel deployment and runtime-log review timestamp;
- one Stripe test-mode failed-delivery alert and successful signed replay;
- one isolated-staging Supabase unavailable-state check;
- one provider stale/unavailable check proving the decision engine stays closed;
- one Resend staging acceptance plus suppression/delivery review, if launch email
  is enabled;
- recipients, acknowledgement time and incident owner for each test.

Never create a production outage, send customer email or weaken a safety control
to test an alert. Use test mode, isolated staging or a reversible monitor target.
