# Vendor Privacy Evidence — 16 August 2026

## Outcome

**OFFICIAL-SOURCE EVIDENCE AUDIT: COMPLETE. ACCOUNT ACCEPTANCE AND QUALIFIED
PRIVACY REVIEW: PENDING. PUBLIC PAID LAUNCH: HOLD.**

This was a read-only audit of the vendor surface implemented or reported for
Bullseye. It compared repository behaviour, connected-project metadata available
without customer-record access and current official vendor publications. It did
not accept contracts, change plans, inspect member data, access secrets, alter a
provider, or make a production, Stripe, DNS or Supabase configuration change.

Official web terms can change and do not prove which terms an account accepted.
The operational register therefore distinguishes published baseline evidence
from account evidence and qualified legal approval.

## Connected-service snapshot

| Service | Read-only evidence | Boundary |
|---|---|---|
| Vercel | Authenticated Billing dashboard identified **Pro Plan**; the connected project reports `live: false` and a ready private preview. Automatic Agent chat, code reviews and investigations were disabled and an automated Agent billing adjustment was approved on 16 August 2026 | Plan tier satisfies the current DPA scope, but the remaining unpaid balance creates a service-continuity blocker. No invoice amount, invoice identifier or payment-method detail is retained here |
| Supabase | Organisation plan is Free. Both the isolated staging and production-linked projects report London `eu-west-2` | No member records, secrets or configuration were inspected or changed |
| Other services | Repository integrations and owner-recorded state were compared with public official terms | Account plan, acceptance, administrators and private dashboard settings were not inferred |

## Official-source findings

### Vercel

