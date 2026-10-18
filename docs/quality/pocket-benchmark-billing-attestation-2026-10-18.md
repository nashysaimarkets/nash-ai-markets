# $5 scanner benchmark — independent billing evidence gate (18 October 2026)

**Status:** isolated source patch on draft PR #119; PostgreSQL 17.6 staging execution in explicit `BEGIN/ROLLBACK` passed the synthetic fixture. Nothing installed persistently. This is **not** approval for OpenAI spend, provider accuracy claims, customer access, a production migration or release.

## Why this exists

The original pilot capped spending only per `ledger_key`. Separate keys could reuse one owner approval and each commit up to $5. It also trusted `settle_pocket_benchmark_call(p_actual_microusd)` supplied by the same application that submitted the provider request, without external cost evidence. A self-reported $0 would incorrectly make a receipt appear financially reconciled.

## Database contract

1. Only one canonical `owner_approval_ref` may exist: the **already-approved** real pilot reference `comment-6165012632`. Other references are restricted to synthetic QA namespace (`qa-...`, `proj_qa`, `qa-...` ledger keys). This is a deliberate current-approval constraint, not a future general-purpose approval policy.
2. Ledger cap, approval identity, candidate SHA, project, tier, pricing evidence, allowed cases and creation time cannot change. Initial verification may be recorded once. `enabled` may toggle but cannot reset committed reservations; row DELETE and TRUNCATE are rejected.
3. Application `service_role` may dispatch and record receipts through existing RPCs, **but does not have INSERT rights** to `private.pocket_benchmark_pilot_cost_attestations`. This table uses RLS and has append-only UPDATE/DELETE/TRUNCATE guards.
4. A separately authorised database administrator must examine the original **external** project/key/model/tier billing evidence and its timestamp, exact provider request/response IDs, input and output usage, complete original image/text/schema requests, retries/precision/rescue, and whether invoice aggregation permits attribution to that precise request. If attribution is impossible, **do not attest anything, including $0**.
5. On independently defensible attribution, store project/request/response/model/tier, a validated actual microusd figure, a specific external evidence reference, a SHA-256 digest of the retained supporting evidence, and reviewer identity for each required call. Never store keys, user financial details or raw credentials in these records. A hash/reference is **not a signature and not proof on its own**; a human reviewer must actually compare the underlying authoritative source.
6. `settle_pocket_benchmark_call` must match the stored independent attestation for the exact ledger/case/slot, project, provider request/response, model, tier and actual dollars. Its ordinary caller-supplied amount alone is insufficient. Final reconciliation requires matching attestations for both primary calls, plus all original cap/receipt/settlement/veto requirements. A real $0 charge can be accepted only with equally strong external evidence.
7. If the provider does not offer request-attributed dollars, if the review source is missing/ambiguous, or if the reviewer is not independent, leave the call submitted/unreconciled and the measurement **HOLD**. Do not treat aggregate usage, wallet credits or a locally estimated price as authoritative incurred cost.

## Exact isolated verification

PR119 source has PostgreSQL trigger/constraint and migration test fixture. Against staging PostgreSQL **17.6**, the migration and fixture were submitted in one `BEGIN; SET LOCAL lock_timeout='2s'; SET LOCAL statement_timeout='30s'; ...; ROLLBACK;` call. The execution returned successfully, including negative SQL assertions for duplicate approval, forged aliases and unauthorised live approvals, mutable budgets/identity and resets, empty-cost attestation denial, false $0, service-role attestation permission denial, tampered price and truncation attempts; synthetic separate-administrator cost evidence permitted the original success path. Final `to_regclass` checks returned **NULL** for pilot ledger and cost attestation tables. Exact commit and GitHub blob SHA to be recorded in the PR review. **No two-connection concurrency test, production install, full CI or real billing proof was performed.**

## Still required before pilot activation

- Independent reviewer verifies actual effective OpenAI organisation/project/key/model/tier and full cost upper bound for all three potential model requests including image/text/schema/output/retries, and checks the already-approved aggregate $5 scope.
- Run separate-connection concurrent ledger/claim tests in a disposable database with independent QA. This staging test was one rolled-back transaction; DB uniqueness/row locks give strong structural protection but are not a measured concurrency run.
- Obtain and retain trustworthy request-linked billing evidence; if unavailable, keep the release/measurements held. No speculative attestation from token multiplication.
- Dedicated staging deployment review and explicit owner authorisation for any persistent migration/configuration changes, followed by signed exact-SHA CI, negative app auth, and one-case-at-a-time provider execution with cost reconciliation.
- Preserve distinct historical unreconciled $2 ledger, PR112 sole-writer claim, Pocket Bullseye release HOLD and first-free OFF. Never touch production or any actual customer for this pilot.

**Developer/QA reminder:** No new caller header, local flag, application session or service-role RPC may create administrator attestation. This is intentionally a separate financial approval boundary.
