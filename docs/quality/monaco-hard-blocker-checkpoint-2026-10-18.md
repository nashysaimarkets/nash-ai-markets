# Operation Monaco — hard-blocker engineering checkpoint
18 October 2026. RELEASE HOLD.

## Exact scope and ownership

- Published candidate PR112: `2bb9b1e1766a93fbb8b9cf97df98050964a9d3aa`.
- Published prepared PR114: `69697ed74fb1894cea48a1b870e4d55b7b2c397c`.
- Tested isolated repair code: `767e2209e9e623b78f6c806df3e191d9a0c218ff`; tree `d2c21428f34db888ac25422f6443ed1326a1c92e`.
- No AGENTS.md found in the checked repository or workspace ancestry.
- Historical claim [6182330717](https://github.com/nashysaimarkets/nash-ai-markets/pull/112#issuecomment-6182330717) remains unreconciled. Enabled **NTP Release Sole Builder**, automation `6ad4a1b998ac819191516c943eac05b8`, is the designated candidate writer. Its last observed run was 2026-10-18 11:03:28 UTC. An enabled schedule does not prove a run is inactive.
- This session did not acquire that lease. Work was performed in an isolated detached checkout based on exact PR114. No branch push, PR117 edit, main edit, deployment, production/customer mutation, trade, purchase or paid model call.
- Final branch integration and remote register changes belong to the sole builder. This document and its register addendum are prepared local patches. A coordination checkpoint may be published without claiming candidate ownership.

## Reproduced defects and local repairs

| Finding | Before | Change | After / remaining limit |
|---|---|---|---|
| Prepared PR114 full suite | 971 PASS / 6 FAIL out of 977 | Bind the actual omitted `publishedLedgerMeasurement` and configured Stripe classifier in extracted-handler tests. Update stale structural assertions to inspect the real single-item guard; preserve rejection expectations. | Final complete suite 984/984 PASS. No validation weakened. |
| Genuine scored acceptance miss disappears from aggregate | Actual route analysis HTTP200 + benchmark422 counted as unmeasured after the PR114 provenance changes; preserved regression failed 0 versus expected 1 measured case. | Require released matching case provenance and successful analysis, while separately admitting benchmark200/422. Retain compatible legacy422 transport shape. | Actual handler + aggregator regression PASS; invalid counters, unscored transport errors, denied/unsettled release remain rejected/unmeasured. |
| Benchmark authentication suspicion | Existing internal server AsyncLocalStorage exemption was misidentified as missing authentication in earlier comments. | Add actual-source no-provider scope tests; no new exemption. | External forged headers denied; only allowed non-idempotent atomic reservation enters scope; parallel ordinary request cannot inherit scope; throw clears scope; reserved spend retained. |
| Returning Pocket subscriber checkout | Existing checkout sends only customer_email; Stripe can create another customer, incompatible with permanent UUID/customer binding. Local before: 3 FAIL / 1 PASS. | Service-only UUID-bound customer lookup with verified identity/email, banned-user denial and strict result validation. Reuse bound customer; use verified email only when authoritative lookup returns null. No email-based customer discovery or client customer ID. | 4/4 actual handler tests PASS using simulated Stripe/DB; rollback SQL proves recreated same-email UUID cannot inherit customer and expired member keeps original customer. Genuine signed Stripe checkout remains BLOCKED. |
| Production dependencies | npm production audit: 7 affected packages, including 2 critical, 3 high, 2 moderate. | Next16.3.8, Sharp0.35.5, Capacitor core/ios/cli8.5.3; matching Swift package pin. React/RSC19.2.8 and Vite8.0.16; targeted transitive patches including image-size2.0.4 and undici7.30.1. Remove only Sharp TS suppressions made obsolete by corrected declarations. | Production audit zero advisories. Full audit still 17 affected packages: 8 high, 7 moderate, 2 low. See security limits below. |
| COM-01 duplicate Auth email fixture | Candidate fixture throws23505 against the observed unique partial index on auth.users(email) WHERE is_sso_user=false. | Retain PR114 sequential same-email/different-UUID fixture, plus checkout customer regressions. | Isolated rollback SQL PASS; auth rows and new tables absent after rollback. |
| Live founding cancellation routing | Fresh production function catalog still selects by email OR subscription. Isolated execution of the exact catalog body fails “unrelated cancellation must be ignored”. | Existing candidate migration `20261013163500_isolate_pocket_founding_subscriptions.sql` already repairs routing. No additional production change made. | Exact staging catalog body passes the same isolated rollback fixture. Production remains FAIL until separately controlled deployment and independently verified customer recovery. |

Local repair commits, in order:

1. `ca2ddace797487e45c5748fb01e25ae869c70e83` — harness and measurement aggregation; protected scope regression.
2. `2402eb827009133e325fab99aa29271ae4890469` — Next/Sharp/Capacitor security and Swift pin.
3. `ab9488181955830f9c587edc24fa2a33a8b39206` — repeat checkout customer binding and SQL.
4. `767e2209e9e623b78f6c806df3e191d9a0c218ff` — React/Vite and transitive dependency security.

The checkout RPC is added to the proposed identity migration because it is absent on inspected staging and has not been installed there. If another environment has already installed that migration, the owner must deliver an additive migration instead of relying on rewriting migration history. The checkout fails closed if the RPC is unavailable. Simultaneous first-ever checkouts and legacy unbound customers still require genuine commercial acceptance; this patch does not claim to solve those lifecycle cases.

## PR114 selective integration assessment

The isolated checkout includes PR114's exact-price single-item classifier, anonymous non-Pocket scope correction, COM-01 fixture, unsupported Level-kind rejection, collinear range rejection, separately labelled two-sided liquidity check, Apple SUMMARY audit, and final benchmark ledger release veto. Their free regressions pass in the complete local suite. Keep these patches reviewable separately from the new repairs. Apple tests exercise verification logic with supplied/mock inputs; they are not signed Apple service or device evidence.

Only the sole builder may integrate after explicit handoff and an expected-head check. Do not automatically merge PR114. Apply and validate on a disposable branch first, then rerun the required CI and immutable-preview tests on the actual resulting candidate SHA.

## Scanner evidence and six-case ledger

Fixture source: `tests/support/pocket-image-torture.ts`. These six charts are **synthetic**, not customer or exchange charts. Price axis110/105/100/95/90 and candle geometry are deterministic. Vector digits preserve the adjacent Bitstream/DejaVu licence notice. The real-chart golden manifest contains zero cases; the golden command reports “no privacy-approved chart fixtures are registered yet.” No real-chart data permission or labels were invented.

The following columns are genuine provider-measured TP/FP/FN. A dash means **unmeasured**, not zero or a successful negative.

| Case / timeframe | Levels TP/FP/FN | Patterns TP/FP/FN | Liquidity TP/FP/FN | Execution failure class |
|---|---|---|---|---|
| range-clear /30m | —/—/— | —/—/— | —/—/— | BLOCKED: project/cost/settlement/staging controls |
| double-top /1h | —/—/— | —/—/— | —/—/— | Same; no provider attempt |
| head-shoulders /4h | —/—/— | —/—/— | —/—/— | Same; no provider attempt |
| sweep-reclaim /5m | —/—/— | —/—/— | —/—/— | Same; no provider attempt |
| near-miss-chop /30m | —/—/— | —/—/— | —/—/— | Same; no provider attempt |
| degraded-no-signal /30m | —/—/— | —/—/— | —/—/— | Same; no provider attempt |

0/6 provider-measured. Precision, recall and latency remain unknown. Liquidity scoring is case-level: the two-sided range requires both labelled zones for its one TP; it is not independent per-zone reporting.

A separately executed **synthetic empty-output scorer control** fed empty levels/patterns and NONE liquidity into the scorer. This verifies bookkeeping only; it is not a scanner result:

| Case | Levels TP/FP/FN | Patterns TP/FP/FN | Liquidity TP/FP/FN | Control failure class |
|---|---|---|---|---|
| range-clear | 0/0/2 | 0/0/1 | 0/0/1 | omitted positive levels/pattern/both-side liquidity |
| double-top | 0/0/1 | 0/0/1 | 0/0/1 | omitted positives |
| head-shoulders | 0/0/0 | 0/0/1 | 0/0/1 | omitted pattern/liquidity |
| sweep-reclaim | 0/0/1 | 0/0/0 | 0/0/1 | omitted resistance/pool; wrong NONE versus SWEEP event |
| near-miss-chop | 0/0/0 | 0/0/0 | 0/0/0 | expected empty synthetic negative |
| degraded-no-signal | 0/0/0 | 0/0/0 | 0/0/0 | expected empty synthetic negative |

Free source tests also cover original-image coordinate transforms, crop/enlargement OCR remapping, price/axis disagreement, missing/blank/current-price validation, source/timeframe mismatches, cancellation, chart replacement and stale replies. These establish deterministic protection behaviour, not accuracy on unseen images. No real no-result or inaccurate-price incident was assigned a model root cause without a provider trace. Application429/provider503, malformed results, geometry/price rejection, and genuine scored422 remain separate failure classes.

## Separately approved maximum-$5 benchmark preparation

Approval [6165012632](https://github.com/nashysaimarkets/nash-ai-markets/pull/112#issuecomment-6165012632) is already recorded; no repeat spending approval is the current blocker. Preserve the separate historical$2 hold.

Before any paid request, Scanner Accuracy Lab and Sole Builder must attach:

1. Effective staging key → API organisation/project mapping; actual model access/tier and account pricing. Intended pilot project from the saved billing handoff is `proj_LTmAIE2Ve7gUAFJ9M74ZxIBI`; candidate runtime key mapping is unproven.
2. Reviewed upper bounds for all text/schema/output tokens and image dimensions/bytes, including main, primary_precision and rescue_precision. Unknown extra calls/retries must be denied, not guessed. Never use synthetic QA prices as real bounds.
3. Isolated installed pilot SQL, independent QA, protected configuration and exact candidate SHA. Atomic cumulative cap must be at most5,000,000 microUSD, with historical$2 scope separate. Account budget alerts are not an enforceable spend cap.
4. Authoritative per-request dollar settlement matching provider request/response IDs and ledger calls. Available daily/model exports do not provide that attribution; non-null actual per-call amounts are required by the current contract. Billing auto-reload/settings do not prove a$5 bound. Unknown cost must retain its reservation and block further dispatch.
5. Sequential one-case execution through the protected preview harness, beginning with range-clear, then double-top, head-shoulders, sweep-reclaim, near-miss-chop, degraded-no-signal. Save immutable source pixels/hash, full model result, HTTP/acceptance classification, all call receipts and latency. Reconcile before the next case; abort on unknown cost, timeout without settlement, wrong project/model, cap overrun or ledger veto.

After those controls pass, the guarded GET harness accepts `run=1&case=<one-case>`; its release-only `result=1` path must still pass the database veto. Source-supplied provenance markers are not cryptographic receipt proof. No live harness or CLI provider execution was performed in this work.

## SQL execution and independent QA limits

Staging project `pxlqvaddvghjjhenqmdh` is PostgreSQL17.6. Read-only catalog confirmed identity and pilot tables absent, no idle transaction at inspection, and the exact Auth partial UNIQUE index. A small BEGIN READ ONLY / local3s statement timeout /1s lock timeout / SELECT / ROLLBACK probe completed. That proves the small connector transaction path only; it does not explain or clear the earlier full-migration connector stall.

Local engine: PostgreSQL18.6, PGlite0.5.10, pgcrypto. Real SQL executes in disposable databases and rollback transactions, with synthetic Auth rows and observed index. Seven repository SQL fixtures pass: subscription isolation, historical spend ledger, provider receipts, first-free admission, Apple ownership/events, web identity/customer lookup, pilot ledger. Every rollback check leaves zero synthetic Auth rows and no migrated tables. Initial pilot setup lacked the prerequisite private schema; corrected isolated setup passes unchanged SQL.

Cache-retention SQL is BLOCKED locally: pg_cron is unavailable (0A000). Its scheduling expectations were preserved, not mocked away. These tests do not prove PostgreSQL17 parity, multiple-connection reservation races, hosted migration completion or real scheduled cleanup.

The requested independent QA agent supplied the checkout-customer risk but terminated on a usage limit before completing review. **No independent SQL acceptance was obtained.** Therefore no persistent staging change was attempted. No production SQL mutation occurred.

## Exact-SHA verification

At local code SHA767e220…:

| Check | Result |
|---|---|
| Full unit/source/handler suite | PASS984/984, zero failures/skips |
| TypeScript | PASS |
| Lint | PASS0 errors;8 existing warnings |
| Secret-pattern scan | PASS |
| Component render | PASS4/4 |
| Production simulations | PASS8/8, included in full suite |
| Operations documentation | PASS |
| Sites/Vinext production build + artifact validation | PASS |
| Built artifact render | PASS1/1 |
| Next16.3.8 production build | PASS |
| Isolated production-trace Sharp/libvips rasterization | PASS |
| npm production audit | PASS0 advisories |
| npm full audit | FAIL17 affected packages:8 high,7 moderate,2 low |
| Real-chart goldens | BLOCKED0 approved charts; intake command completed |
| Local Chromium workflow/OCR/mobile suites | BLOCKED runtime: headless-shell download invalid archive; installed Chromium launch denied socket operation |
| Physical iPhone / signed native / Apple sandbox / real Stripe purchase/restore | BLOCKED; not performed |

Remaining full-audit roots include braces → micromatch/fast-glob/ESLint/Vinext plugins; uuid → xcode/Capacitor CLI; older nested esbuild → Drizzle tooling; Cloudflare/Wrangler build tooling. Automatic fix suggestions include downgrades/major changes. Those were not forced. Dependency graph placement alone does not establish reachability: the security owner must verify bounded build inputs and upstream replacements before calling SEC-01 closed. The native dependency pin changed, but Swift compilation/signing remains untested.

Remote baseline evidence is separately bound:

- PR112 Quality run[38663737858](https://github.com/nashysaimarkets/nash-ai-markets/actions/runs/38663737858) and Image run[38663737877](https://github.com/nashysaimarkets/nash-ai-markets/actions/runs/38663737877): required free steps SUCCESS; paid stage SKIPPED.
- PR114 Image run[38803160142](https://github.com/nashysaimarkets/nash-ai-markets/actions/runs/38803160142): required free steps SUCCESS; paid stage SKIPPED. Full quality workflow does not automatically run for this non-main PR target.
- READY deployment `dpl_G4KULaMV7dr1xb8fVd5y4zYzPDXL`: [immutable preview](https://nash-ai-markets-ckrpy4ad5-nash-ai-markets.vercel.app/pocket). Vercel metadata and live /api/pocket/build-manifest both equal exact PR112 SHA2bb9b1….
- Desktop cloud browser opened /pocket and /pocket-next. Primary plus four optional slots are present; unready analysis is disabled. The no-credit demo explicitly labels synthetic content. This is interface inspection only.
- Five-chart upload, confirmation, cancellation/error-recovery and390px/mobile flow are NOT newly verified against the local repaired SHA. Existing CI browser evidence belongs to the published baseline. Upload was not driven on the live preview because it can trigger provider preflight and paid controls remain unproven.
- New local patches have no deployed preview or remote CI. Re-verify both after sole-writer integration.
- Hosted raster recheck: BLOCKED by automatic approval review during the request follow-up. The stated reason was possible scanner/provider spend without proven billing controls. No response was captured (the output file is empty), and the endpoint was not retried. Local isolated production-trace rasterization supplies the completed packaging evidence; no hosted raster pass or zero-provider receipt is claimed for this attempted check.

## Blocker register delta — owners, status and next action

Status below is the release gate; local component passes do not close an unverified external gate.

| ID | Status | Named owner | Evidence / change / result | Next action |
|---|---|---|---|---|
| ENG-01 | BLOCKED | NTP Release Sole Builder | Local984 tests, both builds and Sharp trace PASS; exact published preview PASS; lease unresolved | Reconcile6182330717, selectively integrate, run exact-resulting-SHA CI/preview |
| ENG-02 | PASS locally | Sole Builder + NTP QA & Competitor Watch | Existing identity/price/timeframe/cancel source regressions PASS; scoped benchmark tests added | Preserve on integration and run browser workflow suite |
| BUD-01 | BLOCKED | NTP Scanner Accuracy Lab | Billing export lacks request dollars/runtime key mapping; no paid requests | Obtain authoritative attribution for historical scope |
| BUD-02 | PASS locally | Sole Builder + independent SQL QA | Historical ledger/receipt rollback fixtures PASS; no new hosted concurrency claim | PostgreSQL17 staging QA/concurrency and persistence review |
| BUD-03 | BLOCKED | Scanner Accuracy Lab | Per-call/free fail-closed tests PASS; actual settlement unproven | Verify real accounting path; retain unknown-cost reservations |
| BUD-04 | BLOCKED | Owner + Scanner Accuracy Lab | Historical$2 scope unresolved; no new spend | Reconcile historical scope; do not mix with pilot |
| BUD-05 | BLOCKED | Sole Builder + Scanner Accuracy Lab | Separate$5 approval exists; pilot rollback PASS; staging tables absent | Prove controls listed above; independent QA before installation |
| ACC-01 | BLOCKED | Scanner Accuracy Lab | Levels provider TP/FP/FN unmeasured0/6; synthetic bookkeeping tested | Controlled six-case provider measurements |
| ACC-02 | BLOCKED | Scanner Accuracy Lab | Patterns unmeasured0/6; collinear rejection preserved | Same, with independently reviewed geometry labels |
| ACC-03 | BLOCKED | Scanner Accuracy Lab | Liquidity unmeasured0/6; two-sided matching preserved | Same; distinguish case-level from per-zone measures |
| ACC-04 | BLOCKED | Scanner Accuracy Lab + owner | Approved real-chart manifest empty | Supply consented/licensed originals and independent labels |
| UX-01 | BLOCKED | NTP QA & Competitor Watch + Apple Native Gate | Exact preview inspected; new local browser runtime unavailable | Exact-resulting-SHA five-chart desktop/mobile and device acceptance |
| UX-02 | BLOCKED | Scanner Accuracy Lab + QA | Cancellation/race tests PASS; actual provider latency unknown | Measure latency/timeouts and reconcile cancellation cost |
| INT-01 | BLOCKED | Sole Builder | PR114 plus four new local commits reviewed/tested; not integrated | Exclusive expected-head integration; PR117 untouched |
| COM-01 | BLOCKED | Sole Builder + NTP Stripe Customer Gate | Auth fixture/customer lookup rollback PASS; independent QA incomplete | Additive migration if needed; hosted QA and UUID/customer backfill |
| COM-02 | BLOCKED | NTP Apple Native Gate | Source/mock Apple checks PASS; no signed/device test | Signing, physical iPhone, sandbox lifecycle and ownership proof |
| COM-03 | FAIL | NTP Stripe Customer Gate + controlled production executor | Live catalog routing vulnerable; exact isolated reproduction FAIL, staging body PASS; checkout reuse repaired locally | Safe routing correction before any separately authorised exact-row customer recovery; genuine Stripe sandbox lifecycle |
| SEC-01 | FAIL | Sole Builder + NTP QA & Competitor Watch | Production audit0; full audit17; no completed independent sign-off | Resolve/adjudicate remaining build graph advisories, independently review |
| SEC-02 | BLOCKED | Database owner + QA | No hosted config changes; prior leaked-password/RLS intent gates not closed here | Review auth hardening and intended access; do not grant blanket policies |
| IOS-01 | BLOCKED | NTP Apple Native Gate | Capacitor/Swift package pins aligned; no Swift/signed build | Compile/sign exact candidate and prove immutable web pin |
| AND-01 | BLOCKED | Owner + native gate | No Android acceptance performed | Confirm applicability and supply required build/device evidence |
| REL-01 | BLOCKED | Owner + release QA | No pricing/public identity/assets publication | Final privacy/terms/store/retention and release-assets acceptance |
| REL-02 | BLOCKED | Database owner + independent QA | Isolated rollback proof; pg_cron/hosted parity/persistence not accepted | Production-equivalent staging rehearsal and independently reviewed rollback |
| REL-03 | BLOCKED | Owner + release QA | RELEASE HOLD, no merge/deploy/publication | Close mandatory gates and obtain final release approval |

## Handoff files and reproduction

The accompanying archive contains candidate→PR114 review diff, four exact local repair patches plus documentation patch, logs, audit JSON, SQL runners/package lock, exact catalog functions (no customer records), synthetic scorer ledger and remote CI/deployment metadata. SHA256SUMS detects artifact changes. Patch application is an isolated review operation, not permission to push or deploy.

Use Node24.19.0 (the executed environment), npm ci, then the repository checks listed above. SQL runner setup is intentionally outside the production dependency graph; use its own package-lock. Keep successful source tests, mocked calls, synthetic raster/scorer evidence, actual SQL engine execution, real-chart results and paid end-to-end receipts separate.

