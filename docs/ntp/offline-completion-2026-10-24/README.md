# Remaining offline acceptance — completed evidence, 24 October 2026

Final executable source **7f8fdfc0871e0bcc02bb40ec5d95bc4db723bd74**, tree **0739aab88b6844afa847c450e0d841089b7c4beb**; matches tested local67d3253d2e9d0b928edd7975ee99c83f8d9e9a58 exactly. Parent checkpointe8c20279395fce22fceeb2964945ec5244cef492/source78c77ae retained. Sole writer offline-completion-baf, isolated branch monaco-offline-completion-20261024-baf, claim6390025433. Writer releases after evidence publication; latest Issue126 receipt supplies evidence SHA.

## Count reconciliation

The owner prompt said304 passing checks. The newest authoritative prior receipt6389977575 records104, not304. Preserve those results and all older scanner/native/Android evidence without adding overlapping reruns. This session executes **72 distinct targeted cases**,0failures/0skips; this is not an aggregate lifetime total. Independent review reruns are excluded.

## Genuine multi-connection PostgreSQL gate CLOSED

[Run40136673147](https://github.com/nashysaimarkets/nash-ai-markets/actions/runs/40136673147), job120999537817, source**a268e34935f23b5309fb3e95b0013fa755c8e369**, tree2c65c99325204b3eefdf514477e42ad17b1dd3c5. Actual PostgreSQL17.11, Node24.21.0, pg8.16.3. **10/10 PASS**.

Independent backend PIDs86/87 asserted. Tests observe actual pg_stat_activity Lock waits before releasing transactions, proving overlap rather than only Promise concurrency. Cases cover runtime/browser permissions, RLS owner/application isolation, revoke-versus-stale-save, shared application quota across accounts, per-account cap, concurrent monotonic revocation, rollback/unlock, real lock-timeout recovery, DB-clock quota expiry and rolled-back charge. Schema/adapter unchanged from accepted predecessor; final source retains byte-identical SQL/adapter/harness. PGlite evidence is not used as concurrency proof.

Disposable GitHub runner service only; loopback5432 and fixed newly created monaco_ig_acceptance database. Runtime test roles are ephemeral and never production credentials. Tests refuse an arbitrary URL/host/database. Container and network removed successfully in job cleanup. No hosted/customer database touched.

Local runtime initially lacked PostgreSQL and permits only UID0; attempted package-manager update failed setgroups, and a downloaded checksum-verified binary could not run with available shared libraries/nonroot mapping. No PostgreSQL root restriction or container control bypassed. Moved genuine execution to the public repository's standard ubuntu-24.04 runner. GitHub official docs confirm standard public runners are free; no paid/larger runner, cache or artifact upload used: https://docs.github.com/en/actions/reference/runners/github-hosted-runners . This was two one-off push QA jobs, not scheduled Work.

## Android engineering and actual SQL composition

Reused exact verifier and ownership-schema source fromc26b946b18faf6551dfb265ef8b7c5f97da97654. Original35 verifier checks and15 ownership SQL checks retained by source identity, not rerun. Original owner recorder19 Node/composition checks rerun because its boundaries changed.

Reviewer reproduced stalled readAccount ignoring cancellation and stalled commit never returning. Recorder now bounds verification/account/commit acknowledgement, aborts before dispatch, marks attempted only at dispatch, and returns UNCERTAIN on missing acknowledgement. A known post-dispatch commit stays recorded; cancellation never fabricates rollback or causes an automatic retry. Added pre-dispatch microtask cancellation regression.

New runtime composes the existing verifier/recorder. Ownership alone cannot authorize a scan. Pending acknowledgement holds by default. An explicitly enabled trusted acknowledgement adapter runs at most once; ambiguous acknowledgement requires reconciliation. Even a successful acknowledgement response must be followed by fresh authoritative verification. admitScan performs fresh product/environment/account verification and final authoritative revocation/ownership read for each request, with expiry/cancellation checks. Decision is single-request only, entitled:false, never a cached subscription. Reviewer found and fixed revocation occurring during final account await. No customer scanner route is enabled by this module.

New fixed-query PostgreSQL port and additive server-only lookup function support actual runtime binding. Lookup returns hashed-token ownership metadata only, fixed schema/search_path, PUBLIC execution revoked. Disposable runtime gets only schema USAGE and function EXECUTE, no table DML. Proposed schema/lookup remain outside migration discovery and **UNINSTALLED** on hosted systems.

[Run40137181801](https://github.com/nashysaimarkets/nash-ai-markets/actions/runs/40137181801), job121001070424, exact source**7f8fdfc0871e0bcc02bb40ec5d95bc4db723bd74**: **6/6 actual PostgreSQL runtime composition cases PASS**,0fail/skip. Uses actual claim/lookup SQL with synthetic Google responses; no Google API was called. Covers successful binding/admission, cross-account denial, revocation tombstone, pending acknowledgement HOLD, recovery followed by fresh verification and runtime/browser permission denial. Container and network removed. No duplicate IG concurrency run was triggered.

Remaining Android engineering/configuration is explicit: actual native PR129 source remains separately preserved; current customer scanner endpoints/native Billing bridge are not wired to this prepared runtime. Provider acknowledgement transport, authenticated notification/voided-purchase adapter and target-specific pool/account/OAuth configuration still require integration. No claim that they are completed or solely owner-permission gates. Native source/backend pin reconciliation and signed Play billing/device acceptance remain unpassed. No purchase lockout removed or fresh purchase requested.

## Premium IG browser lifecycle

Existing workspace controller and server lifecycle reused. Reviewer found unbounded response.json() consumption. The actual premium workspace now uses a fixed same-origin sender with10s deadline,64KiB streamed JSON/media-type/advertised-size checks, redirect refusal and cancellation of stalled, late or rejected bodies. It forwards only the opaque chart reference; server provenance remains authoritative. Existing owner/context/token remount, expiry, cancellation and stale-response protections preserved. Customer route remains hard-disabled503 and both premium mounts remain default OFF. No screenshots self-attest as IG-origin charts, no credentials/forms/storage/dealing added.

## Validation matrix

| Validation | Actual result |
|---|---|
| Android runtime/recorder/composition/Postgres-port Node cases |40/40 PASS (19 affected existing+21new) |
| IG browser sender+existing workspace state cases |14/14 PASS (8new+6affected) |
| Actual React workspace static renders |2/2 PASS |
| Genuine IG PostgreSQL multi-backend CI |10/10 PASS |
| Android runtime with actual PostgreSQL CI, Google synthetic |6/6 PASS |
| Full repository TypeScript |PASS exit0 |
| Changed production-source ESLint |PASS exit0 |
| Secret scan/diff checks |PASS |
| Independent source review and exact-tree verification |ACCEPTED for tested offline composition |
| New full product build/browser/device acceptance |NOT RUN; no new acceptance claim |

72 distinct tests,0fail/skip. Source code and logs retained alongside this receipt. Reviewed hashes in SOURCE-SHA256.txt. Preserve prior104/native/scanner and original Android35+34 source-qualified evidence without summing duplicates.44heldouts untouched. No package/lockfile application dependency changes.

## Recovery and remaining gates

[Exact future provider/device steps](EXTERNAL-ACCEPTANCE.md). No credentials or unavailable hardware requested this turn. Do not repeat Apple sign-in or package searches; prior no-package results retained, not expanded into a claim no backup exists.

Genuine IG remains BLOCKED by DEMO API enablement, approved managed key/vault/runtime configuration and governing provider rights. Hosted schema installation and production activation remain prohibited. Missing signed iOS bytes, immutable candidate runtime binding and actual signed-device acceptance are distinct gates. Apple agreement review is account-holder work before later submission.

Next safe engineering is target-specific Android scanner/native integration using the existing PR129 pin and this verified runtime, including authenticated notification/voided reconciliation; preserve tested source modules. Before any activation, independently reconcile exact route/backend identities and obtain the separate applicable permission. This receipt does not substitute synthetic Google or static React checks for signed-device/provider acceptance.

Rollback: discard/revert only this isolated branch. No hosted SQL rollback needed; nothing installed. Both disposable CI databases were removed. Source and evidence commits do not merge main or deploy. Vercel automatic deployment disabled for branch. No LIVE IG, broker traffic, paid inference, production/customer/database writes, spending, store release or scheduled work.
