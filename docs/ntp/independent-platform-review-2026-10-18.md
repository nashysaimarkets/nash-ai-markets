# NTP independent platform review — 18 October 2026

## Scope and evidence

Reviewed PR #117 starting at `833dfcab10fe9c51f4a064c2d3b1d27918657769`, branch `feature/ntp-ig-demo-readonly-20261018`. No repository AGENTS.md found in that tree. PR was draft, with only the Vercel bot in its discussion and no competing writer claim observed. All edits in this review are confined to this branch. No broker requests, trades, credentials, paid calls, production edits, main merge, release-branch edits or public deployments were performed.

Starting-SHA CI: [run 39122168205](https://github.com/nashysaimarkets/nash-ai-markets/actions/runs/39122168205), job `117659795487`, all steps successful including typecheck, lint, units, render, safeguards, operations, build and rendered artifact. This is baseline evidence, not evidence for subsequent commits.

## Security findings

| Finding | Assessment / action |
| --- | --- |
| Live-order access | PASS within this module: fixed HTTPS demo origin; only literal GET accounts v1 and positions v2; no order methods, arbitrary path, method override, redirect following or body. An injected transport is trusted server code, not a user-controlled dependency. |
| Credential validation | FIXED: printable ASCII without whitespace only; reject all controls, DEL, Unicode and >4096 characters instead of trimming malformed credentials. |
| Unbounded requests / body | FIXED: 10-second combined abort signal, 1 MiB streamed-body ceiling, strict UTF-8 JSON decode, cancel rejected/oversized/cancelled bodies. Native fetch must honour AbortSignal; an arbitrary malicious transport is outside this boundary. |
| Cancellation test was only signal forwarding | FIXED: pre-cancel stops before transport; in-flight, deadline and response consumption tests; private abort reasons never returned; no automatic retries. Added a regression after body-cancellation test exposed a response-arrival race. |
| Cross-session contamination | PASS for transport closure only: independent concurrent clients and caller mutation tested. Tokens are snapshotted, never module globals or response-cache keys. This does not prove application tenant ownership. |
| Token provenance / authentication | BLOCKED: there is no login service or authenticated route. Opaque token syntax cannot establish DEMO issuance, owner or account. A DEMO label in a caller object is not proof. Fixed host prevents this code sending to LIVE; it does not identify a token's issuance environment. |
| Browser boundary | Runtime construction rejects window contexts. A directory name and runtime check are not a build-time server-only import fence. Before any integration, add the framework-supported compilation fence and prove client-bundle exclusion. No customer route imports this module. |
| Provider JSON | Returns unknown, intentionally not a portfolio DTO. No account/position shape, ownership or financial display claim until versioned contract validation. |
| Broker credential privileges | Read-only is an application transport constraint, not demonstrated broker-issued least-privilege credentials. Keep tokens in a separate service with method/path egress restrictions; never claim an IG read-only token scope. |

## Secure DEMO connection design (specified; not implemented)

1. **Disabled by default.** Separate server configuration and kill switch, never a NEXT_PUBLIC secret or browser-selected origin. Commercial/legal acceptance precedes any customer onboarding. Initial operator pilot only, explicit DEMO badge and consent; no dealing controls.
2. **Identity first.** Verify the application session server-side. Derive owner UUID from authenticated identity, never email or request ownerId. Use same-origin POST, CSRF token/Origin validation, recent authentication and per-owner rate limits for connect/disconnect. Authorise every read and reconnect, not just initial creation. Foreign connection ID always denied.
3. **Broker-authorised login route.** Agree a third-party onboarding method with IG. Do not invent a hosted OAuth redirect flow: documented v3 OAuth token issuance through POST /session is not evidence of a delegated authorisation-code service. Never ask users to paste secrets into chat. If IG approves password-based onboarding, submit directly over TLS to a dedicated server handler, exclude body/headers from all logging and telemetry, do not persist password, and process only against the literal DEMO origin. Authentication lifecycle methods belong in a separately reviewed service, never the read transport.
4. **Prove provenance.** Obtain the tokens only from the pinned DEMO login response. Validate session/account details against that authenticated response and a DEMO session read. Require a returned account ID matching the selected account. No caller-supplied CST/security-token endpoint. Account switching requires a fresh explicit binding and separately reviewed session operation; never reuse a mutable active-account session across users.
5. **Secret storage.** Encrypt tokens with managed keys and associated metadata `(owner UUID, connection ID, environment, account ID, session generation)`. Only the broker service may decrypt; app/UI receive opaque IDs and redacted DTOs. No tokens in localStorage, URL, client JS, source, audit traces, exports or error bodies. No real credentials in fixtures. Store minimum data and a deletion/retention policy.
6. **Lifecycle and concurrency.** Track connected/expired/revoked and generation under an atomic update. Reconnect increments generation; disconnect revokes locally first, cancels active reads and discards late responses, then attempts broker logout in the separate service. Reject expired/revoked/mismatched generations before and after fetch. Destroy cached views on app logout. On 401/403 mark disconnected and require reauthentication; no hidden login loop. IG documentation gives conflicting legacy token durations, so do not treat a local expiry assumption as authoritative. Use conservative local maximum age and provider rejection handling; validate actual demo behaviour.
7. **Read path.** Resolve the encrypted record by authenticated owner AND connection ID, verify environment/account/generation, instantiate a request-local client, validate schema, and project only approved fields. Include source, DEMO label and observed timestamp. Positions are for the active account, so prove that account through the bound session before display. Never aggregate one account's data into another tenant's cache.
8. **Budgets and operations.** Per-app and per-account throttles below IG-approved quotas; deduplicate parallel reads, no polling by default. Handle 429 with a bounded cooldown and user-visible retry, no automatic retry storms. Timeout means unavailable, never an empty portfolio. Audit only non-secret event IDs, owner reference, generation, outcome and timestamp. Test key rotation, access revocation and deletion without a live customer.
9. **Acceptance matrix.** Two owners, same email/recreated account, guessed connection ID, mismatched selected account, mixed token pairs, forged environment, disconnected session, concurrent reconnect/disconnect, late response, expiry, login failure, 429, stalled body, log inspection, browser-bundle secret scan. All must pass on mocks first. Then obtain permission for a real demo contract test with the same endpoint versions; zero orders. Do not enable UI until independent review passes.

## Commercial API, data and FCA review

Primary sources checked on 18 October 2026:

- [IG UK API guide](https://www.ig.com/uk/trading-platforms/trading-apis/how-to-use-ig-api): Web REST/streaming and institutional FIX are distinct. API setup needs a live-linked demo; no share price data is promised. This is not a commercial NTP approval.
- [IG REST reference](https://labs.ig.com/rest-trading-api-reference.html): accounts GET v1 and positions GET v2 match this prototype; session login/refresh/logout/account switching are separate operations. [Authentication guide](https://labs.ig.com/rest-trading-api-guide.html) documents CST/account tokens and v3 tokens; it does not establish read-only broker permissions.
- [IG FAQ](https://labs.ig.com/faq.html): default non-trading quotas are 60/app/minute and 30/account/minute; historical and streaming caps also apply. Its legacy token-expiry explanation differs from the REST guide. Confirm contracted quotas and lifecycle with IG rather than choosing the more permissive text.
- [IG customer agreements](https://www.ig.com/uk/customer-agreement), CFD agreement linked there, July 2023: terms 9(16)–(18) restrict third-party redistribution/display and address data fees/exchange conditions; 20(1)(i) limits price use, and (m) requires permission for custom interfaces. Obtain the exact governing entity/product agreement and written commercial/API, user-authorisation and licensing terms before multi-user use. This review does not assert that a retail agreement licenses NTP.
- [FCA PERG 8](https://handbook.fca.org.uk/handbook/perg8): 8.30.5 specifically covers software-generated investment signals; 8.32 covers arranging deals. [Trading venue perimeter policy](https://www.fca.org.uk/publication/policy/ps23-11.pdf), 2.21–2.26, explains why technology supporting trading can still need an arranging analysis even without a multilateral venue. [Financial promotions](https://www.fca.org.uk/firms/financial-promotions-adverts) must be assessed separately.

**Design inference, not a legal determination:** obtain a UK regulatory perimeter assessment of actual outputs, instruments, onboarding, broker links, remuneration and marketing. Assess advising, arranging, dealing as agent, financial promotions, and any exclusions/authorisation or principal arrangement. IG's authorisation does not transfer to NTP. A user click, disclaimer, DEMO badge or absence of auto-trading does not settle the perimeter. No custody/client money or execution feature is introduced here. Reassess Consumer Duty, appropriateness, order handling, conflicts and recordkeeping obligations if the proposed regulated model proceeds.

Written IG answers needed: permitted multi-user commercial service and countries; hosted onboarding/token custody; demo access conditions; application/key model; account isolation and revocation; approved quotas; exact display/non-display/derived-data/storage/export/AI-processing rights; exchange pass-through obligations and fees; incident/support arrangements. Do not accept terms, contact third parties or pay fees in this workstream.

## Competitor delta and NTP Decision Gate

Reviewed issue #113 and re-opened official [TrendSpider September changelog](https://trendspider.com/blog/september-2026-changelog/), [TradingView paper trading](https://www.tradingview.com/support/solutions/43000516466-paper-trading-main-functionality/) and [TradeZella features](https://www.tradezella.com/features). Vendor descriptions confirm features, not measured accuracy or suitability for NTP. TrendSpider describes strategy iteration/backtests, progress and mobile scans; TradingView provides simulated trading; TradeZella describes journals and replay. No performance claim adopted.

Read-only inspection of release candidate `2bb9b1e1766a93fbb8b9cf97df98050964a9d3aa`: `app/pocket/workflow-plan.ts` already supplies user-plan calculation and export; `app/pocket-next/PocketWorkflowDesk.tsx` already supplies local decision history, before/after review, official macro panel, company-event checks, standalone levels, cancellation and duplicate-request guard. Further inspection of `PocketNext.tsx` confirms per-slot upload revisions, reportRevision, abort handling, revision-checked result commits and workflow component keys containing chart/revision/reportRevision. `app/pocket/chart-request-identity.ts` already provides a monotonic request epoch; `app/pocket/level-provenance.ts` provides level attribution metadata. Reuse these primitives. The novel work is aggregate eligibility across evidence, higher timeframe, calendar and user plan, not replacing existing stale-result or cancellation protection. Provenance display labels alone must not be treated as independent numeric verification. These files were not edited or copied into this branch. Main also has `app/lib/trading-decision-engine.ts` and desk presentation; its confidence score is not evidence for screenshot accuracy.

| Capability | Existing evidence | Decision |
| --- | --- | --- |
| Journal, plan/export, event panel, follow-up | Above candidate files | Reuse; do not create another journal, risk calculator or calendar. Not a shipped-feature verification. |
| WAIT/no-trade and evidence display | Existing decision engine and candidate workflow | Reuse semantics; verify screenshot-specific adapter and provenance. |
| Aggregation across evidence, higher timeframe, events and user plan | Per-chart revision/epoch protection exists; no combined eligibility contract established by inspected files | Bounded gap: compose existing identity/provenance primitives in a pure gate adapter after P0 acceptance. |
| Progress/cancellation | Existing cancel/duplicate guard | Measure actual stage telemetry and billing; do not add a cosmetic timer or claim it missing outright. |
| Paper dealing / broker dashboard | New bridge only, not an integration | Defer until commercial, legal, auth and demo contract gates pass. |
| AI backtests, streaming alerts, options heatmap | Not demonstrated by this prototype | Separate evidence/data-rights/cost scope; not a release prerequisite or shortcut around scanner trust. |

### Decision Gate contract and acceptance

Preparation only, no UI/route/AI calls added. Integrate into existing workflow after P0 scanner measurements and legal review, with independent QA. Function consumes a validated snapshot: image hash + monotonic revision + result generation; confirmed symbol/axis/timeframe; scanner evidence IDs and original-pixel anchors; higher-timeframe source identity and age; official event provenance/time coverage; explicit user plan and invalidation. Bind every source to its own identity and the parent snapshot. A revision number alone is insufficient across different charts.

Outputs: `HOLD` with reason codes, `NO_TRADE` for explicit invalidation/conflict, or `CHECKS_COMPLETE` meaning only recorded process checks complete. No BUY/SELL instruction, execution permission, numeric confidence or probability. Missing/unknown is HOLD, never inferred clear. Unsupported prices cannot become plan values; user-entered values remain clearly attributed. Empty events without verified coverage cannot mean no event risk. Higher-timeframe mismatch is not silently discarded. Reuse calculateUserPlan; carry gate state/reasons/revision into existing export and vault without changing saved screenshot bytes.

Recompute on every image, confirmation, timeframe, plan, source or session change. Mark pending immediately, cancel obsolete work, reject late generation results and disable duplicate submission. Export rechecks the same immutable snapshot; old history opens for review, never masquerades as current clearance.

Required tests: same revision/different image; stale/other timeframe; missing axis/symbol; absent or unsupported numeric evidence; conflicting higher timeframe; invalidated plan; NaN/Infinity/zero risk; unavailable/stale/wrong-instrument calendar; cancellation followed by late success; double click; plan change during export; restored legacy record; clean complete snapshot without invented confidence or network traffic. These are planned tests, not reported passes.

## Outstanding ownership and next actions

| Item | State | Proposed accountable role / next action |
| --- | --- | --- |
| Transport hardening and mock tests | PASS locally; see final commit CI separately | NTP platform engineer: preserve isolated draft, independent code review before use. |
| Authenticated demo connection | DESIGN COMPLETE / IMPLEMENTATION BLOCKED | Broker integration engineer: implement only after IG-approved onboarding; no endpoint exposed now. |
| Commercial / data rights | BLOCKED, no written approval present | Owner + IG commercial/licensing: obtain explicit rights matrix above. |
| FCA perimeter / promotions | BLOCKED, assessment not supplied | Qualified UK regulatory adviser: assess concrete product and permissions. |
| Real demo contract and tenant security | NOT RUN | Integration QA: authorised demo credentials and approved onboarding required; never trades. |
| Decision Gate | DESIGN READY / NOT IMPLEMENTED | Feature engineer: adapt existing workflow only after P0 evidence and perimeter acceptance; independent QA matrix above. |
| Public rollout | HOLD | Release owner: existing #112 scanner/native/commerce gates remain separate; no release authority implied by this work. |

## Local verification of this change

Node v24.19.0, existing dependency installation reused (not a fresh npm ci). `npm run test:unit`: 785/785, including 18 IG tests; `test:render`: 4/4; `simulate:production`: 8/8; `test:rendered`: 1/1. Typecheck, full lint (0 errors, 6 existing warnings), secret-pattern scan, operations validation, verified production build/artifact validation and git diff whitespace check passed. No skipped tests. Browser/account integration not exercised; no UI was added. Remote Node 22 locked-install CI for the new commit must be checked separately and must not be inferred from these local results.

Automatic deployment is disabled for exactly this branch via documented Vercel git.deploymentEnabled configuration; other branches are unspecified. The earlier bot-linked preview predates this review and is not evidence for the hardened client. Do not manually deploy this draft.
