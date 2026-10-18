# Monaco recovered handoff — 18 October 2026

**RELEASE HOLD. Isolated handoff only. Candidate ownership remains UNRESOLVED.**

Branch: `monaco-handoff-20261018-7bca7eb-4fa5a604`.
Verified parent: PR114 `69697ed74fb1894cea48a1b870e4d55b7b2c397c`.
Candidate at publication preflight: PR112 `2bb9b1e1766a93fbb8b9cf97df98050964a9d3aa`.

Shell Git publication was blocked solely by missing HTTPS write credentials. The connected GitHub API recreated the five commits in order with their original messages, parents beginning at exact PR114, and **identical Git tree hashes at every step**. API-generated author/committer metadata changes commit IDs. The original five commit objects, metadata and history are preserved in [original-history.bundle](original-history.bundle); they are not lost or claimed identical to the new API IDs.

| Recovered original | GitHub counterpart | Identical tree |
|---|---|---|
| `ca2ddace797487e45c5748fb01e25ae869c70e83` | `d4cb7e1118bcc708dc2d1e8a5331109cee7e223c` | `73e937978e4e0b2ddfef8b87160445f5169d3fc3` |
| `2402eb827009133e325fab99aa29271ae4890469` | `2271438541952179f9bba76915761d9b343b6244` | `03b6bea2d1332e804ea461cbd50e9eb55222b3e0` |
| `ab9488181955830f9c587edc24fa2a33a8b39206` | `92583ce8e85b0778467bf11950e12993c935e569` | `ddb4964eb354d42499723f8968ac40e352ed9569` |
| `767e2209e9e623b78f6c806df3e191d9a0c218ff` | `b30492a739536e75f64fe2467c2562152c388594` | `d2c21428f34db888ac25422f6443ed1326a1c92e` |
| `7bca7eba096db3852f09093cdf786d062a11d784` | `057a96a13fd28b573337ceb6efdfbd8ea9c83f21` | `686f1007eb34cc873a0b0be2aa59a6b15587c808` |

The tested code counterpart is `b30492a739536e75f64fe2467c2562152c388594`; tree `d2c21428f34db888ac25422f6443ed1326a1c92e`. The later checkpoint counterpart `057a96a13fd28b573337ceb6efdfbd8ea9c83f21` adds documentation only. This recovery-delivery commit adds only this directory. No tests were rerun merely to reproduce already verified green output.

## Evidence recovered and verified

[Evidence and patch archive](evidence-and-patches.zip), SHA256 `e3c43c506f78fde1bbeee8b77b930ffd67dac614c2a9d4f2581e8a6fea2ca115`.
Original Git bundle SHA256 `a225282c4afe191f8bc52753aa40bcba6f428a18fca3849341917ba66183927b`.

All44 files listed by the archive's SHA256SUMS passed recovery verification. Original Git connectivity and bundle verification passed. Working checkout was clean. Full details and per-blocker owners are in [the recovered checkpoint](../monaco-hard-blocker-checkpoint-2026-10-18.md). Its statements about “local/unpublished” describe the earlier checkpoint; this recovery notice supersedes those publication-status statements only.

| Executed evidence on original767e220 / identical counterpartb30492a | Result |
|---|---|
| Full unit/source/handler suite | PASS984/984;0 failed;0 skipped |
| Typecheck / secret scan / operations validation | PASS |
| Lint | PASS0 errors;8 existing warnings |
| Component render / built artifact render | PASS4/4 and1/1 |
| Production simulations | PASS8/8; part of full suite |
| Sites/Vinext and Next production builds | PASS both |
| Isolated production-trace Sharp/libvips | PASS |
| Production dependency audit | PASS0 advisories |
| Full dependency audit | FAIL17 affected packages:8 high,7 moderate,2 low |
| Isolated SQL | PASS7 fixtures; complete rollback; PostgreSQL18.6/PGlite0.5.10 |
| SQL cache retention | BLOCKED pg_cron unavailable |
| Production catalog routing, isolated execution | FAIL “unrelated cancellation must be ignored”; staging catalog counterpart PASS |
| Baseline prepared PR114 suite | Before repairs971/977 PASS;6 FAIL retained as red evidence |
| Returning checkout regression | Before3 FAIL/1 PASS; after4/4 PASS, simulated Stripe/DB |
| Genuine provider scanner measurements | BLOCKED0/6; TP/FP/FN and latency unmeasured |
| New local browser/mobile, signed native, genuine purchase/restore | BLOCKED; not claimed |

Seven SQL passes: founding subscription isolation; historical spend ledger; immutable provider receipts; first-free admission; Apple ownership/events; web identity/customer lookup; benchmark pilot single-ledger tests. These do not establish hosted17.6 parity, multi-connection concurrency or independent QA. Initial pilot missing-private-schema setup error was corrected without changing SQL expectations. Independent QA did not complete because the review agent hit a usage limit. No persistent staging change was made.

## Exact recovered file scope

Paths are relative to repository root.

