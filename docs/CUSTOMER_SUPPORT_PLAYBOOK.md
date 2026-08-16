# Customer Support Playbook — Review Draft

This playbook gives a one-person launch operation a safe, consistent support
workflow. The public route is `hello@nashaimarkets.com`. Chris Nash is the named
primary support owner. The provisional supported-hours default is 09:00–17:00
Europe/London, Monday–Friday excluding UK bank holidays. Richard Nash accepted
the backup role and confirmed the safety handover on 16 August 2026. Mailbox
recovery evidence, retention decision and final published wording remain
required before launch. This draft does not create a contractual service-level
agreement.

## Non-negotiable safety rules

- Never request a password, one-time code, magic-link URL, API key, service-role
  key, webhook secret or full payment-card details.
- Never ask a member to forward an active sign-in email.
- Never disclose whether an unrelated email address has an account or paid tier.
- Never grant paid access from an email claim. Signed Stripe state and the
  protected membership record are authoritative.
- Never relabel delayed, stale, example-only or unavailable data as live to
  resolve a complaint.
- Keep support mail free of raw database rows, provider payloads and secret-
  bearing dashboard links.

## Proposed response targets

These are achievable launch targets, not guaranteed resolution times:

| Category | First response target | Escalation |
|---|---:|---|
| Security, privacy exposure, unsafe market label or materially wrong billing/access | Same business day; treat immediately when observed | Follow `INCIDENT_RUNBOOK.md`; stop invitations for SEV-1 |
| Cannot sign in or access a paid tier | Within 1 business day | Authentication/Supabase owner; billing owner if signed Stripe state differs |
| Payment, cancellation or portal issue | Within 1 business day | Stripe/billing owner; never collect card data by email |
| Market data stale/unavailable | Within 1 business day during supported market days | Provider owner; preserve fail-closed output |
| Product question, feedback or feature request | Within 2 business days | Product owner or Ideas workflow |
| Privacy/data-subject request | Acknowledge within 3 business days | Privacy reviewer; track the applicable legal deadline separately |

Confirm the provisional supported hours and backup contact before accepting paid
members. If no backup is available, do not promise 24/7 support.

## Safe identity verification

1. Prefer a message sent from the email already associated with the account.
2. If the sender uses a different address, provide only general guidance. Ask
   them to contact support from the account address or use a signed-in profile
   route; do not reveal account existence, tier or billing state.
3. For a billing issue, ask only for the approximate charge date and the account
   email. Direct subscription changes to the authenticated Stripe customer
   portal where possible.
4. Do not accept identity documents through ordinary support email unless a
   separately approved privacy process genuinely requires them.
5. Record the minimum support note needed to explain the action; do not copy
   secrets, live links or full provider payloads.

## Triage workflow

1. Record received time, category and a non-sensitive summary.
2. Check whether the issue matches an active incident before troubleshooting the
   individual account.
3. Reproduce only in isolated staging or with sanitized operational evidence.
4. Preserve the relevant fail-closed or membership gate while investigating.
5. State what is confirmed, the safe next action and the next update time.
6. Escalate using `MONITORING_AND_ALERTING_PLAN.md` when a threshold is met.
7. Close only after the member-facing state is verified or the external action
   and owner are clearly recorded.

## Category-specific checks

### Authentication

- Confirm the exact canonical/staging origin and sanitized redirect reason.
- Check sender delivery and Supabase status without generating repeated links.
- Never bypass the membership gate or manually reconstruct a token.

### Billing and access

- Check a sanitized Stripe event ID/status and the normalized membership record.
- Use signed replay/reconciliation procedures; never grant access from checkout
  return parameters or screenshots.
- Route cancellation through the customer portal or the approved support path.

### Market data

- Ask for the displayed source/status and timestamp, not a provider credential.
- Confirm the product stayed delayed/unavailable and the decision engine stayed
  closed.
- Do not diagnose a display licence or entitlement from an HTTP code alone.

### Privacy and deletion

- Acknowledge the request and verify identity using the minimum approved method.
- Identify each relevant system from `PROCESSOR_AND_VENDOR_REGISTER.md`.
- Do not delete billing, security or legal records ad hoc. Follow the approved
  retention schedule and record completion without copying the deleted data.

## Handover and evidence

Before public launch, record outside Git:

- the named primary support owner (Chris Nash) and an agreed backup;
- mailbox MFA/recovery and access-review date;
- published support hours and holiday coverage;
- approved response targets and escalation contacts;
- support-message retention/deletion period;
- three controlled exercises: login failure, billing mismatch in Stripe test
  mode, and stale-provider safe state.

Support is launch-ready only after the forwarding path, reply-from identity,
spam handling and backup access are each verified with non-sensitive tests.
