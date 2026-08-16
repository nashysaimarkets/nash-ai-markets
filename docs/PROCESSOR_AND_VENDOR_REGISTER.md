# Processor and Vendor Register — Official Evidence Audit

Evidence review: **16 August 2026**

**OFFICIAL-SOURCE EVIDENCE AUDIT: COMPLETE. CUSTOMER-DATA PROCESSOR
ACCEPTANCE: PENDING ACCOUNT EVIDENCE AND QUALIFIED REVIEW.**

This is Bullseye's operational service inventory. It records repository
behaviour and current official vendor material; it is not legal approval and
does not decide every controller/processor role. Account-level acceptance,
signed terms where required, administrator ownership and a qualified review
remain launch evidence.

Never record credentials, member identifiers, payment data or private support
addresses in this file. The detailed source record is
[VENDOR_PRIVACY_EVIDENCE_2026-08-16.md](VENDOR_PRIVACY_EVIDENCE_2026-08-16.md).

## Launch decision summary

- **Vercel's plan tier is verified:** the authenticated Billing dashboard
  identified the Bullseye team as Pro on 16 August 2026, satisfying the current
  DPA's Pro/Enterprise tier condition. The same read-only check showed a failed
  payment and overdue account warning. Automatic Vercel Agent chat, code-review
  and investigation features were disabled and an automated Agent billing
  adjustment was approved later that day, but a remaining unpaid balance means
  hosting continuity remains a public-launch blocker until the account is
  current. No private billing detail is recorded here.
- **The present support-mail path is not launch-cleared:** the owner-reported
  free ImprovMX account does not have evidenced paid-customer DPA coverage, and
  the destination is a consumer Gmail mailbox rather than an evidenced Google
  Workspace business account. Do not treat that route as approved for paid
  customer correspondence.
- **Supabase is location-verified but operationally limited:** both known
  projects are in London (`eu-west-2`), while the organisation is on Free.
  Formal DPA material exists, but account acceptance, subprocessors, backups,
  log retention and deletion evidence still need to be retained. Free-plan
  pausing and recovery limits remain an availability risk.
- **Stripe, OpenAI API and Resend publish suitable baseline privacy terms,** but
  Bullseye must still retain account-specific acceptance/configuration evidence
  and obtain qualified review. Resend's Free allowance is a viable initial
  outbound-email option if its limits and domain-verification requirements are
  met.
- **TradingView and YouTube remain conditional third parties:** their current
  click-to-load, clearly attributed, display-only implementations are the safe
  boundary. They must not feed Bullseye's decision engine or load before the
  visitor acts.
- **The market-data provider remains unresolved.** A retail subscription or
  API key is not evidence of customer-display, derived-use or promotional
  rights.

## Operational register

