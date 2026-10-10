# Pocket Bullseye master release register — 10 October 2026

RELEASE HOLD. The owner's complete/verify/launch directive authorises candidate engineering and controlled release only after mandatory gates genuinely pass. It does not authorise unreconciled paid calls. Sole writer: this interactive Work Jimmy session; scheduled Scanner Fixer stays paused. Supporting automations are read-only. Never resume from an old checkpoint: resolve PR #112 head and check ownership first.

## Proven starting point

PR #112 candidate `4282ec77c01c3c367485a61d8f3bfd7330c1c0ca`, branch `qa/image-torture-corpus-2026-10-07`, draft/unmerged. Quality run 37980145730 and image packaging 37980145778 completed success. Exact preview `dpl_HGbc7ao9Uj55TBfQAmwKcTnSxfZM` READY; `/pocket` HTTP 200. Billed image stage skipped: accuracy remains unmeasured. Earlier completed preflight, identity, cancellation and decoded pixel repairs are preserved, not reported as new fixes.

## New reproduced defects and verification

1. Real staging Postgres reproduced a revoked reservation dispatch: after `enabled=false`, `submit_pocket_test_spend` returned `claimed=true`. Submit now holds the ledger lock and revalidates enablement, attribution, current project/approval and cumulative committed spend before claiming dispatch.
2. Regression failed when settling an actual $2.10 charge because the client capped actuals at $2. Actual incurred charges now record truthfully even above the reservation ceiling; settlement exposes cap overrun and future submissions stop. This is accounting, not permission to spend more.
3. Privileged SQL functions now live in `private`; exposed public RPCs are security invoker wrappers. Only service_role has execute permission; private tables have RLS and no direct service_role/anon/authenticated table access.

Executed complete repaired migration and `tests/sql/pocket-test-spend-ledger.sql` in staging inside BEGIN/ROLLBACK: history, scope, revocation, duplicate claims, submitted uncertainty, cumulative cap, overrun and grants passed. Verified schema rollback. Subsequently installed the tested migration on **staging only**, `pxlqvaddvghjjhenqmdh`; production untouched, no real ledger seeded/enabled.

Four concurrent real staging reservations each requested a simulated $0.60 against simulated $1 historical spend under $2: exactly one reserved and three were denied, committed $1.60. Four concurrent submit claims on that simulated reservation: exactly one true, three false. **No provider calls.** Disposable simulation rows removed; confirmed zero ledger rows. These synthetic financial values are test inputs, not owner billing history or expenditure approval.

## Complete blocker register

No row may be removed without linked completion evidence or an explicit owner product decision. A preparation task does not close a runtime gate.

| ID | Requirement | Current status | Completion evidence / dependency |
|---|---|---|---|
| ENG-01 | Exact candidate CI/build/native Sharp packaging | Starting SHA PASS; successor pending | Completed mandatory steps on final SHA, not workflow colour alone |
| ENG-02 | Identity/preflight/malformed price/cancellation guards | Earlier regressions and intercepted Chromium PASS | Preserve; final candidate browser run, physical device proof separate |
| BUD-01 | Historical OpenAI test spend/pending/retries/project mapping | BLOCKED | Correct project/request dollar attribution; daily/org totals and credit balance insufficient |
| BUD-02 | Durable ledger transactional verification | Staging SQL and concurrent reservations/claims PASS | Migration installed in staging, zero real ledger rows; production/configuration not activated |
| BUD-03 | Per-provider-call reserve/claim/receipt/settlement integration | OPEN | Every main/precision/rescue/context call individually bounded and reserved; unknown costs remain committed |
| BUD-04 | Exact spending approval and verified remaining $2 | BLOCKED | Separate owner approval after BUD-01; no paid calls until proven |
| ACC-01 | Six labelled real Levels measurements | UNMEASURED | TP/FP/FN, precision/recall, latency, negatives, raw exact-SHA receipts |
| ACC-02 | Six labelled real Patterns measurements | UNMEASURED | Same; real positive pattern and geometry acceptance required |
| ACC-03 | Six labelled real Liquidity measurements | UNMEASURED | Same; sweep, pool/reclaim and evidence-chain checks |
| ACC-04 | Broader realistic corpus and acceptance criteria | OPEN | Multiple instruments/timeframes/resolutions; agreed documented thresholds, no invented ground truth |
| UX-01 | Real mobile upload/replacement/multiple images/axes/overlays/controls | PARTIAL | Mocked Chromium is free safety evidence; real scanner and iPhone/Safari/native remain required |
| UX-02 | Real latency/timeouts/network recovery | PARTIAL | Mock timings are not provider performance; real p50/p95 and timeout/cancel billing semantics required |
| INT-01 | Approved UI/scanner/native branches reconciled | OPEN | PRs #95, #102–104, #105–111 and native approved-build47 line reviewed against candidate; no blind merges |
| COM-01 | Registration/login and paid entitlement enforcement | UNVERIFIED E2E | Real staging customer session; unauthorized API access and expired subscriptions denied |
| COM-02 | Apple sandbox purchase/cancel/restore/grace/entitlements | BLOCKED | Native source/build/ASC and physical iPhone evidence; repository candidate has no native directory |
| COM-03 | Stripe web subscription/webhook/customer return flows | UNVERIFIED E2E | Connected Nashaimarkets account is live; test-mode/customer test resources not yet established; no live purchase |
| SEC-01 | Independent code/security/privacy review | PENDING | Exact final candidate review and all high findings resolved |
| SEC-02 | Supabase auth/database configuration | PARTIAL | Staging advisor: leaked-password protection warning; 12 RLS/no-policy informational entries require access-intent review, not automatic public grants |
| IOS-01 | Native source integration/signed build/store compliance | BLOCKED | Approved-build47 native line differs materially from PR #112; signed tooling and immutable web pin must be verified |
| AND-01 | Applicable Android build/distribution/device checks | UNVERIFIED | Determine current native project/release target and verify signed build/device |
| REL-01 | Website assets/privacy/terms/store listings/pricing consistency | OPEN | Verify final release assets without changing pricing |
| REL-02 | Production database/env/rollback rehearsal | OPEN | Stage production-equivalent build; verified migration plan and tested known-good rollback |
| REL-03 | Merge/deploy/distribute/post-release customer health | HOLD | All preceding mandatory gates pass before controlled authorised launch |

## Integration evidence requiring action

PR #95 (`design/source-chart-levels`, `5d0f435c...`) targets `ops/pocket-approved-build47-2026-09-29`, not main. Its described original-pixel OCR/native purchase/restore work is not automatically present in PR #112. The approved native base `e3809f9b...` has Capacitor, signed pipeline, Swift StoreKit, Apple paywall and customer scanner paths absent from this candidate. PR #104 complete frontend rebuild is also a separate unmerged branch. Do not erase these requirements or claim the web candidate is an iOS release. Reconcile integration on the candidate with regression coverage before any native build/public release.

## Restart instruction

Resolve current PR #112 exact head, active writers, completed CI and matching preview. Preserve verified repairs. Continue BUD-03 with only fake providers/free tests while hard hold stays true; reconcile native/customer/design integration separately. Obtain request-attributed billing and real native/device resources only for their blocked actions. Never convert skipped paid tests or mock flows into release signoff.
