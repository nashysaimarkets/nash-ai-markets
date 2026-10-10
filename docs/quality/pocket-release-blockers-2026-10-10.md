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

## Provider integration checkpoint

Ledger repair commit `6fc79fb2ff07069eb7aa276cb5eaf11ebd8ae94f`: Quality CI 38071250470 and packaging 38071250469 passed mandatory free steps. Exact preview `dpl_6EJ5ZLCWhJhxnWqXfNrgnyFnRjhG` READY at https://nash-ai-markets-49va1we4k-nash-ai-markets.vercel.app. Raster endpoint returned six PNG/crop hashes, providerCalls=0; live scanner stage SKIPPED, not accepted accuracy.

Successor source adds per-call reservations around every analysis provider request and internal benchmark scope, no customer-header bypass. Receipt migration was transaction/rollback tested and installed on staging only (20261010172411). Request/response identity is immutable, identical receipt is idempotent, conflicting receipt or settlement is denied; usage tokens do not invent dollar charges. Zero real ledger rows and hard hold remains true. Five failing-before-implementation provider regressions now pass. Local full unit suite 884/884, typecheck, production build, rendered HTML, secret scan, ops, four render and eight production simulations pass; lint has eight pre-existing warnings, no errors.

Free mobile checker race reproduced and fixed: wait for the exact analysis alert instead of the earlier preflight alert. Nine intercepted Chromium mobile flows pass, 8 fake preflights/3 fake analyses, zero paid requests and zero browser JS errors. This is browser safety evidence, not physical-device or genuine scanner evidence.

OpenAI usage inspection redirects to account sign-in. Historical attribution cannot be resolved from this session without authorised account access. Connected Stripe account is live only; no live purchase made.

## Complete blocker register

No row may be removed without linked completion evidence or an explicit owner product decision. A preparation task does not close a runtime gate.

| ID | Requirement | Current status | Completion evidence / dependency |
|---|---|---|---|
| ENG-01 | Exact candidate CI/build/native Sharp packaging | Starting SHA PASS; successor pending | Completed mandatory steps on final SHA, not workflow colour alone |
| ENG-02 | Identity/preflight/malformed price/cancellation guards | Earlier regressions and intercepted Chromium PASS | Preserve; final candidate browser run, physical device proof separate |
| BUD-01 | Historical OpenAI test spend/pending/retries/project mapping | BLOCKED | Correct project/request dollar attribution; daily/org totals and credit balance insufficient |
| BUD-02 | Durable ledger transactional verification | Staging SQL and concurrent reservations/claims PASS | Migration installed in staging, zero real ledger rows; production/configuration not activated |
| BUD-03 | Per-provider-call reserve/claim/receipt/settlement integration | FREE VERIFICATION PASS; activation blocked | Main/precision/rescue/context calls individually reserve then claim; immutable provider receipts persist. Actual dollars still require authoritative reconciliation; unknown costs remain committed |
| BUD-04 | Exact spending approval and verified remaining $2 | BLOCKED | Separate owner approval after BUD-01; no paid calls until proven |
| ACC-01 | Six labelled real Levels measurements | UNMEASURED | TP/FP/FN, precision/recall, latency, negatives, raw exact-SHA receipts |
| ACC-02 | Six labelled real Patterns measurements | UNMEASURED | Same; real positive pattern and geometry acceptance required |
| ACC-03 | Six labelled real Liquidity measurements | UNMEASURED | Same; sweep, pool/reclaim and evidence-chain checks |
| ACC-04 | Broader realistic corpus and acceptance criteria | OPEN | Multiple instruments/timeframes/resolutions; agreed documented thresholds, no invented ground truth |
| UX-01 | Real mobile upload/replacement/multiple images/axes/overlays/controls | PARTIAL | Mocked Chromium is free safety evidence; real scanner and iPhone/Safari/native remain required |
| UX-02 | Real latency/timeouts/network recovery | PARTIAL | Mock timings are not provider performance; real p50/p95 and timeout/cancel billing semantics required |
| INT-01 | Approved UI/scanner/native branches reconciled | OPEN | PRs #95, #102–104, #105–111 and native approved-build47 line reviewed against candidate; no blind merges |
| COM-01 | Registration/login and paid entitlement enforcement | CONFIRMED SECURITY BLOCKER | Independent review found no authenticated paid-access guard before analysis provider calls; also preflight, levels, review and follow-up. Repair must use Pocket-specific entitlement, not terminal Pro/Elite or browser assertions; real E2E still required |
| COM-02 | Apple sandbox purchase/cancel/restore/grace/entitlements | BLOCKED | Native source/build/ASC and physical iPhone evidence; repository candidate has no native directory |
| COM-03 | Stripe web subscription/webhook/customer return flows | UNVERIFIED E2E | Connected Nashaimarkets account is live; test-mode/customer test resources not yet established; no live purchase |
| SEC-01 | Independent code/security/privacy review | REVIEW FOUND BLOCKER | Read-only review confirmed COM-01; ledger/provider receipt changes reviewed with no concrete defect found. Exact final candidate review and all high findings resolved still mandatory |
| SEC-02 | Supabase auth/database configuration | PARTIAL | Staging advisor: leaked-password protection warning; 14 RLS/no-policy informational entries require access-intent review, not automatic public grants |
| IOS-01 | Native source integration/signed build/store compliance | BLOCKED | Approved-build47 native line differs materially from PR #112; signed tooling and immutable web pin must be verified |
| AND-01 | Applicable Android build/distribution/device checks | UNVERIFIED | Determine current native project/release target and verify signed build/device |
| REL-01 | Website assets/privacy/terms/store listings/pricing consistency | OPEN | Verify final release assets without changing pricing |
| REL-02 | Production database/env/rollback rehearsal | OPEN | Stage production-equivalent build; verified migration plan and tested known-good rollback |
| REL-03 | Merge/deploy/distribute/post-release customer health | HOLD | All preceding mandatory gates pass before controlled authorised launch |

## Integration evidence requiring action

PR #95 (`design/source-chart-levels`, `5d0f435c...`) targets `ops/pocket-approved-build47-2026-09-29`, not main. Its described original-pixel OCR/native purchase/restore work is not automatically present in PR #112. The approved native base `e3809f9b...` has Capacitor, signed pipeline, Swift StoreKit, Apple paywall and customer scanner paths absent from this candidate. PR #104 complete frontend rebuild is also a separate unmerged branch. Do not erase these requirements or claim the web candidate is an iOS release. Reconcile integration on the candidate with regression coverage before any native build/public release.

## Restart instruction

Resolve current PR #112 exact head, active writers, completed CI and matching preview. Preserve verified repairs. Provider integration is prepared and free-tested; do not repeat completed ledger work. Resolve COM-01 next using Pocket-specific server entitlements; reconcile native/customer/design integration separately. Hard hold stays true. Obtain request-attributed billing and real native/device resources only for their blocked actions. Never convert skipped paid tests or mock flows into release signoff.