| Service/vendor | Bullseye role and data | Verified evidence/state | Launch decision and evidence remaining |
|---|---|---|---|
| Vercel | Application hosting and sanitized runtime logs; may handle IP address, user agent, routes, request metadata and server-route application data | Authenticated Billing dashboard identified **Pro Plan** on 16 August 2026; project remains private (`live: false`). Official DPA covers Pro/Enterprise and provides UK transfer terms. Automatic Agent chat, code reviews and investigations are disabled and an automated Agent billing adjustment was approved, but the dashboard still reports a remaining unpaid balance and possible shutdown warning | **Plan-tier condition passed; continuity blocker open.** Restore the account to current status before launch and keep automatic Agent features off unless a separately approved budget exists. Retain account owner/admin, DPA acceptance, subprocessors, transfers, plan-specific log settings, incident route and deletion/export evidence |
| Supabase | Passwordless authentication, sessions and the member application database | Organisation is Free; staging and production-linked projects are in `eu-west-2`. Official DPA/GDPR material exists. No member record was inspected during this audit | Retain account/DPA acceptance, current subprocessor list, backup/log retention, transfer assessment, deletion/export and data-subject-request evidence. Decide whether Free-plan pause/backup risk is acceptable before taking paying members |
| Stripe | Hosted Checkout, customer portal, subscriptions and signed billing events; Stripe holds payment details while Bullseye retains limited billing state | Official DPA is incorporated into the Services Agreement and provides SCC/UK transfer support; legal/contractual retention can continue after termination | Retain intended-account acceptance and administrators; obtain qualified controller/processor, tax, accounting-retention, refund, complaint and consumer-renewal review; complete authorised test-mode lifecycle evidence before any live decision |
| OpenAI API | Optional server-side prioritisation of deterministic market evidence; no member identity or journal content should be sent | Business/API data is not used for training by default. Every current Responses request explicitly sets `store: false`; focused regression tests enforce the setting. Official controls still describe separate default abuse-monitoring retention of up to 30 days | Keep deterministic fallback and the no-member-data input contract. Verify account/project controls and DPA acceptance, and retain region/transfer evidence; request-level minimisation does not establish Zero Data Retention |
| Resend | Optional transactional launch and membership email; may process recipient, message content, message ID and delivery/suppression metadata | Dormant and fail closed. Official DPA/subprocessor material exists; Free currently publishes 3,000 emails/month, 100/day and 30-day data retention | Viable zero-provider-fee outbound route within published limits, but not active or launch-cleared. Verify domain/sender, account/DPA acceptance, transfers, suppression/deletion, monitoring, credentials and owner before enabling |
| ImprovMX | Forwarding for the public support address; processes sender/recipient, message content and routing metadata | Owner reports forwarding works on a free account. Official GDPR material makes its DPA available to paid customers; processing may occur in the US and Europe | **Paid-launch blocker for the current support route.** No evidenced DPA coverage for the reported free account. Upgrade under reviewed business terms or replace the route before accepting paid-customer correspondence |
| Google consumer Gmail | Destination mailbox for forwarded support messages, attachments and mail-security metadata | Owner-managed consumer mailbox receives the forwarding. Google publishes a general Privacy Policy; Workspace data-processing terms apply under a Workspace customer agreement, which is not evidenced here | **Unresolved with ImprovMX.** Do not assume consumer Gmail is covered by Workspace processor terms. Replace with a reviewed business-mail arrangement or a first-party support workflow; retain MFA, recovery, access, retention and incident evidence |
| TradingView | Optional click-to-load public chart widget and external chart links; on load it can receive page/widget/symbol, IP and network metadata | Free website widgets and privacy information are published. Current implementation is sandboxed, display-only and hidden until user action | Keep click-to-load, attribution and decision-engine isolation. Obtain qualified terms/privacy review for final placement. A retail TradingView data subscription does not grant Bullseye customer-data display or redistribution rights |
| YouTube/Google | Optional click-to-load Bullseye video playback; on load it receives video ID, IP and browser/network metadata | Current implementation uses YouTube privacy-enhanced `youtube-nocookie.com` mode and waits for user action | Keep click-to-load. Confirm channel ownership/content rights, current privacy behaviour, consent classification, transfers and final notice wording |
| GoDaddy | Registrar/DNS infrastructure and operator account administration; not an application member-data store | Owner-reported registrar/DNS provider; official privacy and data-protection material exists. DNS was not accessed or changed in this audit | Retain account ownership, MFA/recovery, data-protection/transfer evidence and change/incident contacts. Keep customer content and application secrets out of DNS/registrar records |
| GitHub and ChatGPT Sites | Development source/checkpoint collaboration only; no runtime member-data purpose | Repository and owner-only development workflows exist. They are not the public customer runtime | Keep member data, credentials, support exports and production secrets out. Confirm business account/contract terms if either service will process personal data in future |
| Market-data provider — **TBD** | Licensed ES/VIX and supporting market information; account/request telemetry and customer display depend on the licence | No provider selected; ES/VIX display acceptance remains fail closed | **Launch blocker for licensed live/delayed claims.** Obtain signed instrument, display, redistribution, derived-use, caching, promotional, attribution, retention, incident, price and termination rights |

## Lowest-cost privacy-safe route

1. Preserve the verified Vercel Pro tier without enabling add-ons. Resolve the
   overdue account status before relying on it for public launch, then retain a
   dated current-status record. If Pro cannot be maintained, keep Bullseye
   private until an approved commercial-hosting alternative is ready.
2. Keep Resend dormant until the sending domain and account evidence are ready,
   then use its Free allowance for initial outbound transactional mail if
   volume stays inside the published limits.
3. Do not route paid-customer support content through the current free
   ImprovMX/consumer-Gmail chain. The lowest-cost engineering candidate is a
   first-party Bullseye support form/inbox stored under isolated Supabase RLS,
   with Resend for replies. That is a separate scoped build and privacy review,
   not an action taken by this audit.
4. Preserve the verified `store: false` setting on every OpenAI Responses
   request and keep existing inputs limited to market context. This prevents
   default Responses application-state storage but does not remove separate
   abuse-monitoring retention.
5. Keep launch measurement tracker-free and retain the current opt-in boundary
   for TradingView and YouTube.

## First-party device storage

Bullseye uses browser storage for non-sensitive convenience state including
preferences, personal levels, checklist progress and return-visit comparisons.
These records are not sent to a separate vendor by that storage action and never
alter verified market evidence or the decision engine. The exact keys and
controls are recorded in
[COOKIE_AND_DEVICE_STORAGE_INVENTORY.md](COOKIE_AND_DEVICE_STORAGE_INVENTORY.md).

## No tracker by default

The repository does not currently implement a marketing analytics or
advertising tracker. Do not add one until purpose, lawful basis/consent, device
access, retention, vendor terms and deletion are approved. Organic launch
measurement may use privacy-safe platform totals outside the member application
in the meantime.

## Approval record required

For every active customer-data service, the launch owner must retain outside
this public repository:

- legal entity/account owner, plan and approved administrators;
- accepted contract/DPA and reviewed subprocessor-list date;
- data location and international-transfer mechanism;
- personal-data categories, purpose and lawful basis;
- retention/deletion periods including logs, backups and suppression records;
- data-subject-request and incident contacts;
- exit/export/deletion procedure; and
- approval by the responsible business/privacy reviewer.

The market-data provider also requires the executed commercial licence. A
technical API key or retail subscription is not evidence of customer-display or
redistribution rights.
