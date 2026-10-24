# Current continuation — tested expiry-recovery proposal awaiting owner amendment

**The concrete recovery proposal is published, locally tested and independently reviewed. It is not an owner amendment, installed lease, activation or paid-scan result.** Case `v2-d002` remains **HOLD**.

The proposal is in [its actual pull request](https://github.com/nashysaimarkets/nash-ai-markets/pull/148), commit **`7d3b310b92ab992196825202aee0d891c04e5fb1`**, tree **`82726f26e3ba1c75d7e32cb6421d7478b4326616`**, based on the separate proposal parent `b4d5a71c8077f43a83c29e551eb4cce5bb463e19` / tree `4f3be585b4af279429c48f018741eebf09e35208`. The canonical checkpoint predecessor remains `64db45a872031cb5c4754112b5c3a0991be8c0bb` / tree `077dd6db6a365229bba11a957652ceb5aa9cb78f`; the proposal branch is not the canonical documentation head. [Its manifest](https://github.com/nashysaimarkets/nash-ai-markets/blob/7d3b310b92ab992196825202aee0d891c04e5fb1/docs/monaco-126/scanner-evaluation-v2-2026-10-24/expiry-recovery/proposal/PROPOSAL-MANIFEST.json) is SHA256 `73d0d374226cee9e279cf9c9ab6c160093af5688adb9cc895cf3dd5f6b396ecb`; proposal digest `b70a4e2371e6832ed7f7b717f0b4b8a0e9665a24ba45c9fe565f1cafe5820602`; install SQL digest `b44fb933c442c4e78b5e55af9581ea706569ed6fc3ef78faa62cdf27aefbb306`. [Independent source acceptance](https://github.com/nashysaimarkets/nash-ai-markets/blob/7d3b310b92ab992196825202aee0d891c04e5fb1/docs/monaco-126/scanner-evaluation-v2-2026-10-24/expiry-recovery/evidence/INDEPENDENT-RECOVERY-REVIEW.json) is SHA256 `8685ccd61ec3999a9b6c3a8178d853e8c6d7b94907a6ea78be1f8d669eace41e`.

| Evidence | Result and limit |
|---|---|
| [Actual disposable SQL and generated-query suite](https://github.com/nashysaimarkets/nash-ai-markets/blob/7d3b310b92ab992196825202aee0d891c04e5fb1/docs/monaco-126/scanner-evaluation-v2-2026-10-24/expiry-recovery/tests/evidence/FINAL-PGLITE-SQL-RECEIPT.json) | **21/21 passed**, zero failures/skips. Executes the accepted old/v2 SQL, actual new install/grant/RPC and owner PRE/POST/terminal queries. PostgreSQL 18.6 in cached PGlite WASM; single-connection role switching. No hosted PG17, concurrent-session, network-login or TLS claim. |
| [Materialization and generated-opener checks](https://github.com/nashysaimarkets/nash-ai-markets/blob/7d3b310b92ab992196825202aee0d891c04e5fb1/docs/monaco-126/scanner-evaluation-v2-2026-10-24/expiry-recovery/evidence/FINAL-MATERIALIZATION-RECEIPT.json) | **9/9 passed**. Includes rejecting altered recovery modules before import or private-key access. These checks have a different scope from the SQL suite. |
| Current installed protocol | Original immutable expired permit; **no installed renewal/recovery lease**. The proposal and fixture approval data do not confer authority. |

The proposed change permits one immutable lease for **the same** `v2-d002-attempt-1`, run **40105387615**, job **120905891814**, attempt **1**, only if fresh evidence still proves it was never claimed or sent. It preserves the original scope, expired permit, request pins, original history, paid runtime `20783ed5e8eb95a11df86b0d60766ffcbbf4fa79` and app `2812bfbc6e8f62e93d0bc56957fd5ce71cc819dc`. The proposed lease is at most 60 minutes, with login at most 20 minutes inside it, inside the unchanged scope expiry **25 October 2026, 12:40:25 UTC**. There is no retry, new attempt, new credential or added budget.

The SQL checks include unchanged full original rows/digest, exact-identity acceptance, required submission/receipt/accounting order, duplicate and privilege denial, immutable UPDATE/DELETE/TRUNCATE guards, expiry/revocation, missing/NULL authority and prior claim/send rejection. A freshly rehashed **Yes to a rejection prompt is refused**. Late authentic receipts/accounting preserve the full hold after dispatch expires; they do not reopen sends or establish an actual bill.

**Next action:** present [the exact affirmative owner prompt](https://github.com/nashysaimarkets/nash-ai-markets/blob/7d3b310b92ab992196825202aee0d891c04e5fb1/docs/monaco-126/scanner-evaluation-v2-2026-10-24/expiry-recovery/proposal/OWNER-AMENDMENT-REQUEST.txt) and request **only the distinct one-time unused-test-window recovery amendment**. The existing scan/spending scope is already recorded. Do not request new keys, budget or repeated spending approval. Until this distinct decision is recorded and fresh exact grant/lease/protocol evidence is independently accepted, do not install, activate, release the protected job or call the provider. A later case never follows automatically.

The last retained owner observation, **24 October 2026 at 16:14:19.321 UTC**, records the original d002 permit expired at **15:50**, claimed **false**, sent **false**, runner **NOLOGIN** and **zero sessions**. This draft does not refresh that hosted observation. The same protected run remains the intended target; root keeps writer claim **6384437116**, extension **6384669426**, **ACTIVE**, with the single exact d002 branch rule and protected review gate retained. The cleanup-required guard remains unchanged and false; completed d001 cleanup is historical.

Accepted image source **`a3b108d59d4cd530b326a0e9a106e671aaead265`**, tree **`4424bffcba24f8285fae5e945f99eaa9fc956dcd`**, and documentation checkpoint **`546cd04ca84f71b1830d5712c85a424f0a2e3fc2`** remain unchanged: **75/75 affected checks**, accepted exact-source CI, and **13/13 eligible saved horizontal candidates on five development pairs**, with maximum error **0.5000000000001137 original pixels** under the unchanged one-pixel tolerance. These are geometry-only results. Semantics remain unscored, d005 approximate-price eligibility remains HOLD, and all **44 held-outs remain untouched**.

The original paid d001 geometry failure and full **USD 0.33** hold remain; last retained aggregate exposure is **USD 1.8364**, with actual billed cost unknown. D002 has no claim/send in the cited observation. All remaining paid cases remain HOLD. Schedules stay **OFF**; main, deployment, Apple/store release, pricing and existing credentials are unchanged. This proposal publication is not a new financial reconciliation or a release.

## Preserved prior checkpoint

The entire previous checkpoint follows unchanged. Its historical statements remain evidence for their recorded times. This override replaces only the former amendment-preparation next step. Resolve the enclosing documentation commit from the containing publication and latest Issue126 receipt.

# Current continuation — d002 permit expired unused, 24 October 2026

**Current override: `v2-d002` remains HOLD. Its original permit expired unused; the same first-attempt protected run is still waiting.** No d002 activation, protected release or provider call occurred. The accepted image repair and its completed CI/geometry evidence remain valid and unchanged.

## Exact observed expiry

The [authoritative retained observation](scanner-evaluation-v2-2026-10-24/execution/v2-d002/EXPIRED-UNUSED-PERMIT-OBSERVATION.json), SHA256 `7f51293ec8d0c8609abf03f9f4c87a05937417f9e14122a420e83110ed15c337`, records:

| Field | Recorded value |
|---|---|
| Case / attempt | `v2-d002` / `v2-d002-attempt-1` |
| Run / job / attempt | `40105387615` / `120905891814` / `1` |
| Wrapper | `b7f2927f2c9438b18a9ce042904259a4acd11323` |
| Static evidence | `778a47fce8405dca6b22f14a3c7b55e858f5e71e` |
| Permit admitted | 24 October 2026, 15:07:25.068 UTC |
| Permit expired | **24 October 2026, 15:50:00 UTC** |
| Owner observation | **24 October 2026, 16:14:19.321 UTC** |
| Permit current / claimed / sent | **false / false / false** |
| Runner | **NOLOGIN, zero sessions** |

Root reports that this exact run/job remains waiting behind its protected environment. The permit expired before activation. This is not a paid scan, provider failure, consumed case or reason to reset a case identity. The current contract makes the permit immutable and has **no renewal operation**.

## Current continuation boundary

The [independent contract review](scanner-evaluation-v2-2026-10-24/execution/v2-d002/EXPIRED-UNUSED-v2-d002-40105387615-CONTRACT-REVIEW.json), SHA256 `76bcf22e13476dee8a9862c8ef136e9e41ba7bb4feb33be0fab93edeacdb3fc9`, confirms **HOLD: no renewal path in the current accepted contract**. A still-current overall spending scope does not itself renew the expired per-run deadline.

The proposed recovery is a narrowly additive **offline expiry amendment** for the exact unused attempt and the same waiting run. `precision_contract_fix` is preparing the implementation and actual local SQL checks; `scanner_independent_review` is reviewing it independently. It is **not approved, not installed and not an effective lease**. The concrete proposal publication and final amendment-review receipt are **PENDING / NOT CREATED**. The separate owner-decision document is expressly proposed text, not authority.

**Next action:** prepare, test and independently review the concrete amendment, then publish its exact source, actual SQL results and review. **Only then request the new one-time unused-test-window recovery permission.** This is not another scan or an additional spending-approval request: the already approved d002 limit remains USD 0.33. The proposed window would be at most 60 minutes and inside the unchanged scope deadline, 25 October 2026 at 12:40:25 UTC; no window has been issued. Until distinct amendment authority and actual installation/lease observations exist, preserve the original permit and history, keep the exact pending run waiting, and keep activation, protected release and provider dispatch on HOLD. Do not infer readiness from an offline draft or silently edit/delete/reissue the old permit. No later case follows automatically.

Root writer claim [6384437116](https://github.com/nashysaimarkets/nash-ai-markets/issues/126#issuecomment-6384437116), extended by [6384669426](https://github.com/nashysaimarkets/nash-ai-markets/issues/126#issuecomment-6384669426), remains **ACTIVE**. One temporary rule for `monaco-scanner-evaluation-v2-run-v2-d002` remains in the existing protected environment, with its review gate maintained, so the **same** waiting run can remain available if legitimately amended. This is not an activated runner or an open release gate.

`ACTIVE-RUN-CLEANUP-REQUIRED.json` remains unchanged and false. It still records the completed historical d001 cleanup; d002 was never activated. The earlier six temporary branch-rule removals remain historical evidence. They must not be described as proof that the currently retained d002 rule has been removed.

## Accepted repair and preserved scope

The accepted executable remains **`a3b108d59d4cd530b326a0e9a106e671aaead265`**, tree **`4424bffcba24f8285fae5e945f99eaa9fc956dcd`**, with documentation checkpoint **`546cd04ca84f71b1830d5712c85a424f0a2e3fc2`**, tree **`366afbcbabb211d73274620552c2aeb67fafd4a9`**. Its independently accepted **75/75 affected checks**, exact-source CI and **13/13 eligible horizontal candidates across five saved development pairs** are unchanged. Maximum saved geometry error remains **0.5000000000001137 original pixels**, with zero DOM/projection delta and unchanged one-pixel tolerance. These are geometry-only results; semantics remain unscored and d005 retains its approximate-price eligibility HOLD.

The frozen paid runtime `20783ed5e8eb95a11df86b0d60766ffcbbf4fa79` and app `2812bfbc6e8f62e93d0bc56957fd5ce71cc819dc` remain distinct from the repaired browser source. The original paid d001 geometry failure and full USD 0.33 hold remain unchanged. Last retained aggregate exposure remains USD 1.8364; actual billed cost is unknown. The cited expired d002 observation contains no claim or submission and is not a new financial reconciliation.

Cases `v2-d002` through `v2-d006` remain **HOLD**; all **44 held-outs remain untouched**. Schedules remain **OFF**. No main merge, deployment, Apple/store release, pricing change, new key or new paid result is claimed. Preserve all prior approvals, receipts, consumed identities and accounting history.

## Preserved earlier checkpoint — historical next action

The complete accepted checkpoint follows unchanged. Its repair/CI evidence remains accepted; this expiry record supersedes its former next-step and branch-cleanup status. Resolve the enclosing publication from the containing commit and latest Issue #126 receipt rather than embedding a self-referential SHA.

# Current continuation — published combined image recovery, 24 October 2026

**Current override: the published combined source has independently accepted exact-source CI and geometry-only review for all 13 eligible candidates on five retained development pairs.** Continue [draft PR #147](https://github.com/nashysaimarkets/nash-ai-markets/pull/147) on `monaco-scanner-image-geometry-126-20261024`. The executable source is **`a3b108d59d4cd530b326a0e9a106e671aaead265`**, tree **`4424bffcba24f8285fae5e945f99eaa9fc956dcd`**. The [combined source manifest](scanner-image-recovery-2026-10-24/exact-anchor-revision/SOURCE-MANIFEST.json) is SHA256 `d8ac2596538c05824275058f861179afa01fdc607901fe10568963327a9d4934`; its documentation parent is `7e8acec2d2f12734a4b570b0743f683be9c190d6`, tree `516543d233c2534a66f82b6134b6ff2a06f63d98`. Preserve the executable source pin separately from documentation-only successors and the older source `156417`.

## Preserve the distinct results

| Stage | Observed result | What it establishes |
|---|---|---|
| Published source `156417b4443068309a33c3364438948499775fad`, tree `471cffe98cea7f53324e81c4ffc5c70d798411fa` | Historical hosted runs **40100260065 and 40100263297 accepted**; the saved d001 browser replay passed geometry only. | Accepted evidence for that exact source and that saved image. It does not cover the later five-file repair. |
| Initial five additional observations on source `156417` | **d002, d003, d004 and d006 held at `NO_COHERENT_GRID_RECTANGLE`** before recovery OCR. **d005 held at exact-price eligibility**, with explicitly approximate prices. No candidate lines were placed in these five observations. | Four detector HOLDs and one selector HOLD remain permanent history. Geometry was unmeasured; none was a verified empty chart or an accuracy pass. |
| Grid-association repair with the old axis helper | Real browser axes verified for **d001, d002, d003, d004 and d006**. Independently compared emitted coordinates passed the unchanged **one-original-pixel** diagnostic. **Two boundary candidates were still omitted:** d002 placed 2 of 3 eligible candidates; d004 placed 1 of 2. | Five geometry-only passes for emitted coordinates, with incomplete placement explicitly retained. These earlier observations remain unchanged. |
| Combined grid and exact-anchor source `a3b108d5` | **13 of 13 eligible candidates placed**, with no omissions, across the five eligible saved pairs. Fresh projected and rendered geometry passes independent one-pixel review. **Both new source-bound CI runs are independently accepted.** | Geometry-only acceptance for these retained inputs. Semantic accuracy, d005 exact-price eligibility, paid-case readiness and production release are not accepted by this result. |

Historical source-156 CI acceptance is preserved in [its independent receipt](scanner-image-recovery-2026-10-24/prior-source-ci/EXACT-SOURCE-CI-INDEPENDENT-ACCEPTANCE.json). The initial HOLDs are preserved in [the initial replay review](scanner-image-recovery-2026-10-24/initial-five-replay/INITIAL-FIVE-REPLAY-REVIEW.json); the grid-only candidate and observations are preserved under [the grid-association checkpoint](scanner-image-recovery-2026-10-24/grid-association-revision/INTERIM-OBSERVATION-CHECKPOINT.md).

## Fresh combined geometry result

The [independent final one-pixel review](scanner-image-recovery-2026-10-24/exact-anchor-revision/INDEPENDENT-ONE-PIXEL-REVIEW.json), SHA256 `ae201f753bc19c02383c365f90b8cb02142956e9b6779ac820ad9befb7e1116b`, accepts the fresh observations bound to the combined source. Placed counts are **d001 4/4, d002 3/3, d003 2/2, d004 2/2 and d006 2/2** eligible exact candidates.

| Fresh combined measurement | Count | Maximum error in original pixels |
|---|---:|---:|
| Plot edges | 20 | 0 |
| OCR/grid anchors | 35 | 0.5000000000001137 |
| Projected horizontal candidates | 13 | 0.5000000000001137 |
| Rendered SVG lines | 13 | 0.5000000000001137 |

Rendered and projected coordinates agree exactly: maximum DOM/projection delta **0 pixels**. All reported errors meet the unchanged **one-original-pixel** diagnostic tolerance. Semantics remain **UNSCORED**. This is not six-case acceptance, a new paid-scan result or evidence about the untouched held-out set.

The older saved d001 result had four boundary errors of 0 pixels, seven grid-aligned OCR anchor errors no larger than 0.5 pixels, and four projected/rendered line errors no larger than 0.2142028368219826 pixels. Those remain **historical source-156 measurements**. Exact observed interior tick prices now also use measured rows; the fresh figures above replace no historical record and are the figures to use for this combined source.

## Scope of the combined repair

The grid repair associates measured horizontal strokes with actual candle occlusion and preserves independently measured top/bottom borders when the older sparse reader omits only those outer rows. It retains interior-grid, regular-spacing, missing-border, ambiguity and resource guards. The axis repair uses a measured row only when the candidate price strictly equals a reverified OCR tick price and the exact original grid-row evidence exists. Other prices keep the existing global fit. Price-domain, retained-evidence and containment checks remain in force; there is no clipping, extrapolation or nearest-price substitution.

The detector review is SHA256 `bee9550dab60a5e867f1b162eae02d427abb4f0ce9854406b33292eb65862766`; the exact-anchor review is SHA256 `c26e911e5c0d0ad1721fc219efc684a45b40335b640e659bb55c36666f5c8789`. Captured focused results are 18/18 detector checks and 19/19 axis checks, with narrow strict TypeScript passing for each. The independently accepted complete-tree hosted evidence is recorded below. These counts describe different scopes and must not be added into a claimed total of distinct tests. Reuse completed unchanged evidence rather than rerunning it to recreate a checkpoint.

The unchanged **d005 HOLD** remains a price-eligibility outcome. Its retained MAIN response used explicitly approximate support/resistance prices and an unsupported approximate pivot. No new d005 OCR replay, exact placement, verified absence or semantic pass is claimed. All horizontal candidates remain `UNVERIFIED`. Independent horizontal recovery does not grant pattern or liquidity authority to a held legacy axis. Support/resistance meaning, overall candidate recall, pattern/liquidity accuracy, verified absence, held-out generalization, physical-device latency, deployed HTTP latency and production-release acceptance remain unscored or unaccepted.

## Historical paid outcome, budget and cleanup

The original paid run [40095819408](https://github.com/nashysaimarkets/nash-ai-markets/actions/runs/40095819408) completed its three provider responses and **remains FAILED for geometry**. Its [permanent outcome](https://github.com/nashysaimarkets/nash-ai-markets/blob/b4d5a71c8077f43a83c29e551eb4cce5bb463e19/docs/monaco-126/scanner-evaluation-v2-2026-10-24/execution/FIRST-CASE-OUTCOME.md) is unchanged. Saved-input replays do not rewrite the paid result. Cases `v2-d002` through `v2-d006` remain **HOLD** pending the required gates and fresh case-specific admission; all **44 held-out cases remain untouched**.

The existing `v2-d001` reservation remains **USD 0.33 fully held**, with aggregate held exposure **USD 1.8364** inside the original allowance. Actual billed cost remains **unknown/unreconciled**. These offline repairs and saved-image replays added no provider request or inference reservation. Preserve all old receipts, case identities, approval evidence, consumed permits and ledger history; do not reinstall the migration, reset the ledger or replay a consumed case.

Runner cleanup remains closed: **NOLOGIN, zero sessions and six temporary environment branch rules removed**. All schedules remain **OFF**. Main, production deployment, Apple/store release and pricing remain unchanged.

## Exact-source hosted acceptance

The [independent CI acceptance](scanner-image-recovery-2026-10-24/exact-anchor-revision/EXACT-SOURCE-CI-INDEPENDENT-ACCEPTANCE.json), SHA256 `a73dd83beec7f5d67d0b2e938a85cd639f35287abd785d62d3a18a563c86ac77`, accepts both completed gates. Its [integrity companion](scanner-image-recovery-2026-10-24/exact-anchor-revision/INDEPENDENT-HOSTED-INTEGRITY-CHECK.json) is SHA256 `aab04c7b5a2ee406df384a8ac25ffafbacc7591346ae5f955cac9fc114ca027f`.

| Gate or check | Accepted result |
|---|---|
| [Affected run 40103559042](https://github.com/nashysaimarkets/nash-ai-markets/actions/runs/40103559042), job 120900470073 | **SUCCESS**, actual checkout `a3b108d59d4cd530b326a0e9a106e671aaead265` |
| Affected regressions | **75/75 passed**, zero failures or skips |
| Mounted browser lifecycles | **12 legacy checks and 21 recovery checks**, with their controlled OCR boundary recorded |
| Actual public browser OCR | **2/2 expected candidates**, actual same-origin Tesseract, maximum coordinate error **0.5 original pixels**, DOM/projection delta **0** |
| Complete TypeScript and production build | **PASS** |
| Lint and secret-pattern scan | **0 lint errors, 5 retained warnings**; **1,459** version-control candidates scanned, **PASS** |
| [Automatic image run 40103564070](https://github.com/nashysaimarkets/nash-ai-markets/actions/runs/40103564070), job 120900485010 | **SUCCESS**, actual PR merge checkout `a9f864ec0854a807330fadfb4701dab8148fb1b8` |
| Automatic image checks | **11/11** native raster tests; **6** raster/Canvas/OCR fixtures, including **1** correctly held degraded fixture; **13** mobile workflow, **10** intake and **4** Level Lab checks; Next build and isolated Sharp/libvips trace **PASS** |
| Labelled paid corpus in the automatic image gate | **SKIPPED**, not counted as a paid scan or accuracy pass |

Retained official commit records establish that the image gate's merge checkout and executable source have the **same complete tree `4424bffcba24f8285fae5e945f99eaa9fc956dcd`**. The affected gate checks out the executable source directly. The actual public OCR result is a separate public fixture; it is not a substitute for the five retained development-pair measurements above. The five lint warnings concern unused declarations; other dependency/runtime warnings remain recorded in the acceptance evidence. No warning-free claim is made.

The affected gate's official artifact **12563319937** is retained unchanged: **15,208 bytes**, **13 members**, SHA256 **`0426d184361f3cd09690d5a01936640498f644803074c0403652993e54e896a0`**. Its [durable reference](scanner-image-recovery-2026-10-24/exact-anchor-revision/CI-ARTIFACT-DURABLE-REFERENCE.json) identifies `libfile_5f46dc3138a08191a3dc77832dbcb58c`. The separate automatic image gate produced **zero artifacts**. Preserve these distinctions and the source bindings when recovering the evidence.

## Next named case preparation and active ownership

Exact-source CI is accepted. Root will publish/resolve this checkpoint and continue **existing next-named-case preparation for `v2-d002`** under the already recorded [owner approval 6384333029](https://github.com/nashysaimarkets/nash-ai-markets/issues/126#issuecomment-6384333029) and the independent bounded assessment. There is no repeated spending-approval, new-key or new-budget request.

That path keeps the paid acquisition runner **`20783ed5e8eb95a11df86b0d60766ffcbbf4fa79`** and approved app **`2812bfbc6e8f62e93d0bc56957fd5ce71cc819dc`** unchanged, followed by a **separately source-bound browser measurement on the combined repair**. The new browser source is not silently substituted into the approved paid runner. **All later paid cases remain HOLD** until fresh case-specific reassessment and actual source/runtime/run/permit/ledger bindings are complete. CI and saved-image acceptance do not themselves make a new paid case ready or executed.

Resolve the enclosing documentation head from **the commit containing this checkpoint and the latest Issue #126 publication receipt**. Do not embed a self-referential documentation SHA or substitute that head for the executable source pin. Writer claim [6384437116](https://github.com/nashysaimarkets/nash-ai-markets/issues/126#issuecomment-6384437116), extended by [6384669426](https://github.com/nashysaimarkets/nash-ai-markets/issues/126#issuecomment-6384669426), remains **ACTIVE** while existing next-case preparation continues. No writer release is claimed. Root alone publishes; this checkpoint does not enable schedules, merge main or authorise a deployment/release.

## Preserved prior checkpoints — historical

The records below remain intact history. This current override and newer Issue #126 receipts take precedence over former setup, pending-key, budget and next-action statements.

# Current continuation — isolated bounds repair, 24 October 2026

Read [scanner-geometry-repair-2026-10-24/CHECKPOINT.md](scanner-geometry-repair-2026-10-24/CHECKPOINT.md) and the latest Issue126 receipt. The bounds repair passes 68 distinct checks, independent source review and both hosted gates on exact source97925f. The separate image-derived recovery candidate is in progress and not yet accepted. It contains invalid geometry, without claiming recovered chart accuracy.

The first revised paid case completed and failed geometry; [its permanent outcome](https://github.com/nashysaimarkets/nash-ai-markets/blob/b4d5a71c8077f43a83c29e551eb4cce5bb463e19/docs/monaco-126/scanner-evaluation-v2-2026-10-24/execution/FIRST-CASE-OUTCOME.md) supersedes older pending-key/setup instructions. All other revised paid cases are HOLD. The migration and first permit are already used; do not reinstall or replay. Existing keys and approvals remain recorded. Runner NOLOGIN/zero sessions and six temporary branch-rule removals are verified. Root claims6384437116/6384669426 remain active; schedules are OFF.

## Historical recovery records below

# Current continuation: protected runner prepared, secure inference key missing

Read LAUNCH-CHECKLIST-2026-10-21.md, OWNER-LAUNCH-AMENDMENT-2026-10-21.json and the newest Issue #126 receipt. Necessary launch work is authorised; extra purchases still need approval. All schedules remain off. Resume PR #142 from the published commit in the latest receipt, preserving other branches.

The recovered 54-check runner evidence and 15 new auth-probe checks remain accepted. A further 45 focused checks passed for encrypted transport, the protected CLI, local action and bounded ciphertext relay. Exact locked runtime constructor imports passed. Source is prepared; no hosted inference occurred.

The previous signed-out-account blocker is closed. Real account controls, fresh costs/activity and live obligations were inspected. The private pilot was removed from all three training-data sharing selections and verified after reload. Recorded original-$5 exposure is zero at the snapshot, with its partial-day and settlement limits preserved. No allowance has been seeded.

Actual GitHub inspection found the inference API secret missing; the ledger password is already present. Finish the prepared secure owner key entry, then verify the real key binding and GitHub-stored password, refresh any changed exposure, seed immutable admission, and pin reviewed source/evidence/wrapper commits. Do not ask for another ledger reset, technical IDs, two human reviewers for internal diagnostics or another first-six scope approval. A necessary replacement inference key must be bound under its actual new identity.

The confidential six-only bundle and recipient decryption key are privately saved; see qa/launch-account-controls/INPUT-OUTPUT-PREPARATION.json. Use the run-bound public artifact and data-only ciphertext ref, freeze the first commit, retain encrypted outputs only after remote acknowledgement, and preserve private results before seven-day expiry. The future relay ref must also contain a minimal Vercel disable for its exact branch and no workflows. The invocation branch remains absent and literal workflow pins remain UNBOUND.

Real cases remain 0/6. Follow the consolidated commerce, integration, device/store and launch tasks next. No automatic continuation or schedule is enabled. The sections below are retained historical evidence and do not override this current checkpoint.

# Current continuation: protected ledger secret saved

MONACO_FIRST_SIX_LEDGER_KEY is present in monaco-first-six-inference. Owner review, no administrator bypass and exact branch restriction verified. See isolated-runner/CREDENTIAL-STORAGE-RECEIPT.json. No more password handoff is needed. The role remains NOLOGIN; secret presence is not proof of correct authentication. Continue the existing independently owned runner/security/budget work; preserve unknown prior exposure and disabled inference. Historical handoff instructions below are superseded.

# Latest continuation: Neon Free ledger installed; secure credential handoff pending

Resume PR141 at the latest Issue126 checkpoint, tested source2c5bbe11534ca288939025566fe7f097b23b26ff. Parent PR140/f4ee155 remains frozen. Read isolated-runner/SETUP-DECISION.md, SETUP-CONFIG.json and qa/neon-ledger/ACCEPTANCE.json first. This supersedes all historical third-Supabase capacity stops below.

Installed: one Neon Free London ledger, restricted NOLOGIN role, immutable verified physical identity, protected GitHub environment with owner review/no admin bypass and exact invocation-branch restriction.42 affected checks pass, including16 realPG17 checks and strict TypeScript. Current runtime password is not issued/stored; no credentialed job exists. Budget carry-in remains UNKNOWN, not zero, and no allowance is enabled. Original128 unaffected checks are reused.

Next: the correct Neon console sign-in is verified. Complete the prepared secure credential-generation/copy handoff, then paste directly into the named GitHub environment secret without reading clipboard/secret values. The connector issuance attempt did not complete; automatic review blocked screenshot/password revelation. No repeated sign-in, metadata verification, tests or first-six approvals needed. Keep NOLOGIN until storage and existing runner/processor/budget gates are verified. See isolated-runner/SETUP-DECISION.md for exact handoff and restrictions.

No OpenAI key changes/metadata rerun, extra44, Supabase mutations, production deployment/merge, store release, or Work automation changes. Never reset prior spending/history.

---
# Historical checkpoints — superseded by the Neon continuation above

# Latest outcome: setup approved; zero-cost capacity stop

The owner replied “Approved” to the exact setup package at checkpoint `c13d6b19b10f394b07168ab56d08d6ed5cb1cf0d`. `isolated-runner/OWNER-SETUP-APPROVAL.json` preserves it. Do not ask for the same setup, first-six paid approval or two chart reviewers again.

New authoritative read-only account evidence: organisation `pvepbcawhvzgpeqvpkjn` is Free; both known projects are ACTIVE_HEALTHY. Official Supabase billing FAQ permits two active free projects. The approved third isolated project therefore has no free slot. `qa/isolated-runner/APPROVED-SETUP-CAPACITY.json` records the evidence and inference. The earlier $0 price quote did not establish quota.

The approved stop condition has been applied before provisioning: no create attempt, environment/credential change, new cost, provider call, live-project change or automation action. No tests or metadata verification were repeated. Do not retry or work around the quota by pausing live projects, upgrading, changing memberships or creating organisations. Continue only if new evidence satisfies the saved zero-cost capacity condition or a revised configuration is separately authorised. The final Issue126 receipt gives this documentation checkpoint; executable source remains `918e9d28866998e9211e6e10f5d0a8f84955bebd`.

The implementation and proposed configuration below remain intact historical context; the owner decision is now saved.

# Current continuation: isolated runner and durable prior-budget bridge

Resume the newest Issue126 receipt for branch `monaco-isolated-runner-126-20261021-694d2e`, parent PR139 checkpoint `3e6dfd3f6db6bccebf7e178f85008d79ed5fb1a4`, coordination claim6312387711. Earlier branches remain frozen. PR140 source `918e9d28866998e9211e6e10f5d0a8f84955bebd`, tree `9a8c798c010e63fba07f4deff23510f095290772`. The enclosing final receipt pins the documentation checkpoint; do not treat the older PR139 SHA as the latest successor. Deployments are disabled for this branch.

Read `isolated-runner/SETUP-DECISION.md` and `qa/isolated-runner/ACCEPTANCE.json`. Completed: minimal injected SQL bridge, immutable carry-in exposure, exact isolated identity and18request pins, live-backend denial and conservative combined cap. All21new local checks and strict targeted TS pass; original128checks/source hashes are reused unchanged. No charts, private packet, metadata or full suites were rerun.

The runner/ledger remain proposed-only. The next owner decision is the single concrete zero-cost-only setup package: isolated project plus necessary database credential, protected runner environment and secure binding of the existing inference key, with read-only processor/budget evidence. No new OpenAI key, permission widening, plan upgrade, live project pausing or recurring execution. $0 project quote does not prove free capacity; stop if zero-cost availability cannot be established.

Budget exports end18October and cannot resolve current prior spent/reserved/unresolved amounts. All remain unknown; do not seed zero. Reconcile authoritative records through final cutoff, including other paths against the existing aggregate allowance. Preserve historic$2 separately. Processor acceptance and final secret/source/backend binding also require actual evidence. Real dispatch remains structurally disabled; declaration of approval or synthetic test success never enables it.

Internal-diagnostics amendment and existing conditional first-six approval remain intact: no two-reviewer request; ambiguous/weak4h unscored; d001-d006 only, <=18sends, zero retries/failover, <=$1.9176 within aggregate$5 after verified headroom. Extra44/B excluded. Automation untouched. Do not repeat completed work while awaiting this setup decision.

The sections below are historical; this continuation controls the current next task.

## Current continuation — PR139 internal-diagnostics amendment, 21 October 2026

Resume the newest Issue126 receipt on `monaco-internal-diagnostics-126-20261021-3e0cde`, parent PR138 `ab1ef077885dae5e3b878c394ea68f5025208dd2`. Verified executable source `579b781335e352034c5970dca06cc01b49ed81bb`, tree `41c3e8b35d2f8bc2c190b34d43e58682b6f17aab`; latest Issue126 receipt gives the enclosing documentation head. Verify expected head and ownership; automatic deployment is disabled. The owner amendment is recorded in Issue126 receipt6309011401. **The owner has no qualified chart reviewers: do not ask for two reviewers for INTERNAL DEVELOPMENT DIAGNOSTICS.** The original expert-reference/release protocol remains unresolved and separate; its historical reviewer requests below are not the current next action.

Read `internal-diagnostics/EXECUTION-AND-APPROVAL.md`, `APPROVAL-RECORD.json`, and `qa/internal-diagnostics/ACCEPTANCE-ENGINEERING.json`. The separately versioned protocol uses an independently calculated source oracle, checks objective prices/coordinates, reports existing-rule conformance separately, and keeps weak/ambiguous interpretations unscored. Six source cases/126 bars/504 OHLC coordinates checked;128 unique affected engineering checks pass, including the32 semantic checks rerun exactly once with raw logs retained. Zero real provider diagnostics, zero human references, zero scanner acceptance. Original50 packet, grants, all44 held-out cases, old acceptance rules and metadata key remain untouched.

The unmounted mock integration preserves existing reservation/concurrency/receipt recovery. Real dispatch is structurally disabled. Exact existing secure executor39467424486 is metadata-only; no isolated inference-key binding is verified. The read-only21October catalog found no installed benchmark pilot ledger; numeric headroom is unknown, not an unused$5. Read `qa/internal-diagnostics/EXECUTOR-BUDGET-EVIDENCE.json`; do not repeat that query without admissible new evidence or install anything in the shared live database.

The owner replied “Approved” to that exact first-six conditional paid request; Issue126 receipt6309459418 and `internal-diagnostics/OWNER-PAID-APPROVAL.json` retain the authority. Do not ask for this approval again. Scope remains at most18 calls, zero retries/failover and at most$1.9176 direct-token exposure inside aggregate$5, only after existing isolated inference binding, actual processor conditions and authoritative headroom are verified. These capabilities remain unverified; no newer evidence was supplied. The approval does not authorise new keys/permissions, live/database changes, B, deployment, merge or release. Stop retries until admissible capability evidence arrives; no completed tests/metadata/catalog/licensing investigation is to be repeated merely because cost was approved.

Recover the independently saved private source reference through `internal-diagnostics/PRIVATE-REFERENCE-RECEIPT.json`; recover the existing unchanged packet through `benchmark50/PRIVATE-PACKET-RECEIPT.json`. Do not publish private market-data arrays or regenerate the packet.

The following sections are historical recovery records. The amendment above takes precedence for the current internal diagnostic track.

## Historical continuation: PR138 — offline executor and first-six handoff

Resume the latest Issue126 receipt on `monaco-offline-executor-126-20261020-3e0cde`, parent PR137 `5d9fc4e7cc28d26a352d7d976db850f443e0b7e0`. Verify ownership and expected head. Deployment is disabled; earlier branches and the original 50-case packet remain frozen. `qa/offline-executor/ACCEPTANCE-ENGINEERING.json` binds the new code/test receipts. Do not rerun accepted data/source/application/Checkout/native/metadata work.

The unmounted adapter has only inert mock transport and disposable durable storage. It checks explicit scope, exact artifacts, separate A/B budgets, one-chart lease, duplicate claims, conditional rescue, cancellation, uncertain exposure and immutable receipt recovery. It cannot run a real provider or activate a live ledger. `benchmark50/OFFLINE-EXECUTOR.md` records its limits. Semantic rules remain a separate DRAFT; old thresholds/scorer/reporting are unchanged.

Two separate first-six packages are saved; recover using `benchmark50/FIRST-SIX-HANDOFF-RECEIPT.json` and verify the ZIP hashes. Each human receives only their own package. Do not expose the coordinator map, proposals, other reviewer's work or scanner answers. Do not repackage or regenerate the 50-case dataset. Weak4hH&S remains unaccepted. Human reviewed0; provider calls0; genuine accepted0.

The sole current owner decision bundle is `benchmark50/APPROVAL-RECORD.json`. Obtain qualified independent first-six references, adjudicate the weak canonical/negative/semantic rules, freeze exact artifacts, approve actual processor/security and financial scope, then specifically authorise any paid A run. A requires at least$1.9176 headroom under the existing aggregate$5 ceiling; B needs separate$14.0624 direct-token authority plus any applicable cash allowance. No unused balance or actual charge is claimed. Existing metadata verification/key and historical accounting are unchanged. Only genuine human decisions remain before further meaningful safe work; stop retries.

The prior checkpoints below are historical recovery evidence, not instructions to restart licensing or metadata tasks.

## Historical continuation: PR137 —50-chart preparation

Resume the latest Issue126 expected-head receipt on `monaco-benchmark50-126-20261020-3e0cde`; do not restart PR136 or its completed tests. Automatic deployment is disabled. Current complete privatepacket recovery is in `benchmark50/PRIVATE-PACKET-RECEIPT.json`; original and first-six replacement packets remain preserved separately. Verify the archive and FILE-INVENTORY hashes locally, not by re-downloading vendor samples or rechecking metadata. The final packet includes source ZIPs, SHA-pinned rights evidence,50case data/rasters/inputs/calibrations/proposals, two blank reviewer folders, first-six coordinator priorities,150exact request objects, raw-observations empty file and scoped test receipts.

50prepared /50documented source grants /0human-reviewed /0provider-executed /0measured /0passed. The4hcanonical H&S proposal remains weak and is placed in the near-miss allocation. Three original FirstRate inputs are unchanged. Five held-out market-date groups prevent development leakage;44charts are not44independent episodes.

Human reviewers receive only their own role directory and instructions. Use `benchmark50/REVIEWER-REQUEST.md` as the single owner action bundle. Do not claim independent acceptance from automated advisory review. Approve/adjudicate references and target-negative amendment, freeze scanner/reference/protocol/request hashes, then obtain actual finance/security admission and specific paidA/Bauthority. ScopeA≤$1.9176 directtokens under the existing aggregate$5cap/headroom; scopeB≤$14.0624 needs separate additional approval. Historicalledgers and metadata key stay unchanged. No provider call is an authorised recovery step.

Affected completed evidence:98reporting regressions plus targetedtypecheck;50source/calibration/input cases;36distinct tamper/control probes across retained source-specific receipts;150request previews. Do not rerun unrelated application/Checkout/native/metadata tests. The old strict negative scorer remains unchanged.

# Resume the six-case corpus handoff

Latest continuation: branch `monaco-scanner-corpus-126-20261020-3e0cde`, base PR135 `8aa7b8e02ce78629aebb8036fe6ca1ad9f69689a`, writer root3e0cde, Issue126 claim6297930794. Read its newest issue receipt and `corpus/README.md` first. Three existing originals and three new real-source candidates are now assembled; do not repeat source searches or downloads. Original GetData rights and all human reference acceptance remain unresolved. The private intake passes6 integrity checks and26 new regressions; lossless precision derivatives fix three old JPEG failures without changing originals or legacy pins.18 offline request previews are prepared, not admitted or dispatched. See `qa/corpus/ACCEPTANCE-2026-10-20.json` and `corpus/REVIEW-AND-RUN-GATES.md` for exact evidence and external actions.

The earlier release-completion history below remains unchanged evidence, not the next task.

Read newest Issue126 receipt first. Metadata is COMPLETE at7baacfb1; never rerun, replace or expand that key. Existing application proof is frozen PR133 at6609a006 (1190checks/three CI successes). The first source continuation checkpoint is e1e27902, on disjoint no-deploy branch monaco-release-completion-126-20261020-f8cd93, owned by root f8cd93. Earlier branches stay frozen.

Read RECOVERY-STATE.json and RELEASE-COMPLETION-2026-10-20.md. Verify remote head against the issue receipt before any mutation. Continue the first unfinished check, not the prior metadata task. The successor implements Checkout issuer/provisioning/recovery/reconciliation with live activation absent, scanner packet/raster/scoring preparation, and native signed-proof transport confinement. Local acceptance191affected Node checks +40actual TypeScript/disposable SQL checks, TS/lint/security PASS. Exact-source CI39471764318/attempt1 at f5e820b0 has PASSED, including all six real PostgreSQL17 overlapping-session races and the native production compile; see qa/release-completion/ACCEPTANCE-2026-10-20.json. Do not repeat these unchanged checks.

The workflow monaco-release-completion-qa.yml uses no runtime secrets and no metadata/inference/deployment. Its exact-source outcome is SUCCESS; reuse this proof while the pinned executable hashes remain unchanged. Receipt-only updates may use skip-ci after proving executable source hashes unchanged. Do not rerun unchanged1190tests or infer real provider/native acceptance from fixtures.

Final release-completion receipt and source-hash proofs are saved; GitHub Actions retains the logs. Its then-missing bear-flag5m/wedge15m images now have real-source proposals in the corpus successor. Rights and human annotation acceptance, including strict negative selection, remain open. Scanner genuine0/6. Specific inference/finance admission, commerce verifier/cutover/shared-live approval and signed physical iPhone/Android acceptance remain separate gates.

No paid inference, credentials/permissions, database/customer/production changes, deployments, merges or store releases are authorised here. Proposed SQL is outside migrations; Checkout helpers are not mounted. Rollback keeps HOLD and every unresolved/reconciled ledger record. A new session must establish ownership or use a disjoint branch; an inactive watchdog never grants another writer's lease.
