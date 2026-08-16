# Operational Ownership and Escalation

Last assigned: **16 August 2026**

This is the canonical named-owner record for the private Bullseye launch
candidate. It assigns the current one-person operating model honestly; it does
not imply 24/7 cover or grant broad routine access to the backup owner.

## Named primary owner

**Chris Nash** is the Project Bullseye business owner and the primary operator
for the launch-candidate responsibilities below.

| Responsibility | Primary | Backup | Target during supported hours |
|---|---|---|---:|
| Public go/no-go and release scope | Chris Nash | Richard Nash — accepted and briefed | 15 minutes for SEV-1/2 |
| Deployment and rollback | Chris Nash | Richard Nash — accepted and briefed | 15 minutes |
| Incident lead and customer-safety decision | Chris Nash | Richard Nash — accepted and briefed | 15 minutes |
| Authentication and Supabase | Chris Nash | Richard Nash — accepted and briefed | 30 minutes |
| Billing and Stripe | Chris Nash | Richard Nash — accepted and briefed | 15 minutes |
| Market-data provider and licence | Chris Nash | Richard Nash — accepted and briefed | 15 minutes during supported market hours |
| Transactional email and customer support | Chris Nash | Richard Nash — accepted and briefed | 30 minutes for operational alerts |
| Backup, restore and continuity | Chris Nash | Richard Nash — accepted and briefed | 30 minutes |
| Privacy operations and data-subject requests | Chris Nash | Richard Nash — accepted and briefed | Same business day triage |
| Physical iOS accessibility acceptance | Chris Nash | Richard Nash — accepted and briefed | Before public launch |
| Physical Android accessibility acceptance | **UNASSIGNED TESTER** | **UNASSIGNED** | Before public launch |

The primary names are assigned. Richard Nash accepted the operational backup
role and confirmed that he read and understood the Bullseye backup handover on
16 August 2026, as reported by Chris Nash. The named-owner and backup-briefing
gate is **CLEARED**. Do not grant broad routine access or store Richard's private
phone, email or recovery details in Git. Keep the offline contact route in the
private operator record.

## Supported-hours default

Until a different schedule is expressly approved and published, operate on a
best-effort basis during **09:00–17:00 Europe/London, Monday–Friday excluding UK
bank holidays**. Do not advertise 24/7 support. Security exposure, unsafe market
presentation and materially wrong billing should be acted on immediately when
observed, but this one-person model cannot guarantee overnight detection.

## Authority boundaries

Chris Nash may:

- stop invitations, paid acquisition or a release when safety evidence fails;
- keep market output unavailable when rights, freshness or validity are not
  proven;
- roll back an application artifact through the documented reversible path;
- coordinate staging-only tests and sanitized evidence collection.

The following still require the specific external or explicit approval stated:

- production deployment, DNS or production configuration change;
- destructive database restoration or migration;
- purchase or customer display of a market-data licence;
- live Stripe activation;
- communication of a regulated financial promotion, if the UK perimeter review
  says approval is required;
- qualified legal/privacy approval.

## External approval roles

These are not operational roles that can be self-assigned through repository
work:

| Review | Responsible reviewer | Status |
|---|---|---|
| UK privacy, consumer terms and retention | Qualified UK privacy/consumer-law reviewer | **UNASSIGNED** |
| FCA perimeter and financial-promotion assessment | Qualified UK financial-services lawyer/compliance professional | **UNASSIGNED** |
| Section 21 approval, only if legally required | FCA-authorised approver with the necessary permission | **UNASSIGNED / SCOPE NOT YET DETERMINED** |

## Minimum backup handover — completed

Richard Nash's confirmed handover covers:

1. how to stop promotion/invitations and identify the active deployment;
2. where the encrypted recovery record is kept;
3. how to reach Vercel, Supabase, Stripe and the support mailbox without sharing
   credentials;
4. the SEV-1 rule: preserve fail-closed behaviour and make no speculative fix;
5. how to contact the primary owner and the qualified reviewer.

No password, secret, customer information or private contact detail was recorded
in Git. The backup does not need routine dashboard access. Least-privilege
emergency access or an offline recovery procedure is preferable.

## Related records

- [Monitoring and alerting plan](MONITORING_AND_ALERTING_PLAN.md)
- [Customer support playbook](CUSTOMER_SUPPORT_PLAYBOOK.md)
- [Incident runbook](INCIDENT_RUNBOOK.md)
- [Restore evidence](RESTORE_EVIDENCE_2026-08-16.md)
- [Legal and privacy approval pack](UK_LEGAL_PRIVACY_APPROVAL_PACK.md)
