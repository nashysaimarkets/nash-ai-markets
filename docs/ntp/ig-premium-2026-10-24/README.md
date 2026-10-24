# IG DEMO premium integration checkpoint — 24 October 2026

Owner Issue #126; isolated branch `monaco-ig-premium-20261024-c3ee`. This is an offline engineering checkpoint, **NOT completed genuine IG integration or customer activation**.

## Source and ownership

Base: evidence `8b9977e64262eacae62f3b59474bb69528564450`, executable `30d05357892dc4de4c3e93ce180eeaaf23021c3d`. Existing scanner source/build/57 local HTTP checks and five-chart evidence preserved; no scanner engine changes or held-out cases opened. The active staging-native writer is on a separate branch and remains untouched.

Verified remote originals unchanged: PR117 `4a87e556de9b9cbc230b1a0b46a07c91875fc7c6`; PR118 `6b4d949c90b90cdf9d02a3ca5a1db1ff75eacaaa`; PR128 `a8fc14cacc845d841af6946c78e6fa4da6f1cb7b`. Copied the exact PR128 bridge, strict response contracts, lifecycle, browser DTO/panel and tests. This reuses the existing implementation rather than creating a competing transport. Its prior 66+5 checks and independent review are documented in the earlier checkpoint. GitHub's current commit-workflow wrapper returned an empty filtered list; the earlier saved run39310022219 success is retained as historical evidence, not a newly observed CI run.

## New engineering

- Mounted existing panel in both premium chart intake and results, default OFF. A server-provided owner scope and availability are required before private opt-in can even render. Session-only consent, no browser credential form/storage, responsive styling and accessible controls.
- Browser controller clears positions immediately for requests, cancellation, failures, timeout, expiry and disconnect. Request generations suppress late revival. Owner/chart/provenance-token changes synchronously remount the scope; pagehide clears it. No polling/retries or persistence.
- Server HTTP adapter requires exact configured Origin, JSON and custom header; accepts only action and optional opaque chart token, bounds streamed request input to256bytes, uses deadlines and cancellation, validates owner UUID and permissions, loads credentials only through a server callback, and rechecks identity after reads. Responses are strictly redacted and no-store.
- Connect/refresh/disconnect call the reused lifecycle. Server-registered owner-bound chart provenance can enable exact EPIC/product matching; mismatches HOLD. No screenshot-label inference, imported market prices, scanner AI calls, guessed risk/point values or order interface.
- Actual customer route is hard-disabled503 and does not construct a connection. The premium page does not supply activation/owner props. No environment flag, browser checkbox or forged request can activate it.

## Acceptance

| Gate | Result |
|---|---|
| Targeted source suite, including reused66 and new14 | PASS80/80; no skips |
| Actual React static renders | PASS7/7; not browser interaction |
| Loopback HTTP → boundary → reused lifecycle | PASS; mock IG transport only |
| Full repository TypeScript | PASS |
| Affected ESLint | PASS0errors/0warnings |
| Independent read-only source review | APPROVED;13 new controls independently run before loopback test addition |
| Browser interaction | BLOCKED: available cloud browser could not reach local127.0.0.1:8766, ERR_CONNECTION_REFUSED; no browser PASS claimed |
| Actual IG login/account/positions | BLOCKED; no IG calls attempted |
| Hosted auth/vault/shared quota/revocation | UNIMPLEMENTED deployment bindings; not proven by mocks |
| Registered scanner chart provenance | UNBOUND in actual premium route; normal screenshots HOLD |
| Production build | PASS; existing offline font/identity fixtures and external network denial; BUILD_EXIT=0 |
| Compiled Next customer route HTTP | PASS503/no-store; no activation |

Reviewer reproduced oversized body consumption, missing result-panel mount, and stale chart/provenance display; all repaired. Independent reviewed source SHA256s are in REVIEW.md. Original transport/session tests cover401/403/429/5xx, wrong accounts, duplicate positions, cancellation/deadlines, no LIVE fallback and forbidden market data. Additional controls cover CSRF, injected identities/credentials, hostile streamed bodies, expired DTOs, late connect/disconnect, exact-vs-ES product matching, and actual loopback transport.

