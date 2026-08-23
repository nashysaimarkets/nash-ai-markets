# Data Retention, Deletion and Rights Schedule — Owner-Approved Operations

Prepared: **16 August 2026**

## Decision

**OWNER-APPROVED FOR OPERATIONS — QUALIFIED LEGAL AND ACCOUNTING REVIEW STILL REQUIRED.**

Chris Nash approved this operational schedule and the 28-day rights-request
target on **16 August 2026**. The schedule deliberately uses short operational
periods where the repository supports them and separates records that may need
longer statutory retention. It must not be treated as approved law/tax advice
until the business's exact legal entity, controller identity and accounting
obligations are confirmed.

## Owner-approved operational schedule

| Record | System(s) | Proposed active retention | Deletion/anonymisation action | Approval note |
|---|---|---|---|---|
| Waitlist request | Supabase; optional launch email provider | Until invitation/decline, then no more than 6 months after the last launch communication | Delete row and delivery metadata unless a suppression record is required | Confirm marketing lawful basis and notice |
| Declined/abandoned Founding onboarding | Supabase | 90 days after decision or abandonment | Delete free-text and preference data; keep only an anonymous operational count | Confirm complaint/dispute needs |
| Account/authentication | Supabase Auth | Active account, then target deletion within 30 days of verified closure request | Revoke sessions and delete/anonymise account/profile subject to required records | Test dependency order before launch |
| Member profile/onboarding preferences | Supabase | Active account | Delete with account within 30 days | Member-edit/reset path should be verified |
| Membership/Stripe identifiers and billing state | Supabase and Stripe | Active subscription plus statutory accounting/dispute period | Minimise Bullseye copy; retain only required transaction evidence, then delete/anonymise | Qualified accountant/consumer-law reviewer must set exact period |
| Founding allocation/price-lock ledger | Supabase and Stripe evidence | Subscription life plus approved dispute/accounting period | Preserve immutable award history while required; anonymise identity when lawful and technically safe | Business rule and legal period require approval |
| Server-side market snapshots and member trade journal | Supabase | While member keeps the content | Delete on member request/account closure within 30 days, subject to backup ageing | Confirm no analytics reuse without separate basis |
| Device-only levels, checklists, journal and workspace | Browser storage/cookie | Until user reset/browser clear; 180 days for workspace cookie | Product clear controls plus browser site-data instructions | Bulk **Clear device data** control still required |
| Return-visit/confidence comparison | Browser local storage | Operational comparison window 36 hours | Replace/clear after window; source currently leaves stale value until later write/reset | Implement expiry deletion or obtain approved classification |
| Support correspondence | ImprovMX routing logs and Gmail | 24 months after ticket closure by default | Delete message/attachment unless security, billing or legal hold applies | Confirm provider retention and mailbox automation |
| Security/incident evidence | Vercel/Supabase/provider logs and private incident record | 12 months for routine sanitized evidence; longer only for active investigation/legal need | Delete/anonymise identifiers and close access | Vendor defaults may override; document them |
| Transactional delivery/suppression metadata | Resend and private operations record | Delivery metadata 90 days; minimal suppression record while needed to honour opt-out/avoid resend | Delete message content where configurable; retain minimal suppression proof | Confirm provider controls and direct-marketing rules |
| Application/runtime logs | Vercel and dependencies | Target 30 days for routine logs | Configure shortest viable vendor retention; do not export raw member data | Verify plan controls |
| Logical backups | Encrypted off-site storage | Rolling 30 days, plus one pre-release recovery point for 90 days | Cryptographic/secure deletion after expiry; deletion requests age out through rotation | Full disposable restore still pending |
| Qualified approval and consent evidence | Private business record | While relied on plus approved limitation/dispute period | Retain minimal signed version/date/scope, then securely delete | Reviewer must set period |

## Rights-request operating target

Use `hello@nashaimarkets.com` for privacy requests until a dedicated route is
approved. Chris Nash is the primary privacy operations owner.

1. Log the received date and a minimal non-sensitive request summary.
2. Verify identity proportionately; never ask for a password, magic link or more
   identity data than needed.
3. Acknowledge within 3 business days and target completion within **28 days**.
   This operational target stays inside the ordinary ICO one-calendar-month
   limit.
4. Search Supabase Auth/database, Stripe metadata, support mail, Vercel/provider
   logs, Resend (if enabled), browser-storage guidance and backup records.
5. Separate access, correction, erasure, restriction, objection and portability
   actions; record any lawful refusal/extension reason.
6. If a request is complex or numerous, obtain qualified advice and notify the
   person within the original month before relying on any permitted extension.
7. Record completion by system without copying the disclosed/deleted data into
   the tracking log.

## Controlled isolated-staging database exercise

The database portion passed on **16 August 2026** using one synthetic identity
in `nashaimarkets-staging`. The exercise:

- exported six required sections in memory and retained only a checksum;
- corrected and re-read profile, onboarding and journal values;
- removed sessions and standalone membership state before deleting Auth;
- cascaded all user-linked content and left no membership/Founding orphan;
- restored the original staging user/session counts; and
- returned zero rows when the deleted user's claims were simulated under RLS.

See `RETENTION_RIGHTS_EXERCISE_2026-08-16.md`. A real signed-session browser
replay, backup-ageing proof and separately configured support/email/billing
processor exercises remain pending. Do not perform them on the
production-linked Supabase project or a real customer. Do not put a synthetic
address or exported data in Git.

## Approval

| Decision | Owner/reviewer | Status |
|---|---|---|
| Operational schedule and 28-day target | Chris Nash | **APPROVED — 16 August 2026** |
| Accounting/billing retention | Qualified accountant/consumer-law reviewer | **UNASSIGNED** |
| Privacy law, lawful bases and rights process | Qualified UK privacy reviewer | **UNASSIGNED** |
| Controlled isolated-staging exercise | Chris Nash | **DATABASE PASS — 16 August 2026; signed-session/provider follow-up pending** |

The ICO says personal data must not be kept longer than needed, retention periods
should be justified/documented, and data should be periodically deleted or
anonymised. See the official [storage limitation guidance](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/data-protection-principles/a-guide-to-the-data-protection-principles/storage-limitation/)
and [subject-access response timing](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/right-of-access/what-should-we-consider-when-responding-to-a-request/).