| Files | Repair purpose |
|---|---|
| tests/support/pocket-image-torture.ts | Keep genuine scored422 misses in aggregation while preserving release provenance and strict counters |
| tests/pocket-torture-spending-hold.test.ts; tests/pocket-torture-rate-limit.test.ts | Execute omitted actual helper; test release/veto, valid scored misses and transport failures |
| tests/pocket-benchmark-scope.test.ts | Prove server-only reserved benchmark scope, external-header denial and request isolation; no bypass added |
| tests/pocket-scan-access.test.ts; tests/operation-launch-readiness.test.ts; tests/production-launch-simulation.test.ts | Bind actual configured-price classifier and inspect real fail-closed guards |
| app/api/stripe/checkout/route.ts | Reuse authenticated UUID-bound Stripe customer on resubscribe; fail closed on lookup failure |
| supabase/migrations/20261014143000_bind_pocket_web_subscription_identity.sql | Service-only verified customer lookup with exact UUID binding |
| tests/pocket-checkout-customer.test.ts; tests/sql/pocket-scan-entitlements.sql | Bound customer/new customer/malformed lookup/anonymous scope and recreated-account regressions |
| package.json; package-lock.json | Next16.3.8, Sharp0.35.5, Capacitor8.5.3, React/RSC19.2.8, Vite8.0.16 and targeted security transitives |
| ios/App/CapApp-SPM/Package.swift; tests/pocket-native-server-bridge.test.ts | Match native Swift pin with JS Capacitor versions; source-level regression |
| tests/pocket-sharp-packaging.test.ts | Preserve direct production dependency and native tracing checks at patched Sharp pin |
| app/api/pocket/torture/route.ts; scripts/run-pocket-image-torture.ts | Remove TS suppressions made obsolete by corrected Sharp declarations |
| docs/quality/monaco-hard-blocker-checkpoint-2026-10-18.md; docs/quality/pocket-release-blockers-2026-10-10.md | Exact evidence and per-gate PASS/FAIL/BLOCKED owner/actions |

PR114 ancestry additionally supplies Stripe single configured-price classification and non-Pocket anonymous scope, corrected Auth fixture, Apple signed SUMMARY audit/no grant, unsupported Level-kind rejection, collinear range rejection, two-sided Liquidity scoring, and final benchmark database-release veto/provenance. Review those existing commits before selectively integrating. Genuine Apple signature/device/service acceptance remains outstanding.

## Newly refreshed P0: the approved$5 total is not yet enforced across ledger keys

Current source `supabase/migrations/20261014113000_pocket_benchmark_pilot.sql` defines ledger_key as primary key but owner_approval_ref is not unique. Claim locking/accounting operates per ledger_key. Two ledgers can reuse the same owner approval and each receive a5,000,000-microUSD cap. This static finding is present in the recovered code and **is not fixed by these patches**. The seven prior SQL passes do not cover it.

**Owner: NTP Release Sole Builder + independent SQL QA.** Add immutable canonical approval identity with one unique ledger or a genuinely atomic approval-level cumulative cap; cover two-key reuse, attempted reset/restart, concurrency and the six-case total. Use synthetic QA-only approval IDs: existing tests/sql/pocket-benchmark-pilot.sql currently uses real comment-6165012632. Do not activate staging or dispatch paid calls until this defect and all billing/settlement controls are proven closed.

## Ownership request and integration procedure

This interactive recovery session never acquired claim6182330717 and cannot release it on another session's behalf. Its text identifies a scheduled-engineer claim. NTP Release Sole Builder is enabled and has run recently; the schedule does not prove that all Work sessions are inactive. Current local agent inventory shows only this recovery agent, but does not enumerate cross-conversation Work sessions.

**To the session that posted6182330717:** provide a factual acknowledgement of whether you still own/write PR112, your current head and any in-flight mutation. If finished, explicitly release your own claim. **To NTP Release Sole Builder:** acknowledge this handoff; reconcile that claimant and any active Work writer, then publish your bounded exclusive claim. Do not infer expiry from age.

After exclusive ownership is established:

1. Fetch current candidate and this handoff. Compare expected current PR112 SHA before any candidate write. Begin on a disposable integration branch from that exact current candidate; review PR114 ancestry and select its verified repairs. Do not merge this entire branch blindly.
2. Review the four code counterparts in order: d4cb7e1,2271438,92583ce,b30492a. Their original base is exact PR114; adapt conflicts against current candidate without loosening tests. Preserve exact customer/subscription/UUID identity, stale-event denials, benchmark release veto and Apple SUMMARY non-grant behaviour. Copy/update checkpoint documentation after confirming the resulting SHA.
3. Fix the newly identified approval-level budget defect with focused regression coverage. Complete hosted rollback testing and independent SQL QA. If identity migration is already installed in any target, deliver an additive customer-lookup migration.
4. Run complete free unit/type/lint/security/render/production simulations, both production builds, isolated Sharp trace, actual Chromium Canvas/OCR/five-chart/confirmation/cancel/error/mobile checks. Verify required CI steps and immutable Vercel manifest against the resulting SHA. Do not relabel skipped stages.
5. Prepare the existing cancellation-routing migration20261013163500 for independent production approval. It fixes the live email-routing hazard but is not deployed by this handoff. No live customer mutation. Any later customer recovery requires authoritative exact UUID/customer/subscription/period/event evidence and separate controlled approval.
6. Prove effective API project/model/tier, full image/text/schema/output/retry bounds, aggregate <=$5 atomic control, isolated staging and authoritative per-request dollar settlement. Then, and only then, run six genuine cases sequentially, settling each before the next. Historical$2 scope remains separate. Unknown costs retain reserves.
7. Coordinate NTP Apple Native Gate/MacBook lab for physical iPhone five-chart flow, signed StoreKit sandbox purchase/restore/renew/refund/expiry, and independent final release QA. First-free activation stays OFF. No main merge, production/customer mutation, live purchase, extra spending assumption, pricing change, Apple submission or launch.

The immediate executable action is **builder acknowledgement and factual lease reconciliation**, followed by selective integration. Publication is not acknowledgement, integration, exact-new-SHA CI, or release acceptance.

## Original-object recovery

From a checkout containing exact PR114, download original-history.bundle from this directory, verify its SHA256, then use `git bundle verify <path>` and `git fetch <path> HEAD:refs/heads/local-monaco-original-recovery`. This creates a new local recovery branch only. Never overwrite an existing branch. It restores original successor7bca7eba and the original tested commit767e2209 exactly.