## Exact remaining integration work and prerequisites

1. **Hosting adapter**: bind verified application UUID, paid status, server-side consent and ownerScope updates on login/logout; never trust a client owner/permission flag. Reuse existing auth/entitlement service, but do not activate the current customer route before acceptance.
2. **Existing managed secret destination**: approved IG account identifier/password/API key must remain server-only in an encrypted managed vault with least privilege and audit. No key was read, requested, created or stored in this run. Do not put them in chat, screenshots, localStorage, NEXT_PUBLIC variables, repo files or client POST bodies. Select the actual service and approve its scoped configuration before implementing provider-specific bindings.
3. **Distributed lifecycle**: the reused lifecycle is process-local. Before a multi-instance host, implement atomic owner-keyed connection generation/revocation and global application/account quotas using the approved existing storage. Prove two-instance connect/disconnect races, token deletion and quota denial in isolated storage. Do not replace this requirement with an in-memory map or claim that the HTTP dependency contract supplies persistence.
4. **Chart binding**: register source identity against owner UUID + immutable source revision using verified IG DEMO EPIC and product. Bind that opaque token to the corresponding premium slot. An ordinary US500/SPX/ES screenshot cannot establish this provenance; HOLD remains correct. Trading interpretation and cash-risk comparisons remain unverified independently.
5. **Provider acceptance**: existing authorised DEMO account/API access; governing IG permission for the proposed hosted pilot/account-position display; reviewed secure configuration; then one bounded connect/read/disconnect session under explicit authorisation. Never create accounts/keys or change LIVE configuration for this task.
6. **Commercial launch**: obtain IG's written terms for multi-user hosted connection, token custody, permitted products/regions, account-position display, market-data/derived-data/AI processing/retention and any fees. Public API availability is not commercial approval. Reuse the prior unsent outreach draft; no outreach was sent. No quote/history request is needed for the first account-only test.

Smallest owner information needed: **confirm whether an existing IG DEMO account already has API access (yes/no only; never share secrets).** This does not authorise creating credentials, buying services, sending outreach, or activating customers. If IG approval is absent, the existing draft can be reviewed for a separately authorised send; do not ask the owner to create another account/key.

## Bounded genuine acceptance plan — prepared, not executed

Use one specifically authorised owner, pinned reviewed source and isolated private runtime, with no customer feature flag. Confirm identity/DEMO account metadata and approved secret names only. Shared budget enforces the stricter governing account/application quota. Record sanitized statuses/account correlation, no tokens or raw position dumps.

Connect uses1 authentication POST plus account proof; one snapshot reads session/accounts/positions/session. Disconnect uses only DELETE/session. Inspect the lifecycle's exact calls before execution; set a hard request ceiling, ten-second per-operation deadline, no retries or fallback. Confirm account matches login/session/account list, positions are validated, no quote/history/order path occurs, wrong owner denies before credential access, disconnect revokes local access, and provider logout is explicitly CONFIRMED or UNCONFIRMED. Exercise expiry/cancellation and two-instance revocation separately in the isolated adapter before provider traffic.

Rollback: keep customer route503 and page props absent; revoke private pilot session and remove only pilot credential binding if activated later. Current rollback is reverting this branch's IG additions/CSS/mount only. No production/database/customer migration, pricing, release, main merge or schedule change occurred.

## Primary-source refresh

Checked24October2026: https://labs.ig.com/faq.html (DEMO origin, session rejection, quotas); https://labs.ig.com/gettingstarted (separate DEMO/API setup); https://www.ig.com/uk/help-and-support/articles/682194-how-can-i-access-the-ig-api and https://www.ig.com/uk/customer-agreement (governing documents). The public pages do not attest approval for this application. Preserve the prior commercial draft and restrictions until IG confirms the applicable terms; no claim of legal compliance or partnership.

Build history: first compile exposed a type import in the new loopback test; corrected before source commit. Next full compile/typecheck passed but prerender needed the prior offline identity fixture. Final build reused that existing configuration and network-denial hook and passed. Known pre-existing middleware deprecation and Supabase Edge process.version warnings remain; no claim of warning-free full build.
