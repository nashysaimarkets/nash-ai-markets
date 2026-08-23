# Documentation Still Required

These documents cannot be completed accurately from repository evidence alone.
Assign owners before public launch.

| Document | Why it is missing | Target |
|---|---|---|
| Production service inventory with account owners | Account/project IDs and owners must not be invented | Public launch |
| DNS record and hostname register | Final domain configuration is external | Public launch |
| Full disposable restore acceptance | `RESTORE_EVIDENCE_2026-08-16.md` records staging health, RLS/function boundaries, a temporary round-trip and adopted 24-hour RPO/8-business-hour RTO; a logical dump restored into a third non-production target remains | Public launch |
| Monitoring configuration evidence | Chris Nash is primary and Richard Nash is the accepted/briefed backup; external monitor IDs, recipients and tested notifications remain | Public launch |
| Transactional email operational acceptance record | Templates, readiness diagnostics and a dormant fail-closed Resend transport with request validation and idempotency are implemented; verified sender, approved credentials, suppression handling, delivery monitoring and named ownership still require staging evidence | Public launch if confirmation email is enabled |
| Data retention and deletion acceptance | `DATA_RETENTION_AND_RIGHTS_SCHEDULE.md` provides proposed periods, system actions and a 28-day rights target; owner/qualified approval and the synthetic staging exercise remain | Public launch |
| Processor/vendor legal approval record | `PROCESSOR_AND_VENDOR_REGISTER.md` inventories the services and Chris Nash is the operational owner; contracts, controller/processor conclusions, transfers, subprocessors, retention and qualified approval remain external | Public launch |
| Refund, cancellation and complaint policy | Requires legal/business approval | Public launch |
| Financial-promotion/legal approval record | The reviewer questions and low-cost escalation route are documented; a named qualified reviewer and written conclusion for exact target jurisdictions remain | Public launch |
| Cookie/storage deployment acceptance | `COOKIE_AND_DEVICE_STORAGE_INVENTORY.md` covers source and no analytics service is implemented; inspect the exact deployed artifact and approve the strict-necessity/consent classification | Public launch |
| Customer support acceptance record | Chris Nash is primary, Richard Nash is accepted/briefed backup and provisional weekday hours are documented; mailbox recovery, retention and exercise evidence remain external | Public launch |
| Business continuity and disaster recovery plan | Requires service owners, recovery targets and restore drills | Public launch |
| Provider licensing record and symbol catalogue | Depends on the actual FMP account/contract | Public launch |
| Penetration-test/security review report | Requires independent testing | Public launch |
