# Android safety successor — source HOLD

Owner contract: issue126 commandE. Root is the only publisher on `monaco-android-safety-126-20261019`. Implementation base is the existing Android branch head `5a5e491bf85042937a6099a19effbc0b9e8933be`; publication parent is root's no-auto-deploy checkpoint `6f3f5e76a81e43eb64308b0a9174ad8eefed63cb`. Do not overwrite its `vercel.json`, the original Android branch, core PR127 or main.

**This is a deliberate recovery-only lockout, not a functioning Google subscription integration or release candidate.** The historical branch lacks the current UUID-bound subscription-access route and per-scanner server admission. No compatible current-account or Google ownership verifier was invented. It cannot safely authorize a scan or offer a new purchase until those exact dependencies are independently reconciled.

## Bounded repair

- Registered Java `purchase()` rejects before billing connection, catalogue or purchase-flow work. Hiding a button is not the only protection. Explicit status/restore query store state without acknowledgement; resume makes no automatic store request. Their shared result hard-codes `entitled:false`, `freeUseConsumed:true` and identifies pending/purchase presence as recovery metadata only. Purchase/order tokens are not returned to JavaScript and provider debug messages are not exposed. Independent review caught and removed the historical status/resume acknowledgement side effects before freeze.
- Actual JavaScript Google and shared native adapters ignore local entitlement, device free-use, asserted account/verification fields and the old entitled web fallback. Their output contains no account/email/transaction/purchase token. Shared purchase and direct Google purchase wrappers reject without invoking a store. First-free compatibility functions cannot replenish use.
- Actual primary/review request prefixes always refresh the blocked adapter and return before dispatch. Additional-request admission no longer bypasses checks for web. Platform identity stays accurate; web is not falsely labelled native to create a guard. These are client call-path fixes, not a server security boundary.
- Existing paywall is recovery-only: no Subscribe/price/free-result claim or purchase action; Restore, sign-in, support and close/focus behavior remain. Even a mocked restoration returning `entitled:true` cannot invoke its legacy unlock callback. The actual store price/product records are untouched.

## Reproducible offline proof

Run `node --test tests/pocket-android-server-admission.test.mjs` on Node22.19 or the executed Node24.19. No package installation is required. The dedicated workflow checks out its exact push SHA with read-only permission and no persisted checkout credential; it has no build, provider, deployment or store step.

The same eight regressions ran against the exact original five source files with the new fixture/helper supplied: **0 PASS /8 FAIL**, zero skips. Against the proposed delta: **8 PASS /0 FAIL**, zero skips. Actual JavaScript adapters, primary/review prefixes, additional admission and Restore handler are executed with synthetic store objects. Java verification is source inspection only; no Java/Gradle compilation, signed artifact, Play operation, native purchase, device test, runtime fetch or provider request was performed. No request/receipt cost or native release PASS is implied.

Minimal source intake consisted of five known files from the existing immutable branch. This does not hydrate or rebuild the old application. The large existing Pocket component has a narrow admission-only change; all unrelated chart/scanner/layout logic remains as inherited source.

## Exact remaining dependencies

1. Recover the Android wrapper/assets onto a separately owned successor of the reviewed hardened core backend and matching immutable web pin. Every billable server route must independently authenticate the current Pocket UUID and check current admission; a client lockout or new GET endpoint alone is insufficient. The unmodified September backend is **NOT ACCEPTED /NOT DEPLOYED** by this patch.
2. Implement and independently test server-side Google purchase/expiry/refund/grace ownership verification bound to that authenticated account using existing securely managed provider resources. Local Play status, purchase possession, device preferences and a browser boolean cannot substitute. No feature flag or environment toggle was added to bypass this HOLD.
3. Reconcile source/SDK/signing/package/version, current Play product/base plan and immutable served revision. Obtain real signed/device/sandbox evidence and applicable final owner store/production decisions. This work does not change versions, prices, signing material, Play settings or existing customer records.

Rollback before any deployment: close/revert the separate draft checkpoint. Do not deploy the unsafe historical branch as a security rollback. Public Pocket Bullseye identity and the current core/iOS release track remain separate. Root will publish only the explicit frozen file manifest after independent UI review.
