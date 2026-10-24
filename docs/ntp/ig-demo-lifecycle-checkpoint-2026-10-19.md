# IG DEMO isolated lifecycle checkpoint — 19 October 2026

Owner contract: [issue #126, Command F](https://github.com/nashysaimarkets/nash-ai-markets/issues/126). Continue the existing [#117](https://github.com/nashysaimarkets/nash-ai-markets/pull/117) / [#118](https://github.com/nashysaimarkets/nash-ai-markets/pull/118) stack; base inspected at `6b4d949c90b90cdf9d02a3ca5a1db1ff75eacaaa` (#117 `4a87e556de9b9cbc230b1a0b46a07c91875fc7c6`). No third connector, release-branch edit, provider request, broker login, credential creation, order or deployment was performed.

## Actual implementation

- Reused the original fixed-origin read transport and strict account/position projections. A shared bounded JSON reader now abort-races non-cooperative transport/body reads and never awaits untrusted response cleanup.
- Added a separate Node-only lifecycle controller: authentication POST and logout DELETE can target only `https://demo-api.ig.com/gateway/deal/session`, version 1. There is no account-switch operation, LIVE fallback, dealing endpoint or automatic login/retry. Region-specific encryption requirements must fail closed, rather than trying a different login path.
- A new generation is acquired before the first asynchronous connect operation. Disconnect revokes locally at invocation. Auth, quota, transport and stream waits are bounded by cancellation/deadline; stale completions cannot connect, revoke, or display a newer generation.
- A trusted server callback must reprove the exact application owner UUID, paid access and explicit opt-in. Commercial permission, account/position display rights and feature flags default to denied. Email is never used as ownership proof. An independently supplied shared application/account quota authority must approve each request.
- Only session-response headers from the fixed DEMO authentication response can supply stored token pairs. The selected account must match the login response, session GET and enabled account list. Position snapshots repeat the session account check before and after positions. This is a tested protocol using mocks, not an assertion that a real user owns an IG account.
- Local expiry is five minutes, a conservative cache policy rather than a provider token-duration claim. Expiry, authentication rejection and identity mismatch fail closed. Explicit reauthentication is required; no refresh loop or background polling exists. A 429 applies a local sixty-second cooldown; a failed read is never an empty portfolio.
- Added separately licensed, GET-only market-detail and bounded historical readers. Rights default OFF; EPIC paths and time ranges are validated. History requests use one page with `pageSize <= 100` because IG ignores `max` when a date range is supplied. Raw price bodies remain untrusted internal data, with no customer display/export adapter.
- Added a narrow market-specification projection for EPIC, instrument type, size unit, currencies, contract/lot size, pip value/meaning and scaling factor. It projects no bid/offer and calculates no cash risk. Unsupported specifications produce HOLD rather than a guessed point value.
- Added an unmounted, OFF-by-default browser panel. It accepts redacted DTOs only, labels DEMO, has connect/refresh/disconnect callbacks and a fixed return-to-IG link. Errors, loading and expiry hide stale positions. Open level and position currency are separate fields. Exact IG EPIC plus account product must match a confirmed IG DEMO chart; cash SPX, ES, CFD and spread bets are never equated by label. Risk comparison remains HOLD until separately verified specifications are integrated.

## Observed verification

Node `v24.19.0`; existing repository dependency cache reused. These are offline protocol and render tests; none contacted IG.

| Gate | Observed result | Limits |
| --- | --- | --- |
| Targeted Node suite | REAL PASS — 66/66, zero skipped/cancelled | Mocks only; includes original transport/schema tests |
| Panel static render tests | REAL PASS — 5/5 | Browser interaction, touch and timer behaviour still need mounted UI QA |
| Strict targeted TypeScript | REAL PASS | No claim about unrelated full repository build |
| Targeted Next ESLint rules | REAL PASS — zero errors/warnings | Cached package/configuration reused |
| Browser bundle boundary | REAL PASS — panel bundle contains no broker headers, session path or DEMO API host | Server controller browser build correctly rejects `node:crypto`; no route is mounted |
| Independent read-only QA | REAL PASS after repairs | Reviewer reproduced and retested the lifecycle and hostile cleanup defects below |
| Real IG authentication / account ownership | BLOCKED | Existing authorised DEMO access, approved secure onboarding and governing terms required |
| Public/native integration | BLOCKED | Legal, data rights, secure storage, shared quotas, mounted-browser/device QA and release decisions below |

Independent review found two defects before handoff: a connect awaiting auth could resurrect state after disconnect, and an HTTP failure could hang on an uncooperative body-cancel hook. Both were repaired with exact regression cases, including delayed auth/quota, newer login/disconnect, caller cancellation and late responses. Review also corrected price-level currency wording and the expired connection's reconnect control. A final lint fix moved the expiry comparison to the existing state clock; dot-only EPIC paths are now rejected.

Reproduce from the successor branch:

```bash
node --test tests/ntp-ig-demo-read-only.test.ts tests/ntp-ig-demo-response-contract.test.ts tests/ntp-ig-demo-connection.test.ts tests/ntp-ig-demo-evidence.test.ts
node --import tsx --test tests/render/ig-demo-panel.test.ts
```

Regression coverage includes disabled flags/rights; absent/malformed tokens; wrong owner/account/environment; secret-shaped arbitrary errors; duplicate/malformed positions; HTTP 401/403/429/5xx; exact product mismatch; expired sessions; hostile transport/stream cleanup; stale pre-auth and quota completions; overlapping login/logout; caller cancellation; and no implicit empty portfolio or trading methods.

## External gates and exact resumption dependencies

| Dependency | Required next owner/action | Safe work already completed |
| --- | --- | --- |
| IG commercial approval and account/position/data rights | Owner approves draft below; IG confirms permitted application, users, countries, onboarding, token custody, data processing/display/storage and applicable fees/quotas in writing | Closed-by-default policy, projections and negative licence tests |
| Existing authorised DEMO access | Use an already authorised account and concealed server-managed credentials through the IG-approved onboarding route; never paste into chat/repo or create keys for this task | Mock authentication, session provenance and exact active-account protocol |
| Secure production adapter | Server engineer must load the connection by verified owner, use an encrypted managed vault with atomic generation/revocation across instances, and supply a shared app/account quota service. This process-local controller is not that distributed store | Node-only module, no public route, private token closure, owner callback and quota interface |
| Browser integration | After preceding approvals, mount panel through an authenticated, CSRF-protected server route; derive all permission values server-side. Clear UI state on app logout, permission withdrawal, image change, reconnect/cancel/failure and generation changes; bind responses to current connection/chart revision | Secret-free panel and server-verified snapshot; no client credential form |
| Regulatory/native decisions | Qualified UK adviser assesses actual instruments/outputs, onboarding, remuneration, broker links and marketing; owner determines approved geographies and obtains applicable Apple acceptance | Primary-source checklist below; no legal compliance or broker-partnership claim |
| Real integration acceptance | Independent QA verifies one account/position read, isolation, expiry, revocation and logs using existing approved access; zero orders. Separately verify encrypted vault deletion, multi-instance races and mounted mobile/browser flow | Offline fault corpus and protocol tests |

Historical prices have no public DTO or scanner adapter in this checkpoint. That adapter remains deliberately gated by real response validation, provenance and explicit display/derived-data/AI-processing rights. IG documents that OTC historical last-traded volume is generally null; do not claim this feed supplies a volume profile. No missing right or data field can be converted to an assumed permission or measurement.

## Primary sources checked on 19 October 2026

- [IG REST guide](https://labs.ig.com/rest-trading-api-guide.html) and [session reference](https://labs.ig.com/reference/session.html): CST/account-token headers, session lifecycle and distinct account identity. Direct session-reference retrieval failed; its indexed official reference plus the live REST guide were available. Live behaviour is unverified. The guide and FAQ describe different legacy token durations; use neither as an entitlement to retain tokens indefinitely.
- [Accounts](https://labs.ig.com/reference/accounts.html), [positions](https://labs.ig.com/reference/positions.html), [market details](https://labs.ig.com/reference/markets-epic.html) and [historical prices](https://labs.ig.com/reference/prices-epic.html): endpoint versions and source field contracts. Accounts direct retrieval was unavailable; reuse the already reviewed #118 contract pending real DEMO validation. Historical `max` is inapplicable with a date range; paging is explicit. Volume may be null for OTC instruments.
- [IG FAQ](https://labs.ig.com/faq.html): default non-trading quotas are 60 per application and 30 per account per minute; historical/streaming limits also exist. Confirm governing quotas with IG and reserve below them. The FAQ documents that DEMO key access can depend on a corresponding live-linked account; this task creates neither.
- [IG UK customer agreements](https://www.ig.com/uk/customer-agreement), linked Margin Trading Customer Agreement July 2023, terms 9(16)–(18), 20(1)(i) and 20(1)(m): restrictions cover third-party data display/redistribution, prices and customised interfaces. A retail API key is not evidence of commercial multi-user permission. Confirm the actual entity/product agreement and approved rights in writing.
- [FCA authorisation](https://www.fca.org.uk/firms/authorisation) and [PERG 8](https://handbook.fca.org.uk/handbook/perg8): authorisation/perimeter review is separate from technical integration; PERG addresses software investment signals and arranging. A read-only design, user click or disclaimer does not determine the perimeter. This is an engineering inference requiring qualified assessment, not a legal opinion.
- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/), 3.2.1(viii), 3.2.2(viii) and 5.1.1(ix): financial services/CFD facilitation have licensing, submitting-entity and geography requirements. Applicability to the final read-only/native product requires review; do not infer approval from the current app listing or IG's authorisation.

## IG commercial outreach — draft only, not sent

Subject: Permission request — opt-in read-only IG DEMO account integration for Pocket Bullseye

Hello IG API / commercial licensing team,

We are evaluating a small opt-in DEMO pilot for Pocket Bullseye, a subscription chart-analysis application. The proposed connection would display an authenticated user's own DEMO account metadata and open positions. There is no order submission, account switching, live dealing, custody or automated execution in this implementation, and no partnership is represented. No real IG connection has been tested under this proposal.

Please confirm whether this commercial hosted model is permitted and route us to the appropriate approval process. We need written confirmation of the supported secure user-authorisation/token-custody model, application/key structure, eligible countries/products, quotas, revocation and incident requirements. Please distinguish account/position display rights from live/historical quote display, non-display and derived analytics, AI processing, retention/export and any exchange pass-through conditions or fees. We would initially use only an existing authorised owner's DEMO account through the approved route; please do not create an account or credential for us.

We can provide a technical data-flow and security description for review. Please identify the governing entity/agreement and any additional commercial/API licence required before we expose this pilot to customers.

Regards,
Nash — Pocket Bullseye

## Integration and rollback

The sole integrator must create a guarded successor of #118, copy only this checkpoint's changed paths, verify expected parent/head SHA and commit all reviewed source together. Preserve disabled automatic deployments for the successor branch. Publish exact commit SHA, test/source checksums and independent review in issue #126; never edit a competing builder's branch or merge main.

Rollback is removing/reverting this isolated patch and retaining all flags OFF. No schema, customer, entitlement, pricing, native release or production runtime was changed. IG approval never blocks shipping the core analysis-only app once its independent release gates pass.
