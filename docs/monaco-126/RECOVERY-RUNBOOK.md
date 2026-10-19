# Monaco126 recovery runbook

The authoritative contract is [issue126](https://github.com/nashysaimarkets/nash-ai-markets/issues/126), including its19October crash-recovery amendment. Read its newest comments first. This file plus RECOVERY-STATE.json must suffice without conversation memory. Prior evidence remains [FINAL-HANDOVER at440a672](https://github.com/nashysaimarkets/nash-ai-markets/blob/440a672143efb21997f9c1fb106f1c845208a885/docs/monaco-126/qa/FINAL-HANDOVER.md); preserve all frozen PRs and its A–I register.

1. Resolve the immutable coordination commit/tree linked by the newest issue checkpoint, then read RECOVERY-STATE.json from that exact commit. The file cannot embed its own Git commit hash. Its checkpoint records the last independently verified remote anchor; the enclosing commit/tree is the issue comment's external receipt. Resolve both, never replace either with a guessed SHA.
2. Verify all current PR/branch heads against the manifest and later issue/PR ownership comments. Inspect active tools, CI and available worker sessions. An old timestamp, missing chat reply, paused schedule or expired heartbeat does not revoke an active writer's lease. Only root publishes its named branches; all reviewers are read-only. Unknown ownership means no write on that branch; continue only on a verified disjoint branch.
3. Reconcile every pending operation by its exact source SHA and remote receipt. Fetch/compare HEAD before accepting a save. Never infer a dispatched call, test, deployment or commit completed after a crash. Do not rerun paid or irreversible actions. A pending CI run is not a pass.
4. Execute only the manifest's first unfinished safe action. Reuse prior exact-SHA/source-hash proof. For a reproduced defect, run its smallest red/green negative/race test; then affected integration; then stable exact-SHA acceptance. Full logs belong in Actions, concise outcomes/hashes here. Required unrun provider/device/preview acceptance remains BLOCKED/UNTESTED.
5. Save meaningful source changes with expected-head safeguards. Save at task boundaries and approximately20–30minutes during sustained work; no empty heartbeat commits. Update the manifest/runbook when their facts change, verify remote HEAD/tree, and post1–3issue lines linking the immutable save. A new enclosing commit does not invalidate unchanged source proofs merely because this documentation changed.

## Current resumption order

Check PR131's current exact-source CI first. Its2994b285 checkpoint fixes only two reproduced CI harness/config failures frombd50c47 (absolute PGlite path portability and central scope-variable documentation). Runtime route/helper/SQL hashes and their independent proofs are unchanged. Repair only actual failures. The29-case offline interrupted-handoff proof and fresh-context reconstruction have now passed; obtain this branch's exact-head recovery CI and update the manifest with its receipt. No release approval is implied by source acceptance.

## Ownership and rollback

Root owns monaco-coordination-126-20261019, restricted to recovery/evidence docs, its new offline recovery scripts/workflow and its branch-only deployment disable entry. Root also owns the isolated successor PR131 branch; it has no competing writer. PR127 core,128IG,129Android,130reliability and prior evidence440a672 stay frozen. Use expected-head guards and never force-write protected or another worker's branch. The coordination predecessor is PR13010451b5/treeb7f0e511; reverting new coordination commits affects evidence/config only. PR131 rollback is a HOLD path; once any real dispatch exists, retain the unresolved ledger. Never restore an unguarded Pocket create path as a rollback shortcut.

## Single recovery watchdog

Existing automation6ad67a914bf48191b7f2d48d4325bf83, Monaco Crash Recovery, runs every2hours in Europe/London. No duplicate created. Its prompt now reads the latest issue/manifest, checks explicit RUNNING state plus independently verified lack of activity, suppresses repeated alerts for the same checkpoint, and never claims writer authority from heartbeat expiry. It can issue one recovery alert; no exposed capability can relaunch a true Work session. Old stale PR120 read-only QA automation6ad4a1dae13481919d0270149dc9eb69 was paused; no scheduled writer was enabled. Pausing a task does not terminate a running session. Keep the watchdog quiet for PAUSED/HANDOFF and pause it when all tracks are DONE or BLOCKED_EXTERNAL. Resume the existing one only on an active programme, rather than creating another.

## External gates, never fixture passes

| Gate | Exact dependency / accountable action |
| --- | --- |
| Six genuine scanner cases0/6; actual TP/FP/FN/precision/recall/latency absent | Authorised credential-managed executor for the intended benchmark project/key and gpt-5-mini-2025-08-07/default, independently bound runtime metadata and cap/receipt/cost admission. No new key or production diagnostic is authorised. Existing immutable fixture pins cannot silently become the new source SHA. |
| $5aggregate and historical$2 | Independent attributable costs/receipts and accepted persistent reservation controls; unknown costs remain unknown. No reservation/provider request made by this continuation. |
| Live Sites binding | Support17703606 has answered that the proposed concealed-key operator probe is unavailable; supported secure execution still unresolved. Do not duplicate the ticket, call billed health, replace credentials or deploy a probe. |
| Shared-live Supabase | pxlqvaddvghjjhenqmdh also serves live Sites. Specific approval, impact/privilege/locking/rollback review and accepted isolated tests before any persistent install. PR131 SQL is outside migrations and has no real verifier issuer/cutover proof. |
| Native Apple / Android | Signed exact build, authorised StoreKit/Google resources and physical-device testing. Source/unsigned mocks cannot accept purchase/restore or store release. |
| Manual preview/browser | A manual preview reload hit an explicit browser URL/authority policy denial. No retry/workaround/new surface. Exact-source synthetic CI is separate; no final manual screenshot/device PASS. |
| IG / brand / growth | Authenticated authorised IG DEMO and applicable terms/data rights; no orders. Public rename/legal/financial-promotion/privacy approval and explicit publication/outreach decision. Assets remain unpublished. |

Owner's existing active£4.99 binding/admission in Sitesv179 is accepted; do not repurchase, re-link or overwrite the live repair. Production/customer/Stripe/sharedDB/credentials/prices/stores/main remain untouched. Core release is analysis-only; IG is independent and OFF.

Universal restart: Resume Operation Monaco from the newest verified checkpoint in issue126; read latest comments and manifest, positively verify writer ownership/current heads, execute the first unfinished safe action, reuse passed tests and save. No unapproved paid/live/merge/credential actions.

## Offline rehearsal scope

Run node scripts/verify-monaco-recovery.mjs --proof docs/monaco-126/qa/recovery-proof.json. The proof uses only temporary throwaway Git repositories, a local bare remote, filesystem receipts and distinct stopped/restarted Node processes. It commits one allowlisted local result once; another process records NOOP without a duplicate action/commit. Wrong owner, changed head and unknown/expired lease refuse. Its29cases also cover quiet watchdog states and an exclusively created one-alert receipt. Policy helpers are fixture-only and cannot launch Work, acquire a real lease, execute arbitrary manifest commands or send a notification. Actual automation delivery/deduplication and true Work relaunch are not proved.

The fixture sub-schema uses worker/ownership/checkpoint/nextSafeAction plus independently supplied current observations, an unexpired explicit fixture owner receipt and a manifest digest. Real coordination identity uses an external GitHub issue receipt because the file cannot self-embed its enclosing commit. The production manifest is descriptive recovery state, never an automatic execution capability. Inconsistent receipts, intermediate power loss, dirty state or stale locks stay HOLD for explicit reconciliation; this is not a hardware power-loss test.