- The current [Data Processing Addendum](https://vercel.com/legal/dpa) is
  effective 31 March 2026, applies to Pro and Enterprise customers, and contains
  UK/international-transfer provisions. It points customers to Vercel's current
  subprocessor information.
- Vercel's [fair-use guidance](https://vercel.com/docs/limits/fair-use-guidelines)
  and [terms](https://vercel.com/legal/terms) restrict Hobby to personal,
  non-commercial use.
- [Runtime-log documentation](https://vercel.com/docs/logs/runtime) publishes
  plan-dependent retention. Therefore plan evidence also affects Bullseye's
  retention record.
- On 16 August 2026, an authenticated read-only Billing dashboard check
  identified **Pro Plan** for the Bullseye team. It also displayed a failed
  payment, overdue status and warning that the account could be shut down. A
  later automated Agent billing adjustment reduced the invoice after all
  automatic Agent features were switched off; a remaining unpaid balance and
  the continuity warning remain.

**Implication:** the commercial/DPA plan-tier condition is now evidenced. Public
launch remains blocked by hosting continuity until the account is current, and
account/DPA/subprocessor evidence must still be retained. No plan, payment
method, invoice or project setting was changed during this audit; sensitive
billing details are deliberately omitted.

### Supabase

- Supabase publishes a formal [DPA](https://supabase.com/legal/dpa) and
  [GDPR-compliance guidance](https://supabase.com/docs/guides/security/gdpr-compliance).
  Primary database/Auth/Storage location follows the selected project region;
  backups, logs and subprocessors still need transfer/retention assessment.
- Current [pricing](https://supabase.com/pricing) distinguishes Free from paid
  backup, log-retention and availability features. The verified Bullseye
  organisation is Free.

**Implication:** London project location is evidenced, but it is not the whole
transfer record. Retain account acceptance and subprocessor evidence. Free-plan
pausing and recovery limits are an operational risk before paying members are
accepted; no upgrade is required merely to finish private testing.

### Stripe

- Stripe's [DPA](https://stripe.com/legal/dpa) is incorporated into the Stripe
  Services Agreement and provides SCC/UK transfer mechanisms.
- Stripe's [DPA FAQ](https://stripe.com/legal/dpa/faqs) points to its service
  providers/subprocessors. The DPA allows post-termination retention where
  required by law or contract.

**Implication:** retain the exact account agreement and administrator evidence;
obtain qualified review of Stripe/Bullseye roles, statutory accounting periods,
consumer cancellation/refunds and the final live lifecycle. No Stripe setting
or object was touched.

### OpenAI API

- OpenAI's [business data commitments](https://openai.com/business-data/) state
  that business/API data is not used for model training by default.
- The official [API data-controls documentation](https://developers.openai.com/api/docs/guides/your-data#default-usage-policies-by-endpoint)
  describes abuse-monitoring retention of up to 30 days and default Responses
  application-state retention. OpenAI also publishes enterprise privacy and DPA
  information in its [enterprise privacy controls](https://openai.com/enterprise-privacy/).
- Bullseye supplies deterministic market context rather than member identity or
  journal content. Every current Responses call now explicitly sets
  `store: false`, with focused regression coverage.

**Implication:** keep the no-member-data input contract and deterministic
fallback. Request-level application-state minimisation is now implemented, but
it does not remove the separate default abuse-monitoring retention or establish
organisation-level Zero Data Retention. Account/DPA and transfer evidence still
require review.

### Resend

- Resend publishes a [DPA](https://resend.com/legal/dpa), including subprocessor
  change provisions, and provides an account path for downloading legal
  [documents](https://resend.com/docs/knowledge-base/downloading-documents).
- Resend reports Data Privacy Framework certification including the UK
  Extension in its [certification notice](https://resend.com/changelog/data-privacy-framework-certification).
- Current [pricing](https://resend.com/pricing) publishes a Free allowance of
  3,000 emails/month, 100/day, one domain and 30-day data retention.

**Implication:** Resend is a plausible zero-provider-fee launch route for modest
outbound transactional mail. It remains dormant until sender/domain, acceptance,
suppression/deletion, transfer, credentials, monitoring and ownership evidence
are complete.

### ImprovMX and consumer Gmail

- ImprovMX's [GDPR page](https://improvmx.com/transparency/gdpr-compliance/)
  states that a DPA is available to customers described there as paid users and
  notes US/European processing. Its [Privacy Policy](https://improvmx.com/transparency/privacy-policy/)
  describes its data practices.
- The configured route is owner-reported as a free ImprovMX account forwarding
  to a consumer Gmail mailbox. Google's general [Privacy Policy](https://policies.google.com/privacy)
  applies broadly, while Google Workspace data-processing terms sit under a
  Workspace customer agreement. No Workspace business account or account-level
  DPA evidence was established in this audit.

**Implication:** no business processor/DPA coverage has been evidenced for the
current chain. That is not a finding that either service is unlawful; it means
Bullseye cannot mark the route launch-approved. Upgrade under reviewed terms or
replace it before paid-customer support content is accepted.

### TradingView

- TradingView publishes free website [widgets](https://www.tradingview.com/widget/)
  and a [widget FAQ](https://www.tradingview.com/widget-docs/faq/general/).
  The FAQ describes widget telemetry including the embedding URL, widget/symbol
  and IP-related security processing even though the widget itself does not set
  cookies.
- TradingView publishes its [Privacy Policy](https://www.tradingview.com/privacy-policy/)
  and [Cookies Policy](https://www.tradingview.com/cookies-policy/).

**Implication:** retain Bullseye's click-to-load, attribution, sandbox and
display-only isolation. Do not scrape TradingView or treat a retail subscription
as customer-display/redistribution rights for Bullseye's data engine.

### YouTube/Google

- YouTube documents [privacy-enhanced embedding](https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en-GB)
  using `youtube-nocookie.com`.

**Implication:** the current click-to-load privacy-enhanced embed is the correct
low-data boundary. Final review must still cover content ownership, disclosure,
transfer and the network data sent after a visitor chooses to load the video.

### GoDaddy

- GoDaddy publishes a [Privacy Policy](https://www.godaddy.com/en/legal/agreements/privacy-policy)
  and [Data Protection and Security Standards](https://www.godaddy.com/en/legal/agreements/data-protection-security-standards).

**Implication:** record it as registrar/DNS infrastructure, retain owner/MFA and
contract/transfer evidence, and keep member content and application secrets out
of DNS. No DNS setting was accessed or changed.

### GitHub and ChatGPT Sites

- GitHub publishes [customer terms](https://github.com/customer-terms) including
  data-processing terms for specified business products.
- OpenAI publishes a [ChatGPT Sites Data Processing Addendum](https://openai.com/policies/chatgpt-sites-data-processing-addendum/).

**Implication:** both remain development-only in Bullseye's current architecture.
Do not place runtime member data, private support exports, payment data or
production secrets in either service; review business terms if that purpose
changes.

## Recorded blockers and no-cost actions

| Priority | Finding | Safest action |
|---|---|---|
| P0 continuity | Vercel Pro tier is evidenced and automatic Agent spend paths are disabled, but a remaining unpaid balance and possible shutdown warning persist | Owner restores the account to current status without adding optional services, then retains dated continuity evidence before public launch |
| P0 | Free ImprovMX → consumer Gmail is not evidenced as a business processor chain | Do not use it for paid-customer support; separately scope a first-party Supabase support inbox plus Resend replies, or purchase reviewed business mail |
| Cleared in repository | Every current OpenAI Responses call explicitly sets `store: false` | Preserve the focused regression assertions; separately review account-level retention controls and DPA/transfer evidence |
| P1 | Supabase Free has availability/recovery limits | Keep private testing; decide and document acceptable paid-member RPO/RTO before launch |
| P1 | Resend is dormant | Configure only after domain, DPA/account, suppression, monitoring and ownership evidence is ready; remain within Free limits initially |
| P0 | Market-data rights remain unsigned | Continue fail closed; do not substitute scraped/retail-widget data for licensed customer-display rights |

## Audit integrity

- No credential, private mailbox address, member identifier or customer content
  is recorded here.
- No production deployment, public preview, purchase, plan change, contract
  acceptance, DNS edit, Supabase mutation, Stripe action or provider integration
  occurred.
- This document records evidence and launch implications only. A qualified UK
  privacy/consumer-law reviewer must approve the final roles, notices, terms,
  transfers and retention position.
