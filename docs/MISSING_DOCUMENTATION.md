# Documentation Still Required

These documents cannot be completed accurately from repository evidence alone.
Assign owners before public launch; items marked beta should be resolved before
private-beta invitations.

| Document | Why it is missing | Target |
|---|---|---|
| Canonical `memberships` schema and migration | Application queries it, but creation SQL is absent | Private beta |
| Production service inventory with account owners | Account/project IDs and owners must not be invented | Private beta |
| DNS record and hostname register | Final domain configuration is external | Private beta |
| Backup/restore policy with RPO/RTO | Depends on Supabase plan and business tolerance | Private beta |
| Monitoring thresholds and on-call rota | No monitoring vendor or service levels are selected | Private beta |
| Stripe event-ordering design | Current webhook does not reject stale events | Private beta |
| Transactional email provider and dispatch design | Templates and readiness diagnostics exist, but no provider, delivery, suppression or idempotency implementation is selected | Private beta if confirmation email is required |
| Data retention and deletion schedule | Requires legal/business decisions | Public launch |
| Data-processing/vendor register | Requires contracts and controller details | Public launch |
| Refund, cancellation and complaint policy | Requires legal/business approval | Private beta |
| Financial-promotion/legal approval record | Requires qualified review for target jurisdictions | Private beta |
| Analytics and cookie-consent decision | No analytics service is implemented | Public launch |
| Customer support handbook | Identity checks, billing disputes and response targets are undefined | Private beta |
| Business continuity and disaster recovery plan | Requires service owners, recovery targets and restore drills | Public launch |
| Provider licensing record and symbol catalogue | Depends on the actual FMP account/contract | Private beta |
| Penetration-test/security review report | Requires independent testing | Public launch |
